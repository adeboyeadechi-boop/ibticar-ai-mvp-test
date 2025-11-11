// API Route pour l'import massif de véhicules
// POST /api/vehicles/import - Upload et traite fichier véhicules (CSV/Excel)

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import {
  VehicleStatus,
  VehicleCondition,
  Currency,
} from '@/generated/prisma'
import { calculateEnergyClass } from '@/lib/energy-label-calculator'

// POST /api/vehicles/import - Import masse véhicules
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier les permissions
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le fichier et options
    const formData = await request.formData()
    const file = formData.get('file') as File
    const teamId = formData.get('teamId') as string
    const validateOnly = formData.get('validateOnly') === 'true'
    const skipDuplicates = formData.get('skipDuplicates') === 'true'
    const createMissingModels = formData.get('createMissingModels') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      )
    }

    // Vérifier que l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Vérifier le type de fichier
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be CSV or Excel (.xlsx)' },
        { status: 400 }
      )
    }

    // Créer un job d'import
    const job = await prisma.importExportJob.create({
      data: {
        type: 'IMPORT_VEHICLES',
        status: 'PROCESSING',
        teamId,
        initiatedById: user.id,
        fileName: file.name,
      },
    })

    // Parser le fichier
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    const nodeBuffer = Buffer.from(buffer)

    if (file.type === 'text/csv') {
      await workbook.csv.read(nodeBuffer as any)
    } else {
      await workbook.xlsx.load(nodeBuffer as any)
    }

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
      return NextResponse.json(
        { error: 'No worksheet found in file' },
        { status: 400 }
      )
    }

    // Colonnes attendues:
    // VIN | Brand | Model | Year | Condition | Mileage | Color | InteriorColor |
    // PurchasePrice | SellingPrice | Currency | PurchaseDate | Location | Features | Notes

    const rows: any[] = []
    const errors: string[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const rowData = {
        rowNumber,
        vin: row.getCell(1).value?.toString().trim(),
        brandName: row.getCell(2).value?.toString().trim(),
        modelName: row.getCell(3).value?.toString().trim(),
        year: parseInt(row.getCell(4).value?.toString() || '0', 10),
        condition: row.getCell(5).value?.toString().trim(),
        mileage: parseInt(row.getCell(6).value?.toString() || '0', 10),
        color: row.getCell(7).value?.toString().trim(),
        interiorColor: row.getCell(8).value?.toString().trim(),
        purchasePrice: parseFloat(row.getCell(9).value?.toString() || '0'),
        sellingPrice: parseFloat(row.getCell(10).value?.toString() || '0'),
        currency: row.getCell(11).value?.toString().trim() || 'DZD',
        purchaseDate: row.getCell(12).value,
        location: row.getCell(13).value?.toString().trim(),
        features: row.getCell(14).value?.toString().trim(),
        notes: row.getCell(15).value?.toString().trim(),
      }

      // Validation basique
      if (!rowData.vin || !rowData.brandName || !rowData.modelName || !rowData.year) {
        errors.push(`Row ${rowNumber}: VIN, Brand, Model, and Year are required`)
        return
      }

      if (rowData.year < 1900 || rowData.year > new Date().getFullYear() + 1) {
        errors.push(`Row ${rowNumber}: Invalid year ${rowData.year}`)
        return
      }

      rows.push(rowData)
    })

    // Si validation seulement, retourner les résultats
    if (validateOnly) {
      await prisma.importExportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          totalRecords: rows.length,
          errorRecords: errors.length,
          errors: { errors },
        },
      })

      return NextResponse.json({
        success: true,
        validation: {
          totalRows: rows.length,
          validRows: rows.length - errors.length,
          errorRows: errors.length,
          errors: errors.slice(0, 20), // Premiers 20 erreurs
        },
        jobId: job.id,
      })
    }

    // Importer les véhicules
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0
    const importErrors: string[] = [...errors]

    for (const rowData of rows) {
      try {
        // Vérifier doublon VIN
        const existingVehicle = await prisma.vehicle.findUnique({
          where: { vin: rowData.vin },
        })

        if (existingVehicle) {
          if (skipDuplicates) {
            skippedCount++
            importErrors.push(
              `Row ${rowData.rowNumber}: Vehicle with VIN ${rowData.vin} already exists (skipped)`
            )
            continue
          } else {
            errorCount++
            importErrors.push(
              `Row ${rowData.rowNumber}: Vehicle with VIN ${rowData.vin} already exists`
            )
            continue
          }
        }

        // Trouver ou créer la marque
        let brand = await prisma.brand.findFirst({
          where: {
            name: {
              equals: rowData.brandName,
              mode: 'insensitive',
            },
          },
        })

        if (!brand && createMissingModels) {
          brand = await prisma.brand.create({
            data: {
              name: rowData.brandName,
              slug: rowData.brandName.toLowerCase().replace(/\s+/g, '-'),
              isActive: true,
            },
          })
        }

        if (!brand) {
          errorCount++
          importErrors.push(
            `Row ${rowData.rowNumber}: Brand ${rowData.brandName} not found (enable createMissingModels to auto-create)`
          )
          continue
        }

        // Trouver ou créer le modèle
        let model = await prisma.vehicleModel.findFirst({
          where: {
            brandId: brand.id,
            name: {
              equals: rowData.modelName,
              mode: 'insensitive',
            },
          },
        })

        if (!model && createMissingModels) {
          // Créer modèle basique
          model = await prisma.vehicleModel.create({
            data: {
              brandId: brand.id,
              name: rowData.modelName,
              slug: `${brand.slug}-${rowData.modelName.toLowerCase().replace(/\s+/g, '-')}`,
              category: 'OTHER',
              bodyType: 'SEDAN',
              fuelType: 'GASOLINE',
              transmission: 'MANUAL',
              isActive: true,
            },
          })
        }

        if (!model) {
          errorCount++
          importErrors.push(
            `Row ${rowData.rowNumber}: Model ${rowData.modelName} not found for brand ${rowData.brandName}`
          )
          continue
        }

        // Parser la date d'achat
        let purchaseDate: Date | null = null
        if (rowData.purchaseDate) {
          try {
            if (rowData.purchaseDate instanceof Date) {
              purchaseDate = rowData.purchaseDate
            } else {
              purchaseDate = new Date(rowData.purchaseDate)
            }
          } catch {
            // Ignorer si date invalide
          }
        }

        // Parser les features JSON si présent
        let features: any = null
        if (rowData.features) {
          try {
            features = JSON.parse(rowData.features)
          } catch {
            features = { description: rowData.features }
          }
        }

        // Calculer la classe énergétique
        const energyClass = calculateEnergyClass({
          fuelType: model.fuelType,
          co2Emissions: model.co2Emission,
          engineCapacity: model.engineCapacity,
        })

        // Créer le véhicule
        await prisma.vehicle.create({
          data: {
            vin: rowData.vin,
            vehicleModelId: model.id,
            teamId,
            status: 'AVAILABLE',
            condition: (rowData.condition || 'NEW') as VehicleCondition,
            year: rowData.year,
            mileage: rowData.mileage || null,
            color: rowData.color,
            interiorColor: rowData.interiorColor || null,
            purchasePrice: rowData.purchasePrice,
            sellingPrice: rowData.sellingPrice,
            currency: (rowData.currency || 'DZD') as Currency,
            purchaseDate,
            location: rowData.location || null,
            features,
            notes: rowData.notes || null,
            energyClass,
          },
        })

        successCount++
      } catch (err: any) {
        errorCount++
        importErrors.push(
          `Row ${rowData.rowNumber}: ${err.message || 'Unknown error'}`
        )
      }
    }

    // Mettre à jour le job
    await prisma.importExportJob.update({
      where: { id: job.id },
      data: {
        status: errorCount === rows.length ? 'FAILED' : 'COMPLETED',
        totalRecords: rows.length,
        processedRecords: rows.length,
        successRecords: successCount,
        errorRecords: errorCount,
        errors: { errors: importErrors, skipped: skippedCount },
        completedAt: new Date(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'IMPORT',
        entityType: 'Vehicle',
        entityId: job.id,
        changes: {
          fileName: file.name,
          teamId,
          totalRows: rows.length,
          successCount,
          errorCount,
          skippedCount,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`,
      jobId: job.id,
      summary: {
        totalRows: rows.length,
        successCount,
        errorCount,
        skippedCount,
        errors: importErrors.slice(0, 20), // Premiers 20 erreurs
      },
    })
  } catch (error) {
    console.error('Error importing vehicles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
