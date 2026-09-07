# Phase 12: Production Readiness Implementation Plan

This phase outlines the implementation plan for **Phase 12: Production Readiness** for the Enterprise Project Management System. It transitions the application database from SQLite to PostgreSQL, containerizes the entire stack under Docker (including Nginx reverse proxy and database backups), establishes environment validation, request logging, database indexes, CI/CD pipelines, security scanning, backup verification, and architectural readiness for cloud storage and monitoring.

---

## User Review Required

> [!IMPORTANT]
> **Database Transition (SQLite ➔ PostgreSQL)**:
> This plan transitions the datasource provider from SQLite to PostgreSQL. The current SQLite migration files under `backend/prisma/migrations` will be cleared, and a new initial PostgreSQL migration will be generated.
>
> **Separate Development & Production Seeding**:
> We will split the database seeding script into `seed.dev.ts` (with full demo data like projects and tasks) and `seed.prod.ts` (containing strictly system metadata, permissions, profiles, and roles). Production databases will be seeded with `seed.prod.ts` to ensure no test data enters production.
>
> **Public Entry Point via Nginx**:
> Traffic will no longer access Next.js or NestJS directly. An Nginx container will act as the single reverse proxy at the entry point of the container network, handling compression, headers, and routing.

---

## Open Questions

