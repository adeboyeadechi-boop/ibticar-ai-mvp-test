/**
 * AI Dynamic Pricing API
 * POST /api/ai/pricing - Generate pricing recommendations for a vehicle
 * GET /api/ai/pricing?vehicleId=xxx - Get stored pricing recommendations
 * PATCH /api/ai/pricing - Apply a pricing recommendation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { checkPermission } from '@/lib/rbac'
import { initializeAI } from '@/lib/ai/client'
import { DynamicPricingService } from '@/lib/ai/services'

// Initialize AI client
initializeAI()

/**
 * POST /api/ai/pricing
 * Generate pricing recommendations
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication (supports NextAuth AND Bearer token)
    const { user, error } = await getAuthenticatedUser(req)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(
      user.id,
      'ai:pricing'
    )
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { vehicleId, includeMarketAnalysis = true, businessObjectives } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'vehicleId is required' },
        { status: 400 }
      )
    }

    // Generate pricing recommendations
    const service = new DynamicPricingService()
    const recommendations = await service.generatePricing({
      vehicleId,
      includeMarketAnalysis,
      businessObjectives,
    })

    return NextResponse.json(
      {
        success: true,
        data: recommendations,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error generating pricing:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate pricing recommendations',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/pricing?vehicleId=xxx
 * Get stored pricing recommendations
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication (supports NextAuth AND Bearer token)
    const { user, error } = await getAuthenticatedUser(req)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(
      user.id,
      'ai:pricing'
    )
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const vehicleId = searchParams.get('vehicleId')
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'vehicleId is required' },
        { status: 400 }
      )
    }

    // Get stored recommendations
    const service = new DynamicPricingService()
    const recommendations = await service.getStoredRecommendations(
      vehicleId,
      limit
    )

    return NextResponse.json(
      {
        success: true,
        data: recommendations,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching pricing recommendations:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pricing recommendations',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai/pricing
 * Apply a pricing recommendation to a vehicle
 */
export async function PATCH(req: NextRequest) {
  try {
    // Check authentication (supports NextAuth AND Bearer token)
    const { user, error } = await getAuthenticatedUser(req)
    if (error) return error

    // Check permission (requires both pricing and vehicle update permissions)
    const hasPricingPermission = await checkPermission(
      user.id,
      'ai:pricing'
    )
    const hasVehiclePermission = await checkPermission(
      user.id,
      'vehicles:update'
    )

    if (!hasPricingPermission || !hasVehiclePermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { vehicleId, recommendationId, scenario = 'optimal' } = body

    if (!vehicleId || !recommendationId) {
      return NextResponse.json(
        { error: 'vehicleId and recommendationId are required' },
        { status: 400 }
      )
    }

    if (!['optimal', 'quick_sale', 'maximum_profit'].includes(scenario)) {
      return NextResponse.json(
        {
          error:
            'scenario must be one of: optimal, quick_sale, maximum_profit',
        },
        { status: 400 }
      )
    }

    // Apply pricing
    const service = new DynamicPricingService()
    const result = await service.applyPricing(
      vehicleId,
      recommendationId,
      scenario as 'optimal' | 'quick_sale' | 'maximum_profit'
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Pricing applied successfully',
        data: result,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error applying pricing:', error)
    return NextResponse.json(
      {
        error: 'Failed to apply pricing',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
