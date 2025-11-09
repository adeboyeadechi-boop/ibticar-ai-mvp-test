/**
 * AI Recommendations API
 * POST /api/ai/recommendations - Generate vehicle recommendations for a customer
 * GET /api/ai/recommendations - Get stored recommendations for a customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/rbac'
import { initializeAI } from '@/lib/ai/client'
import { RecommendationService } from '@/lib/ai/services'

// Initialize AI client
initializeAI()

/**
 * POST /api/ai/recommendations
 * Generate vehicle recommendations
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      'ai:recommendations'
    )
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { customerId, budget, preferences } = body

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      )
    }

    // Generate recommendations
    const service = new RecommendationService()
    const recommendations = await service.generateRecommendations({
      customerId,
      budget,
      preferences,
    })

    return NextResponse.json(
      {
        success: true,
        data: recommendations,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error generating recommendations:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/recommendations?customerId=xxx
 * Get stored recommendations for a customer
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const hasPermission = await checkPermission(
      session.user.id,
      'ai:recommendations'
    )
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      )
    }

    // Get stored recommendations
    const service = new RecommendationService()
    const recommendations = await service.getStoredRecommendations(
      customerId,
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
    console.error('Error fetching recommendations:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch recommendations',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
