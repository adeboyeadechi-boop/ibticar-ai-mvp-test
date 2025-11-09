/**
 * Vehicle Recommendation Service
 * Provides AI-powered vehicle recommendations to customers
 */

import { getAIClient } from '../client'
import type {
  VehicleRecommendationRequest,
  RecommendationResponse,
} from '../types'
import {
  RECOMMENDATION_SYSTEM_PROMPT,
  buildRecommendationPrompt,
} from '../prompts/recommendations'
import prisma from '@/prisma/client'

export class RecommendationService {
  /**
   * Generate vehicle recommendations for a customer
   */
  async generateRecommendations(
    request: VehicleRecommendationRequest
  ): Promise<RecommendationResponse> {
    try {
      // 1. Fetch customer data
      const customer = await prisma.customer.findUnique({
        where: { id: request.customerId },
      })

      if (!customer) {
        throw new Error('Customer not found')
      }

      // 2. Fetch available vehicles matching basic criteria
      const vehicles = await prisma.vehicle.findMany({
        where: {
          status: 'AVAILABLE',
          ...(request.budget && {
            sellingPrice: {
              lte: request.budget,
            },
          }),
          ...(request.preferences?.maxMileage && {
            mileage: {
              lte: request.preferences.maxMileage,
            },
          }),
        },
        include: {
          model: {
            include: {
              brand: true,
            },
          },
        },
        take: 50, // Limit for performance
      })

      if (vehicles.length === 0) {
        return {
          recommendations: [],
          explanation:
            'No vehicles match the specified criteria. Please adjust your requirements.',
          generatedAt: new Date(),
        }
      }

      // 3. Build AI prompt
      const prompt = buildRecommendationPrompt({
        customer: {
          id: customer.id,
          email: customer.email || undefined,
          type: customer.type,
          preferences: customer.preferences,
        },
        vehicles: vehicles.map((v) => ({
          id: v.id,
          brand: v.model?.brand?.name || 'Unknown',
          model: v.model?.name || 'Unknown',
          year: v.year,
          price: v.sellingPrice.toNumber(),
          mileage: v.mileage || 0,
          fuelType: v.model?.fuelType || 'Unknown',
          transmission: v.model?.transmission || 'Unknown',
          condition: v.condition,
          features: v.features as string[] | undefined,
        })),
        budget: request.budget,
        requirements: request.preferences,
      })

      // 4. Get AI recommendations
      const aiClient = getAIClient()
      const response = await aiClient.generateJSON<RecommendationResponse>(
        prompt,
        RECOMMENDATION_SYSTEM_PROMPT
      )

      // 5. Store recommendations in database
      await this.storeRecommendations(request.customerId, response)

      return response
    } catch (error) {
      console.error('Error generating recommendations:', error)
      throw error
    }
  }

  /**
   * Store recommendations in database for tracking
   */
  private async storeRecommendations(
    customerId: string,
    response: RecommendationResponse
  ): Promise<void> {
    try {
      for (const rec of response.recommendations) {
        await prisma.aIRecommendation.create({
          data: {
            customerId,
            vehicleId: rec.vehicleId,
            type: 'VEHICLE_MATCH',
            confidence: rec.score / 100,
            reasoning: rec.reasoning,
            metadata: {
              matchedPreferences: rec.matchedPreferences,
              potentialConcerns: rec.potentialConcerns,
            },
            status: 'PENDING',
          },
        })
      }
    } catch (error) {
      console.error('Error storing recommendations:', error)
      // Don't throw - recommendations should still be returned to user
    }
  }

  /**
   * Get stored recommendations for a customer
   */
  async getStoredRecommendations(customerId: string, limit: number = 10) {
    return prisma.aIRecommendation.findMany({
      where: {
        customerId,
        type: 'VEHICLE_MATCH',
      },
      include: {
        vehicle: {
          include: {
            model: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
  }
}