> [!NOTE]
> 1. **SSL Certificates for Nginx**:
>    For local localhost staging/testing, Nginx will operate on HTTP (port 80). For production, SSL certificates (e.g. Let's Encrypt) should be mounted into the Nginx container volumes.
>
> 2. **Object Storage Service Provider**:
>    Although we will not implement cloud file storage in this phase, we recommend **Cloudflare R2** or **AWS S3** as the target for production. Local disk storage will remain the active driver in this phase.

---

## Proposed Changes

### 1. Database Schema & Indexing (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/schema.prisma)
* Update the database provider block to PostgreSQL:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```
* Review and add structural database indexes (`@@index`) for high-frequency queries:
  * `TimeEntry`: index on `organizationId`, `userId`, `projectId`, `loggedAt`, `deletedAt`.
  * `Task`: index on `organizationId`, `projectId`, `milestoneId`, `status`, `deletedAt`.
  * `Issue`: index on `organizationId`, `projectId`, `status`, `deletedAt`.
  * `Notification`: index on `userId`, `read`, `createdAt`.
  * `AuditLog`: index on `organizationId`, `entityType`, `entityId`, `createdAt`.

#### [NEW] [seed.dev.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/seed.dev.ts)
* Development seeding script containing sample organizations, mock users, demo projects, tasks, comments, time entries, and reports data.

#### [NEW] [seed.prod.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/seed.prod.ts)
* Production seeding script containing only core roles (`Admin`, `Project Manager`, `Member`), default profiles (`Admin Profile`, `Project Manager Profile`, `Member Profile`), and default system permissions.

---

### 2. Backend Boot & Security Configuration (NestJS)

#### [MODIFY] [package.json](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/package.json)
* Add production dependencies:
  * `@nestjs/config` & `joi` (Environment Validation)
  * `@nestjs/throttler` (Rate Limiting)
  * `@nestjs/terminus` (Health Checks)
  * `helmet` (Security Headers)
  * `winston` & `winston-daily-rotate-file` (Logging)

#### [MODIFY] [main.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/main.ts)
* **Helmet Protection**: Configure Helmet middleware to secure responses with XSS, CSP, HSTS, and referrer headers.
* **CORS Settings**: Bound allowed origins dynamically to the verified `ALLOWED_ORIGINS` environment variables list.
* **Request Logger Middleware**: Integrate a global middleware to intercept incoming requests and log structured metadata.

#### [MODIFY] [app.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/app.module.ts)
* **Environment Validation Module**: Configure `ConfigModule` to run immediate startup validation using Joi schemas.
  * Validate: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV`, `PORT`.
  * Throw startup exceptions immediately if any parameters fail validation.
* **Rate Limiting**: Configure `ThrottlerModule` (e.g. limit clients to 100 requests/minute).

---

### 3. Request Logging & Health Checks (NestJS)

#### [NEW] [request-logger.middleware.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/common/middleware/request-logger.middleware.ts)
* Implement a NestJS request interceptor/middleware.
* Construct JSON log payloads containing metadata:
  ```json
  {
    "requestId": "uuid",
    "method": "POST",
    "path": "/time-entries",
    "userId": "user-uuid",
    "statusCode": 201,
    "responseTimeMs": 42,
    "ipAddress": "192.168.1.1"
  }
  ```

#### [NEW] [health.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/health/health.controller.ts)
* Implement health routes:
  * `GET /health`: Basic ping verifying NestJS process state.
  * `GET /health/ready`: Liveness/readiness check verifying connection status of database pool (via Prisma) and write permissions.

---

### 4. Infrastructure & Reverse Proxy Configuration

#### [NEW] [nginx.conf](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/nginx/nginx.conf)
* Configure Nginx:
  * Expose port `80` (public access).
  * Proxy `/api` path requests directly to NestJS server container (`http://backend:3000`).
  * Proxy root `/` paths to Next.js server container (`http://frontend:3001`).
  * Add compression configurations (Gzip).
  * Enforce headers: `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`.

#### [MODIFY] [docker-compose.yml](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/docker-compose.yml)
* Define production orchestration services:
  * **`nginx`**: Replaces exposed ports of other services, serving as public entrance.
  * **`postgres`**: Runs database, maps volumes to local storage. Adds standard container `healthcheck` verifying postgres readiness.
  * **`postgres-backup`**: Runs custom shell cron backups (`pg_dump`) exporting compressed backups to `/var/backups`.
  * **`backend`**: Adds dependent `healthcheck` ensuring PostgreSQL is ready, runs Prisma deployment migrations on startup, and launches NestJS.
  * **`frontend`**: Serves compiled Next.js output.

---

### 5. CI/CD Pipeline & Documentation Readiness

#### [NEW] [ci.yml](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/.github/workflows/ci.yml)
* GitHub Actions workflow triggered on pulls/pushes to master/main branches.
* Pipeline steps:
  1. Environment setup.
  2. Install dependencies (backend & frontend).
  3. Run linter and formatting checks.
  4. Run NestJS Unit Tests & E2E Integration tests.
  5. Run `npm audit` scanning node package dependencies.
  6. Attempt production builds of backend & frontend.
  7. Verify Docker container builds compile successfully.

#### [NEW] [backup_restore_guide.md](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/docs/backup_restore_guide.md)
* Step-by-step validation guide outlining:
  * Restoring from a `.sql.gz` database backup file.
  * Verifying database integrity and application startup.
  * Scheduling monthly test validations.

#### [NEW] [architecture_readiness.md](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/docs/architecture_readiness.md)
* Document designs outlining:
  * Cloud Object Storage strategy (Local Dev -> AWS S3/Cloudflare R2/MinIO production architecture).
  * Future Monitoring configuration (Prometheus scraping metrics endpoint, Grafana metrics visualizers, and Sentry exception capture integrations).

---

## Verification Plan

### Automated Tests
* Run unit and E2E test suites inside backend:
  ```bash
  cd backend
  npm run test
  npm run test:e2e
  ```
* Verify configuration validation:
  * Try starting NestJS backend with `DATABASE_URL` unset in `.env`, verify it crashes immediately.

### Manual Verification
1. Boot the stack under Docker Compose:
   ```bash
   docker-compose up --build -d
   ```
2. Check running status:
   ```bash
   docker-compose ps
   ```
3. Visit `http://localhost:80` (or `http://localhost` directly) to verify Nginx successfully serves the frontend, and requests to `/api` route through to the NestJS backend.
4. Access `http://localhost/api/health` and verify the status reports database connectivity as ready.
5. Verify winston log outputs capture JSON request metadata inside backend container log directories.
