// API Route pour l'export d'inventaire véhicules
// GET /api/vehicles/export?format=csv|xlsx&teamId=xxx&status=xxx

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { VehicleStatus } from '@/generated/prisma'

// GET /api/vehicles/export - Exporte l'inventaire en CSV ou Excel
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier les permissions
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres de la query
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'xlsx' // csv ou xlsx
    const teamId = searchParams.get('teamId')
    const status = searchParams.get('status') as VehicleStatus | null
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const includeArchived = searchParams.get('includeArchived') === 'true'

    // Valider le format
    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "xlsx"' },
        { status: 400 }
      )
    }

    // Construire les filtres
    const where: any = {}

    if (teamId) {
      where.teamId = teamId
    }

    if (status) {
      where.status = status
    }

    if (!includeArchived) {
      where.archivedAt = null
    }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    // Récupérer les véhicules avec toutes les relations
    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        model: {
          include: {
            brand: {
              select: {
                name: true,
                country: true,
              },
            },
          },
        },
        team: {
          select: {
            name: true,
            type: true,
            city: true,
            wilaya: true,
          },
        },
        media: {
          where: {
            order: 0, // Seulement la première image
          },
          select: {
            url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Inventaire Véhicules')

    // Définir les colonnes
    worksheet.columns = [
      { header: 'VIN', key: 'vin', width: 20 },
      { header: 'Marque', key: 'brand', width: 15 },
      { header: 'Modèle', key: 'model', width: 20 },
      { header: 'Année', key: 'year', width: 10 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Condition', key: 'condition', width: 15 },
      { header: 'Kilométrage', key: 'mileage', width: 12 },
      { header: 'Couleur', key: 'color', width: 15 },
      { header: 'Carburant', key: 'fuelType', width: 12 },
      { header: 'Transmission', key: 'transmission', width: 12 },
      { header: 'Prix Achat (DZD)', key: 'purchasePrice', width: 15 },
      { header: 'Prix Vente (DZD)', key: 'sellingPrice', width: 15 },
      { header: 'Marge (DZD)', key: 'margin', width: 15 },
      { header: 'Équipe', key: 'team', width: 20 },
      { header: 'Localisation', key: 'location', width: 20 },
      { header: 'Classe Énergétique', key: 'energyClass', width: 18 },
      { header: 'CO2 (g/km)', key: 'co2Emissions', width: 12 },
      { header: 'Conso. Mixte (L/100km)', key: 'fuelConsumption', width: 20 },
      { header: 'Date Achat', key: 'purchaseDate', width: 15 },
      { header: 'Date Publication', key: 'publishedAt', width: 15 },
      { header: 'Date Vente', key: 'soldAt', width: 15 },
      { header: 'Image URL', key: 'imageUrl', width: 50 },
    ]

    // Formater l'en-tête (gras, centré)
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Ajouter les données
    vehicles.forEach((vehicle) => {
      const margin = Number(vehicle.sellingPrice) - Number(vehicle.purchasePrice)

      worksheet.addRow({
        vin: vehicle.vin,
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
        year: vehicle.year,
        status: vehicle.status,
        condition: vehicle.condition,
        mileage: vehicle.mileage || 'N/A',
        color: vehicle.color,
        fuelType: vehicle.model.fuelType,
        transmission: vehicle.model.transmission,
        purchasePrice: Number(vehicle.purchasePrice),
        sellingPrice: Number(vehicle.sellingPrice),
        margin: margin,
        team: vehicle.team.name,
        location: vehicle.location || vehicle.team.wilaya || 'N/A',
        energyClass: vehicle.energyClass || vehicle.model.energyLabel || 'N/A',
        co2Emissions: vehicle.co2EmissionsActual || vehicle.model.co2Emission || 'N/A',
        fuelConsumption: vehicle.fuelConsumptionCombined
          ? Number(vehicle.fuelConsumptionCombined).toFixed(1)
          : 'N/A',
        purchaseDate: vehicle.purchaseDate
          ? new Date(vehicle.purchaseDate).toLocaleDateString('fr-DZ')
          : 'N/A',
        publishedAt: vehicle.publishedAt
          ? new Date(vehicle.publishedAt).toLocaleDateString('fr-DZ')
          : 'Non publié',
        soldAt: vehicle.soldAt
          ? new Date(vehicle.soldAt).toLocaleDateString('fr-DZ')
          : 'N/A',
        imageUrl: vehicle.media[0]?.url || 'Pas d\'image',
      })
    })

    // Formater les colonnes numériques
    worksheet.getColumn('purchasePrice').numFmt = '#,##0.00'
    worksheet.getColumn('sellingPrice').numFmt = '#,##0.00'
    worksheet.getColumn('margin').numFmt = '#,##0.00'

    // Ajouter des filtres automatiques
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    }

    // Générer le fichier selon le format demandé
    let buffer: Buffer
    let contentType: string
    let filename: string

    const timestamp = new Date().toISOString().split('T')[0]
    const teamName = teamId
      ? vehicles[0]?.team.name.replace(/\s+/g, '_')
      : 'Tous'

    if (format === 'csv') {
      buffer = Buffer.from(await workbook.csv.writeBuffer())
      contentType = 'text/csv'
      filename = `inventaire_${teamName}_${timestamp}.csv`
    } else {
      buffer = Buffer.from(await workbook.xlsx.writeBuffer())
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      filename = `inventaire_${teamName}_${timestamp}.xlsx`
    }

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXPORT',
        entityType: 'Vehicle',
        entityId: null,
        changes: {
          format,
          filters: where,
          exportedCount: vehicles.length,
        },
      },
    })

    // Retourner le fichier
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error exporting vehicles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
