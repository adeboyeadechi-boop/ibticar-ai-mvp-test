// Migration script to fix permission codes format
// Converts permission codes from dot notation (ai.recommendations) to colon notation (ai:recommendations)

import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting permission codes migration...')

  // Get all permissions
  const permissions = await prisma.permission.findMany()

  console.log(`Found ${permissions.length} permissions to check`)

  let updated = 0

  for (const permission of permissions) {
    if (permission.code.includes('.')) {
      const newCode = permission.code.replace(/\./g, ':')

      console.log(`Updating: ${permission.code} → ${newCode}`)

      await prisma.permission.update({
        where: { id: permission.id },
        data: { code: newCode }
      })

      updated++
    }
  }

  console.log(`\n✅ Migration complete! Updated ${updated} permissions`)
}

main()
  .catch((e) => {
    console.error('❌ Error during migration:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
