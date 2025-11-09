/**
 * AI Rotation Prediction API
 * POST /api/ai/rotation - Predict vehicle rotation time
 * GET /api/ai/rotation?vehicleId=xxx - Get stored predictions for a vehicle
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/rbac'
import { initializeAI } from '@/lib/ai/client'
import { RotationPredictionService } from '@/lib/ai/services'

// Initialize AI client
initializeAI()

/**
 * POST /api/ai/rotation
 * Generate rotation prediction for a vehicle
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
      'ai:predictions'
    )
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { vehicleId, includeMarketAnalysis = true } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'vehicleId is required' },
        { status: 400 }
      )
    }

    // Generate prediction
    const service = new RotationPredictionService()
    const prediction = await service.predictRotation({
      vehicleId,
      includeMarketAnalysis,
    })

    return NextResponse.json(
      {
        success: true,
        data: prediction,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error predicting rotation:', error)
    return NextResponse.json(
      {
        error: 'Failed to predict rotation',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/rotation?vehicleId=xxx
 * Get stored rotation predictions for a vehicle
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
      'ai:predictions'
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

    // Get stored predictions
    const service = new RotationPredictionService()
    const predictions = await service.getStoredPredictions(vehicleId, limit)

    return NextResponse.json(
      {
        success: true,
        data: predictions,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching predictions:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch predictions',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
