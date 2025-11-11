// API Route pour consultation des logs d'audit
// GET /api/audit-logs?userId=xxx&action=xxx&entityType=xxx&fromDate=xxx&toDate=xxx&page=1&limit=50

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { AuditAction } from '@/generated/prisma'

// GET /api/audit-logs - Récupère les logs d'audit avec filtres et pagination
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN et SUPER_ADMIN peuvent consulter les logs
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const action = searchParams.get('action') as AuditAction | null
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const ipAddress = searchParams.get('ipAddress')
    const searchQuery = searchParams.get('search') // Recherche globale
    const format = searchParams.get('format') // csv ou xlsx pour export

    // Paramètres de pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (userId) where.userId = userId
    if (action) where.action = action
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (ipAddress) where.ipAddress = { contains: ipAddress }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    // Recherche globale (dans entityType, entityId, ou métadonnées)
    if (searchQuery) {
      where.OR = [
        { entityType: { contains: searchQuery, mode: 'insensitive' } },
        { entityId: { contains: searchQuery, mode: 'insensitive' } },
      ]
    }

    // Si export demandé, pas de pagination
    if (format === 'csv' || format === 'xlsx') {
      return await exportAuditLogs(where, format, user.id)
    }

    // Compter le total pour la pagination
    const total = await prisma.auditLog.count({ where })

    // Récupérer les logs avec pagination
    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    // Enrichir avec les informations utilisateur
    const userIds = [...new Set(logs.map((log) => log.userId).filter(Boolean))] as string[]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    })

    const usersMap = new Map(users.map((u) => [u.id, u]))

    const enrichedLogs = logs.map((log) => ({
      ...log,
      user: log.userId ? usersMap.get(log.userId) : null,
    }))

    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Fonction helper pour exporter les logs
async function exportAuditLogs(where: any, format: string, requestUserId: string) {
  try {
    // Récupérer TOUS les logs (max 10k pour éviter OOM)
    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10000, // Limite de sécurité
    })

    // Récupérer les infos utilisateurs
    const userIds = [...new Set(logs.map((log) => log.userId).filter(Boolean))] as string[]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    const usersMap = new Map(users.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, email: u.email }]))

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Logs Audit')

    // Définir les colonnes
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Utilisateur', key: 'user', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Type Entité', key: 'entityType', width: 20 },
      { header: 'ID Entité', key: 'entityId', width: 25 },
      { header: 'Adresse IP', key: 'ipAddress', width: 20 },
      { header: 'User Agent', key: 'userAgent', width: 50 },
      { header: 'Changements', key: 'changes', width: 60 },
    ]

    // Formater l'en-tête
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Ajouter les données
    logs.forEach((log) => {
      const userInfo = log.userId ? usersMap.get(log.userId) : null

      worksheet.addRow({
        date: new Date(log.createdAt).toLocaleString('fr-DZ'),
        user: userInfo?.name || 'Système',
        email: userInfo?.email || 'N/A',
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId || 'N/A',
        ipAddress: log.ipAddress || 'N/A',
        userAgent: log.userAgent || 'N/A',
        changes: JSON.stringify(log.changes, null, 2),
      })
    })

    // Ajouter des filtres automatiques
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    }

    // Générer le fichier
    let buffer: Buffer
    let contentType: string
    let filename: string

    const timestamp = new Date().toISOString().split('T')[0]

    if (format === 'csv') {
      buffer = Buffer.from(await workbook.csv.writeBuffer())
      contentType = 'text/csv'
      filename = `audit_logs_${timestamp}.csv`
    } else {
      buffer = Buffer.from(await workbook.xlsx.writeBuffer())
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      filename = `audit_logs_${timestamp}.xlsx`
    }

    // Logger l'export
    await prisma.auditLog.create({
      data: {
        userId: requestUserId,
        action: 'EXPORT',
        entityType: 'AuditLog',
        entityId: null,
        changes: {
          format,
          exportedCount: logs.length,
        },
      },
    })

    // Retourner le fichier
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting audit logs:', error)
    return NextResponse.json(
      { error: 'Error exporting audit logs' },
      { status: 500 }
    )
  }
}
