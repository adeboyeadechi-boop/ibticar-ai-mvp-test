// API Route pour l'import de données constructeurs OEM
// POST /api/oem/import - Upload et traite fichier OEM (CSV/Excel)

import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { Buffer } from 'buffer'
import ExcelJS from 'exceljs'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import {
  VehicleCategory,
  BodyType,
  FuelType,
  TransmissionType,
  EnergyLabel
} from '@/generated/prisma'

// POST /api/oem/import - Import données constructeurs
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN et SUPER_ADMIN peuvent importer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le fichier
    const formData = await request.formData()
    const file = formData.get('file') as File
    const validateOnly = formData.get('validateOnly') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
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
        { error: 'Invalid file type. Must be CSV or Excel' },
        { status: 400 }
      )
    }

    // Créer un job d'import
    const job = await prisma.importExportJob.create({
      data: {
        type: 'IMPORT_VEHICLES',
        status: 'PROCESSING',
        teamId: user.id, // Utiliser userId comme teamId temporairement
        initiatedById: user.id,
        fileName: file.name,
      },
    })

    // Parser le fichier
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const workbook = new ExcelJS.Workbook()

    if (file.type === 'text/csv') {
      // Pour CSV, convertir en string puis en stream
      const textContent = new TextDecoder().decode(uint8Array)
      const stream = Readable.from(textContent)
      await workbook.csv.read(stream)
    } else {
      // Pour Excel, utiliser le buffer Node.js
      const nodeBuffer = Buffer.from(uint8Array)
      await workbook.xlsx.load(nodeBuffer as any)
    }

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
      return NextResponse.json(
        { error: 'No worksheet found in file' },
        { status: 400 }
      )
    }

    // Extraire les données
    const rows: any[] = []
    const errors: string[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const rowData = {
        rowNumber,
        brandName: row.getCell(1).value?.toString().trim(),
        modelName: row.getCell(2).value?.toString().trim(),
        category: row.getCell(3).value?.toString().trim(),
        bodyType: row.getCell(4).value?.toString().trim(),
        fuelType: row.getCell(5).value?.toString().trim(),
        transmission: row.getCell(6).value?.toString().trim(),
        engineCapacity: parseInt(row.getCell(7).value?.toString() || '0', 10),
        horsePower: parseInt(row.getCell(8).value?.toString() || '0', 10),
        co2Emission: parseInt(row.getCell(9).value?.toString() || '0', 10),
        seats: parseInt(row.getCell(10).value?.toString() || '0', 10),
        doors: parseInt(row.getCell(11).value?.toString() || '0', 10),
        energyLabel: row.getCell(12).value?.toString().trim(),
        country: row.getCell(13).value?.toString().trim(),
      }

      // Validation basique
      if (!rowData.brandName || !rowData.modelName) {
        errors.push(`Row ${rowNumber}: Brand and Model are required`)
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
          errors: errors.slice(0, 10), // Premiers 10 erreurs
        },
        jobId: job.id,
      })
    }

    // Importer les données
    let successCount = 0
    let errorCount = 0
    const importErrors: string[] = [...errors]

    for (const rowData of rows) {
      try {
        // Créer ou récupérer la marque
        let brand = await prisma.brand.findUnique({
          where: { name: rowData.brandName },
        })

        if (!brand) {
          brand = await prisma.brand.create({
            data: {
              name: rowData.brandName,
              slug: rowData.brandName.toLowerCase().replace(/\s+/g, '-'),
              country: rowData.country || null,
              isActive: true,
            },
          })
        }

        // Créer le modèle (skip si existe déjà)
        const existingModel = await prisma.vehicleModel.findFirst({
          where: {
            brandId: brand.id,
            name: rowData.modelName,
          },
        })

        if (existingModel) {
          importErrors.push(
            `Row ${rowData.rowNumber}: Model ${rowData.modelName} already exists for brand ${rowData.brandName}`
          )
          errorCount++
          continue
        }

        await prisma.vehicleModel.create({
          data: {
            brandId: brand.id,
            name: rowData.modelName,
            slug: `${brand.slug}-${rowData.modelName.toLowerCase().replace(/\s+/g, '-')}`,
            category: (rowData.category || 'OTHER') as VehicleCategory,
            bodyType: (rowData.bodyType || 'SEDAN') as BodyType,
            fuelType: (rowData.fuelType || 'GASOLINE') as FuelType,
            transmission: (rowData.transmission || 'MANUAL') as TransmissionType,
            engineCapacity: rowData.engineCapacity || null,
            horsePower: rowData.horsePower || null,
            co2Emission: rowData.co2Emission || null,
            seats: rowData.seats || null,
            doors: rowData.doors || null,
            energyLabel: rowData.energyLabel ? (rowData.energyLabel as EnergyLabel) : null,
            isActive: true,
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
        errors: { errors: importErrors },
        completedAt: new Date(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'IMPORT',
        entityType: 'VehicleModel',
        entityId: job.id,
        changes: {
          fileName: file.name,
          totalRows: rows.length,
          successCount,
          errorCount,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} success, ${errorCount} errors`,
      jobId: job.id,
      summary: {
        totalRows: rows.length,
        successCount,
        errorCount,
        errors: importErrors.slice(0, 10), // Premiers 10 erreurs
      },
    })
  } catch (error) {
    console.error('Error importing OEM data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
