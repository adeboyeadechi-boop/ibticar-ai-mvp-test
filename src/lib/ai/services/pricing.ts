/**
 * Dynamic Pricing Service
 * Provides AI-powered pricing recommendations for vehicles
 */

import { getAIClient } from '../client'
import type {
  DynamicPricingRequest,
  DynamicPricingRecommendation,
} from '../types'
import { PRICING_SYSTEM_PROMPT, buildPricingPrompt } from '../prompts/pricing'
import prisma from '@/prisma/client'
import { RecommendationType, RecommendationStatus } from '@/generated/prisma'

export class DynamicPricingService {
  /**
   * Generate pricing recommendations for a vehicle
   */
  async generatePricing(
    request: DynamicPricingRequest
  ): Promise<DynamicPricingRecommendation> {
    try {
      // 1. Fetch vehicle data
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: request.vehicleId },
        include: {
          model: {
            include: {
              brand: true,
            },
          },
        },
      })

      if (!vehicle) {
        throw new Error('Vehicle not found')
      }

      // 2. Fetch market data for similar vehicles
      const marketData = await this.getMarketData(
        vehicle.model?.brand?.name || 'Unknown',
        vehicle.model?.name || 'Unknown',
        vehicle.year,
        vehicle.mileage || 0
      )

      // 3. Calculate days in inventory
      const daysInInventory = vehicle.createdAt
        ? Math.floor(
            (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0

      // 4. Build AI prompt
      const prompt = buildPricingPrompt({
        vehicle: {
          id: vehicle.id,
          brand: vehicle.model?.brand?.name || 'Unknown',
          model: vehicle.model?.name || 'Unknown',
          year: vehicle.year,
          currentPrice: vehicle.sellingPrice.toNumber(),
          purchasePrice: vehicle.purchasePrice?.toNumber(),
          mileage: vehicle.mileage || 0,
          condition: vehicle.condition,
          fuelType: vehicle.model?.fuelType || 'Unknown',
          transmission: vehicle.model?.transmission || 'Unknown',
          bodyType: vehicle.model?.bodyType || undefined,
          features: vehicle.features as string[] | undefined,
          daysInInventory,
        },
        marketData: request.includeMarketAnalysis ? marketData : undefined,
        businessObjectives: request.businessObjectives,
      })

      // 5. Get AI pricing recommendation
      const aiClient = getAIClient()
      const recommendation =
        await aiClient.generateJSON<DynamicPricingRecommendation>(
          prompt,
          PRICING_SYSTEM_PROMPT
        )

      // 6. Store recommendation in database
      await this.storeRecommendation(request.vehicleId, recommendation)

      return recommendation
    } catch (error) {
      console.error('Error generating pricing recommendation:', error)
      throw error
    }
  }

  /**
   * Get market data for similar vehicles
   */
  private async getMarketData(
    brand: string,
    model: string,
    year: number,
    mileage: number
  ) {
    try {
      // Find similar vehicles (both available and sold)
      const yearMin = year - 2
      const yearMax = year + 2
      const mileageRange = mileage * 0.3 // 30% range

      const similarVehicles = await prisma.vehicle.findMany({
        where: {
          status: {
            in: ['AVAILABLE', 'SOLD'],
          },
          year: {
            gte: yearMin,
            lte: yearMax,
          },
          mileage: {
            gte: Math.max(0, mileage - mileageRange),
            lte: mileage + mileageRange,
          },
          model: {
            brand: {
              name: {
                contains: brand,
                mode: 'insensitive',
              },
            },
          },
        },
        include: {
          model: {
            include: {
              brand: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 30, // Get more data for better analysis
      })

      if (similarVehicles.length === 0) {
        return undefined
      }

      // Transform data for AI analysis
      const vehicleData = similarVehicles.map((v) => {
        const daysListed = v.createdAt
          ? Math.floor(
              (Date.now() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          : undefined

        return {
          brand: v.model?.brand?.name || 'Unknown',
          model: v.model?.name || 'Unknown',
          year: v.year,
          price: v.sellingPrice.toNumber(),
          mileage: v.mileage || 0,
          status: v.status,
          daysListed,
        }
      })

      // Calculate market statistics
      const prices = similarVehicles.map((v) => v.sellingPrice.toNumber())
      const averageMarketPrice = Math.round(
        prices.reduce((a, b) => a + b, 0) / prices.length
      )
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)

      return {
        similarVehicles: vehicleData,
        averageMarketPrice,
        priceRange: {
          min: minPrice,
          max: maxPrice,
        },
      }
    } catch (error) {
      console.error('Error fetching market data:', error)
      return undefined
    }
  }

  /**
   * Store pricing recommendation in database
   */
  private async storeRecommendation(
    vehicleId: string,
    recommendation: DynamicPricingRecommendation
  ): Promise<void> {
    try {
      // Store optimal recommendation as the primary one
      const optimalRec = recommendation.recommendations.optimal

      await prisma.aIRecommendation.create({
        data: {
          entityType: 'Vehicle',
          entityId: vehicleId,
          type: RecommendationType.PRICING,
          score: optimalRec.confidence,
          reasoning: {
            currentPrice: recommendation.currentPrice,
            recommendedPrice: optimalRec.price,
            expectedDaysToSell: optimalRec.expectedDaysToSell,
            profitMargin: optimalRec.profitMargin,
            allScenarios: recommendation.recommendations,
            marketPosition: recommendation.marketPosition,
            adjustmentRecommendation: recommendation.adjustmentRecommendation,
            pricingStrategy: recommendation.pricingStrategy,
            riskAnalysis: recommendation.riskAnalysis,
          },
          recommendation: optimalRec.reasoning,
          status: RecommendationStatus.PENDING,
        },
      })
    } catch (error) {
      console.error('Error storing pricing recommendation:', error)
      // Don't throw - recommendation should still be returned
    }
  }

  /**
   * Get stored pricing recommendations for a vehicle
   */
  async getStoredRecommendations(vehicleId: string, limit: number = 5) {
    return prisma.aIRecommendation.findMany({
      where: {
        entityType: 'Vehicle',
        entityId: vehicleId,
        type: RecommendationType.PRICING,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  }

  /**
   * Apply recommended pricing to vehicle
   * Updates the vehicle's selling price based on a specific scenario
   */
  async applyPricing(
    vehicleId: string,
    recommendationId: string,
    scenario: 'optimal' | 'quick_sale' | 'maximum_profit'
  ) {
    try {
      // Fetch the recommendation
      const recommendation = await prisma.aIRecommendation.findUnique({
        where: { id: recommendationId },
      })

      if (!recommendation || recommendation.entityId !== vehicleId) {
        throw new Error('Recommendation not found or does not match vehicle')
      }

      // Extract price from reasoning JSON
      const reasoningData = recommendation.reasoning as any
      const scenarios = reasoningData?.allScenarios

      if (!scenarios || !scenarios[scenario]) {
        throw new Error(`Scenario '${scenario}' not found in recommendation`)
      }

      const newPrice = scenarios[scenario].price

      // Update vehicle price
      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          sellingPrice: newPrice,
        },
      })

      // Mark recommendation as accepted
      await prisma.aIRecommendation.update({
        where: { id: recommendationId },
        data: {
          status: RecommendationStatus.ACCEPTED,
        },
      })

      return {
        vehicle: updatedVehicle,
        appliedScenario: scenario,
        oldPrice: reasoningData.currentPrice,
        newPrice,
      }
    } catch (error) {
      console.error('Error applying pricing:', error)
      throw error
    }
  }

  /**
   * Batch pricing analysis for inventory optimization
   */
  async batchPricingAnalysis(vehicleIds: string[]) {
    const recommendations: DynamicPricingRecommendation[] = []
    const errors: Array<{ vehicleId: string; error: string }> = []

    for (const vehicleId of vehicleIds) {
      try {
        const recommendation = await this.generatePricing({
          vehicleId,
          includeMarketAnalysis: true,
        })
        recommendations.push(recommendation)
      } catch (error: any) {
        errors.push({
          vehicleId,
          error: error.message || 'Unknown error',
        })
      }
    }

    // Calculate summary statistics
    const needsPriceReduction = recommendations.filter(
      (r) => r.adjustmentRecommendation.action === 'reduce'
    ).length
    const needsPriceIncrease = recommendations.filter(
      (r) => r.adjustmentRecommendation.action === 'increase'
    ).length
    const wellPriced = recommendations.filter(
      (r) => r.adjustmentRecommendation.action === 'maintain'
    ).length

    return {
      recommendations,
      errors,
      summary: {
        total: vehicleIds.length,
        successful: recommendations.length,
        failed: errors.length,
        needsPriceReduction,
        needsPriceIncrease,
        wellPriced,
      },
    }
  }
}
