import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let isDatabaseOnline = false;

  beforeAll(async () => {
    jest.setTimeout(30000);
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean tables and seed required roles
    try {
      await prisma.$executeRawUnsafe('SELECT 1;');
      isDatabaseOnline = true;
      await prisma.$executeRawUnsafe('TRUNCATE TABLE users, roles, organizations CASCADE;');
      await prisma.role.createMany({
        data: [
          { name: 'Admin' },
          { name: 'Project Manager' },
          { name: 'Member' },
        ],
      });
    } catch (e) {
      console.warn('E2E database cleaning/seeding skipped (DB not running/accessible).', e.message);
    }
  });

  afterAll(async () => {
    try {
      if (isDatabaseOnline) {
        await prisma.$executeRawUnsafe('TRUNCATE TABLE users, roles, organizations CASCADE;');
      }
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user and organization', async () => {
      if (!isDatabaseOnline) {
        console.warn('Skipping E2E validation assertion: database is offline.');
        return;
      }
      const payload = {
        email: 'test_e2e@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'E2E',
        organizationName: 'E2E Organization',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });

    it('should return 403 if user already exists', async () => {
      if (!isDatabaseOnline) {
        return;
      }
      const payload = {
        email: 'test_e2e@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload);

      expect(response.status).toBe(403);
    });
  });
});
