#!/bin/sh

MAX_RETRIES=3
RETRY_COUNT=0

echo "🔄 Running Prisma db push (sync schema to database)..."
until npx prisma db push --url "$DATABASE_URL" --accept-data-loss 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "❌ Prisma db push failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "⚠️ Prisma db push failed (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in 5s..."
  sleep 5
done
echo "✅ Database schema synced"

# Seed subscription plans (idempotent)
echo "🌱 Seeding subscription plans..."
node dist/scripts/seed-plans.js 2>&1 || echo "⚠️ Seed plans skipped/failed"

# Seed super admin jika belum ada (idempotent)
echo "🔐 Seeding super admin..."
node dist/scripts/seed-superadmin.js 2>&1 || echo "⚠️ Seed super admin skipped/failed"

echo "🚀 Starting Power WA backend..."
exec node dist/server.js
