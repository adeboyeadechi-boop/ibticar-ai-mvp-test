#!/bin/bash
# Test script for full seed (with TRUNCATE)

echo "================================================"
echo "  Testing Full Seed (with TRUNCATE)"
echo "================================================"
echo ""
echo "⚠️  WARNING: This will DELETE ALL data in your database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "🔧 Generating Prisma Client..."
npx prisma generate

echo ""
echo "📊 Applying migrations..."
npx prisma migrate deploy

echo ""
echo "🌱 Running full seed (with TRUNCATE)..."
npx prisma db seed

echo ""
echo "================================================"
echo "  Seed completed!"
echo "================================================"
echo ""
echo "Test accounts (password: Password123!):"
echo "  - superadmin@ibticar.ai (SUPER_ADMIN)"
echo "  - admin@ibticar.ai (ADMIN)"
echo "  - manager@dealer.com (MANAGER)"
echo "  - commercial@dealer.com (SALES)"
echo "  - user@dealer.com (USER)"
echo ""
echo "You can now test with: npm run dev"
echo ""
