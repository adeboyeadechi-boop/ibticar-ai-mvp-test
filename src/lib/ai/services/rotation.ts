/**
 * Vehicle Rotation Prediction Service
 * Predicts how long it will take to sell a vehicle
 */

import { getAIClient } from '../client'
import type { RotationPredictionRequest, RotationPrediction } from '../types'
import {
  ROTATION_SYSTEM_PROMPT,
  buildRotationPrompt,
} from '../prompts/rotation'
import prisma from '@/prisma/client'

export class RotationPredictionService {
  /**
   * Predict rotation time for a vehicle
   */
  async predictRotation(
    request: RotationPredictionRequest
  ): Promise<RotationPrediction> {
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

      // 2. Fetch historical data for similar vehicles
      const historicalData = await this.getHistoricalData(
        vehicle.model?.brand?.name || 'Unknown',
        vehicle.model?.name || 'Unknown',
        vehicle.year,
        vehicle.sellingPrice
      )

      // 3. Assess current market conditions
      const marketConditions = await this.getMarketConditions()

      // 4. Calculate days in inventory
      const daysInInventory = vehicle.createdAt
        ? Math.floor(
            (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0

      // 5. Build AI prompt
      const prompt = buildRotationPrompt({
        vehicle: {
          id: vehicle.id,
          brand: vehicle.model?.brand?.name || 'Unknown',
          model: vehicle.model?.name || 'Unknown',
          year: vehicle.year,
          price: vehicle.sellingPrice.toNumber(),
          mileage: vehicle.mileage || 0,
          condition: vehicle.condition,
          fuelType: vehicle.model?.fuelType || 'Unknown',
          transmission: vehicle.model?.transmission || 'Unknown',
          bodyType: vehicle.model?.bodyType || undefined,
          features: vehicle.features as string[] | undefined,
          daysInInventory,
        },
        historicalData,
        marketConditions: request.includeMarketAnalysis
          ? marketConditions
          : undefined,
      })

      // 6. Get AI prediction
      const aiClient = getAIClient()
      const prediction = await aiClient.generateJSON<RotationPrediction>(
        prompt,
        ROTATION_SYSTEM_PROMPT
      )

      // 7. Store prediction in database
      await this.storePrediction(request.vehicleId, prediction)

      return prediction
    } catch (error) {
      console.error('Error predicting rotation:', error)
      throw error
    }
  }

  /**
   * Get historical sales data for similar vehicles
   */
  private async getHistoricalData(
    brand: string,
    model: string,
    year: number,
    price: number
  ) {
    try {
      // Find similar vehicles that were sold
      // We consider vehicles within 2 years and 20% price range as similar
      const yearMin = year - 2
      const yearMax = year + 2
      const priceMin = price * 0.8
      const priceMax = price * 1.2

      const similarVehicles = await prisma.vehicle.findMany({
        where: {
          status: 'SOLD',
          year: {
            gte: yearMin,
            lte: yearMax,
          },
          sellingPrice: {
            gte: priceMin,
            lte: priceMax,
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
          updatedAt: 'desc',
        },
        take: 20, // Limit to recent sales
      })

      // Calculate days to sell for each vehicle
      const salesData = similarVehicles
        .map((v) => {
          if (!v.createdAt || !v.updatedAt) return null

          const daysSold = Math.floor(
            (v.updatedAt.getTime() - v.createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )

          return {
            brand: v.model?.brand?.name || 'Unknown',
            model: v.model?.name || 'Unknown',
            year: v.year,
            price: v.sellingPrice.toNumber(),
            daysSold,
            soldDate: v.updatedAt.toISOString().split('T')[0],
          }
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)

      if (salesData.length === 0) {
        return undefined
      }

      // Calculate statistics
      const daysSoldArray = salesData.map((v) => v.daysSold)
      const averageRotationDays = Math.round(
        daysSoldArray.reduce((a, b) => a + b, 0) / daysSoldArray.length
      )
      const fastestRotation = Math.min(...daysSoldArray)
      const slowestRotation = Math.max(...daysSoldArray)

      return {
        similarVehicles: salesData,
        averageRotationDays,
        fastestRotation,
        slowestRotation,
      }
    } catch (error) {
      console.error('Error fetching historical data:', error)
      return undefined
    }
  }

  /**
   * Assess current market conditions
   * This is a simplified version - in production, you'd integrate with external APIs
   */
  private async getMarketConditions() {
    try {
      // Determine current season
      const month = new Date().getMonth() + 1
      let currentSeason = 'Winter'
      if (month >= 3 && month <= 5) currentSeason = 'Spring'
      else if (month >= 6 && month <= 8) currentSeason = 'Summer'
      else if (month >= 9 && month <= 11) currentSeason = 'Fall'

      // Count available vehicles to assess demand
      const totalAvailable = await prisma.vehicle.count({
        where: { status: 'AVAILABLE' },
      })

      // Simple demand calculation based on inventory
      let demandLevel: 'low' | 'medium' | 'high' = 'medium'
      if (totalAvailable < 50) demandLevel = 'high'
      else if (totalAvailable > 200) demandLevel = 'low'

      return {
        currentSeason,
        economicIndicators: 'Stable market conditions',
        competitorPricing: 'Competitive',
        demandLevel,
      }
    } catch (error) {
      console.error('Error assessing market conditions:', error)
      return {
        currentSeason: 'Unknown',
        economicIndicators: 'N/A',
        competitorPricing: 'N/A',
        demandLevel: 'medium' as const,
      }
    }
  }

  /**
   * Store prediction in database for tracking
   */
  private async storePrediction(
    vehicleId: string,
    prediction: RotationPrediction
  ): Promise<void> {
    try {
      await prisma.aIRecommendation.create({
        data: {
          vehicleId,
          type: 'ROTATION_PREDICTION',
          confidence: prediction.confidence,
          reasoning: prediction.reasoning,
          metadata: {
            predictedDays: prediction.predictedDays,
            riskLevel: prediction.riskLevel,
            influencingFactors: prediction.influencingFactors,
            recommendations: prediction.recommendations,
            priceAdjustmentSuggestion: prediction.priceAdjustmentSuggestion,
            comparisonToMarket: prediction.comparisonToMarket,
          },
          status: 'PENDING',
        },
      })
    } catch (error) {
      console.error('Error storing prediction:', error)
      // Don't throw - prediction should still be returned to user
    }
  }

  /**
   * Get stored predictions for a vehicle
   */
  async getStoredPredictions(vehicleId: string, limit: number = 5) {
    return prisma.aIRecommendation.findMany({
      where: {
        vehicleId,
        type: 'ROTATION_PREDICTION',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  }

  /**
   * Batch predict rotation for multiple vehicles
   * Useful for analyzing entire inventory
   */
  async batchPredictRotation(vehicleIds: string[]) {
    const predictions: RotationPrediction[] = []
    const errors: Array<{ vehicleId: string; error: string }> = []

    for (const vehicleId of vehicleIds) {
      try {
        const prediction = await this.predictRotation({
          vehicleId,
          includeMarketAnalysis: true,
        })
        predictions.push(prediction)
      } catch (error: any) {
        errors.push({
          vehicleId,
          error: error.message || 'Unknown error',
        })
      }
    }

    return {
      predictions,
      errors,
      summary: {
        total: vehicleIds.length,
        successful: predictions.length,
        failed: errors.length,
      },
    }
  }
}
