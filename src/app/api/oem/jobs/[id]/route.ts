// API Route pour consulter le statut d'un job d'import OEM
// GET /api/oem/jobs/[id] - Statut et résultats

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/oem/jobs/[id] - Récupère le statut d'un job d'import
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const job = await prisma.importExportJob.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
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
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Calculer la progression
    const progress = job.totalRecords > 0
      ? Math.round((job.processedRecords / job.totalRecords) * 100)
      : 0

    return NextResponse.json({
      ...job,
      progress,
      duration: job.completedAt && job.startedAt
        ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
        : null,
    })
  } catch (error) {
    console.error('Error fetching import job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
