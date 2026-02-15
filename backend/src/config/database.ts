import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function parseDatabaseUrl(url: string) {
  // Parse: mysql://user:pass@host:port/database
  const match = url.match(/mysql:\/\/([^:]*):?([^@]*)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1] || 'root',
    password: match[2] || '',
    host: match[3] || 'localhost',
    port: parseInt(match[4] || '3306', 10),
    database: match[5] || 'crm_dadi',
  };
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || 'mysql://root:@localhost:3306/crm_dadi');

const adapter = new PrismaMariaDb({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 10,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    // Test connection by running a simple query
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('✅ Database connected (MySQL via XAMPP)');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}
