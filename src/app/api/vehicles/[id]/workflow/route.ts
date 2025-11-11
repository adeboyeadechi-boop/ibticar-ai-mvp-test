// API Routes pour le workflow de publication marketplace
// POST /api/vehicles/[id]/workflow - Soumet un véhicule pour validation

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { WorkflowStage, ValidationStatus } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/vehicles/[id]/workflow - Soumettre pour validation
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const { action, comments, aiScore, aiRecommendation } = body

    // Actions possibles: submit, approve, reject, publish
    if (!action || !['submit', 'approve', 'reject', 'publish'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: submit, approve, reject, or publish' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        vin: true,
        teamId: true,
        publishedAt: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Récupérer la validation en cours
    const existingValidation = await prisma.workflowValidation.findFirst({
      where: {
        entityType: 'Vehicle',
        entityId: vehicleId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Gérer les actions
    switch (action) {
      case 'submit':
        return await handleSubmit(vehicleId, user.id, comments, aiScore, aiRecommendation)

      case 'approve':
        if (!existingValidation || existingValidation.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'No pending validation to approve' },
            { status: 400 }
          )
        }
        return await handleApprove(existingValidation.id, vehicleId, user.id, comments)

      case 'reject':
        if (!existingValidation || existingValidation.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'No pending validation to reject' },
            { status: 400 }
          )
        }
        return await handleReject(existingValidation.id, vehicleId, user.id, comments)

      case 'publish':
        // Vérifier qu'il y a une validation approuvée
        if (!existingValidation || existingValidation.status !== 'APPROVED') {
          return NextResponse.json(
            { error: 'Vehicle must be approved before publishing' },
            { status: 400 }
          )
        }
        return await handlePublish(vehicleId, user.id)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handler: Soumettre pour validation
async function handleSubmit(
  vehicleId: string,
  userId: string,
  comments?: string,
  aiScore?: number,
  aiRecommendation?: string
) {
  // Créer une nouvelle validation
  const validation = await prisma.workflowValidation.create({
    data: {
      entityType: 'Vehicle',
      entityId: vehicleId,
      workflowStage: 'PENDING_REVIEW',
      status: 'PENDING',
      comments,
      aiScore: aiScore || null,
      aiRecommendation: aiRecommendation || null,
    },
  })

  // Log d'audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entityType: 'WorkflowValidation',
      entityId: validation.id,
      changes: {
        action: 'submitted_for_review',
        vehicleId,
      },
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Vehicle submitted for review',
    validation,
  })
}

// Handler: Approuver
async function handleApprove(
  validationId: string,
  vehicleId: string,
  userId: string,
  comments?: string
) {
  // Vérifier permissions (ADMIN, SUPER_ADMIN, MANAGER)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || !['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions to approve' },
      { status: 403 }
    )
  }

  // Mettre à jour la validation
  const validation = await prisma.workflowValidation.update({
    where: { id: validationId },
    data: {
      workflowStage: 'APPROVED',
      status: 'APPROVED',
      validatedById: userId,
      validatedAt: new Date(),
      comments,
    },
  })

  // Log d'audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entityType: 'WorkflowValidation',
      entityId: validationId,
      changes: {
        action: 'approved',
        vehicleId,
      },
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Vehicle approved for publication',
    validation,
  })
}

// Handler: Rejeter
async function handleReject(
  validationId: string,
  vehicleId: string,
  userId: string,
  comments?: string
) {
  // Vérifier permissions
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || !['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions to reject' },
      { status: 403 }
    )
  }

  if (!comments) {
    return NextResponse.json(
      { error: 'Comments are required when rejecting' },
      { status: 400 }
    )
  }

  // Mettre à jour la validation
  const validation = await prisma.workflowValidation.update({
    where: { id: validationId },
    data: {
      workflowStage: 'REJECTED',
      status: 'REJECTED',
      validatedById: userId,
      validatedAt: new Date(),
      comments,
    },
  })

  // Log d'audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entityType: 'WorkflowValidation',
      entityId: validationId,
      changes: {
        action: 'rejected',
        vehicleId,
        reason: comments,
      },
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Vehicle rejected',
    validation,
  })
}

// Handler: Publier sur marketplace
async function handlePublish(vehicleId: string, userId: string) {
  // Mettre à jour le véhicule
  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      publishedAt: new Date(),
      status: 'AVAILABLE',
    },
  })

  // Mettre à jour la validation
  await prisma.workflowValidation.updateMany({
    where: {
      entityType: 'Vehicle',
      entityId: vehicleId,
      status: 'APPROVED',
    },
    data: {
      workflowStage: 'PUBLISHED',
    },
  })

  // Log d'audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'UPDATE',
      entityType: 'Vehicle',
      entityId: vehicleId,
      changes: {
        action: 'published_to_marketplace',
        publishedAt: vehicle.publishedAt,
      },
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Vehicle published to marketplace',
    vehicle: {
      id: vehicle.id,
      publishedAt: vehicle.publishedAt,
    },
  })
}
