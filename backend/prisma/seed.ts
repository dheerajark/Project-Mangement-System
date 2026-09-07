import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as dotenv from 'dotenv';
import * as path from 'path';

const result = dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('dotenv load result:', result);

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const sqlitePath = dbUrl.replace(/^file:/, '').replace(/^\//, '');
console.log('dbUrl resolved:', dbUrl);
console.log('sqlitePath resolved:', sqlitePath);
console.log('cwd:', process.cwd());
const adapter = new PrismaLibSql({ url: `file:${sqlitePath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    console.log('Environment: PRODUCTION. Launching production database seed...');
    const { seedProduction } = require('./seed.prod');
    await seedProduction(prisma);
  } else {
    console.log('Environment: DEVELOPMENT. Launching development sandbox database seed...');
    const { seedDevelopment } = require('./seed.dev');
    await seedDevelopment(prisma);
  }
}

main()
  .catch((e) => {
    console.error('Seeding router failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
