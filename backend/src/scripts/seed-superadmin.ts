/**
 * Seed Script — Create SUPER_ADMIN user.
 * 
 * Usage (development):
 *   npx ts-node src/scripts/seed-superadmin.ts
 * 
 * Usage (Docker/production):
 *   node dist/scripts/seed-superadmin.js
 * 
 * Environment variables (optional, falls back to defaults):
 *   SUPER_ADMIN_EMAIL    — default: superadmin@abdashboard.com
 *   SUPER_ADMIN_PASSWORD — default: SuperAdmin123!
 *   SUPER_ADMIN_NAME     — default: Super Admin
 * 
 * This script is idempotent: if the email already exists, it skips creation.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@abdashboard.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + crypto.randomBytes(3).toString('hex');
}

async function main() {
  console.log('🔐 Seeding SUPER_ADMIN user...');
  console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);

  // Check if super admin already exists
  const existing = await prisma.user.findFirst({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existing) {
    console.log('⚠️  User dengan email ini sudah ada. Skip.');
    console.log(`   Role: ${existing.role}`);
    if (existing.role !== 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'SUPER_ADMIN' },
      });
      console.log('   ✅ Role diupdate ke SUPER_ADMIN');
    }
    return;
  }

  // Create organization for super admin
  const organization = await prisma.organization.create({
    data: {
      name: 'Platform Admin',
      slug: generateSlug('platform-admin'),
      plan: 'ENTERPRISE',
      is_active: true,
    },
  });
  console.log(`   ✅ Organization created: ${organization.name} (${organization.id})`);

  // Hash password
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  // Create super admin user
  const user = await prisma.user.create({
    data: {
      organization_id: organization.id,
      email: SUPER_ADMIN_EMAIL,
      password_hash: passwordHash,
      name: SUPER_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      is_active: true,
      email_verified_at: new Date(),
    },
  });

  console.log(`   ✅ SUPER_ADMIN created: ${user.name} (${user.id})`);
  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Email:    ${SUPER_ADMIN_EMAIL}`);
  console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  SEGERA GANTI PASSWORD setelah login pertama!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
