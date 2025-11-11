// API Route pour suivre un job d'import de véhicules
// GET /api/vehicles/import/[jobId] - Statut et résultats

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ jobId: string }>
}

// GET /api/vehicles/import/[jobId] - Récupère le statut d'un job d'import
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { jobId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const job = await prisma.importExportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        type: true,
        status: true,
        teamId: true,
        fileName: true,
        totalRecords: true,
        processedRecords: true,
        successRecords: true,
        errorRecords: true,
        errors: true,
        result: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur a accès (même équipe ou admin)
    const hasAccess =
      ['ADMIN', 'SUPER_ADMIN'].includes(user.role) ||
      job.teamId === user.id // Temporaire: teamId stocke userId

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculer la progression
    const progress = job.totalRecords > 0
      ? Math.round((job.processedRecords / job.totalRecords) * 100)
      : 0

    // Calculer la durée
    const duration = job.completedAt && job.startedAt
      ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
      : null

    return NextResponse.json({
      ...job,
      progress,
      duration,
      isComplete: job.status === 'COMPLETED' || job.status === 'FAILED',
    })
  } catch (error) {
    console.error('Error fetching import job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
