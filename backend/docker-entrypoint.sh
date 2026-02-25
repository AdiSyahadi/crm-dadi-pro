#!/bin/sh
set -e

echo "🔄 Running Prisma db push (sync schema to database)..."
npx prisma db push --url "$DATABASE_URL" --accept-data-loss 2>&1 || {
  echo "⚠️ Prisma db push failed, retrying in 5s..."
  sleep 5
  npx prisma db push --url "$DATABASE_URL" --accept-data-loss
}
echo "✅ Database schema synced"

echo "🚀 Starting Power WA backend..."
exec node dist/server.js
