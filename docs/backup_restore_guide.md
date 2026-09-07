# PostgreSQL Backup & Restore Verification Guide

This guide details the procedure for executing, verifying, and testing database backups and restore operations for the Enterprise Project Management System.

---

## 1. Automated Backups Overview

Automated daily backups are created by the `postgres-backup` container and stored inside the `pgbackup` volume. The files are outputted in `.sql.gz` format:

* **Storage Path (inside container)**: `/var/backups`
* **File Naming Pattern**: `backup-YYYY-MM-DD-HHMMSS.sql.gz`

---

## 2. Manual Backup Creation

To manually trigger a backup from the running `postgres` container without waiting for the automated 24-hour interval:

```bash
docker exec -t pms_postgres pg_dump -U postgres -d project_management_system | gzip > ./backup-manual-$(date +%Y-%m-%d).sql.gz
```

---

## 3. Database Restoration Procedure

Follow these steps to restore a backup to the PostgreSQL database.

> [!WARNING]
> Restoring a database will overwrite the existing database schema and data. Ensure you have backed up any critical current data before proceeding.

### Step 1: Identify the Backup File
Locate the desired backup file in the local backup volume directory or mount. For example: `./backups/backup-2026-06-07-230000.sql.gz`.

### Step 2: Clear/Recreate the Active Database
Before restoring, it is safest to drop and recreate the active schema to ensure no conflicts with existing records:

```bash
# Connect to PostgreSQL and drop/recreate database
docker exec -it pms_postgres psql -U postgres -c "DROP DATABASE IF EXISTS project_management_system;"
docker exec -it pms_postgres psql -U postgres -c "CREATE DATABASE project_management_system;"
```

### Step 3: Run the Restore Command
Decompress and pipe the backup file directly into the `psql` shell of the database container:

```bash
# On Linux/macOS
gunzip -c ./backups/backup-2026-06-07-230000.sql.gz | docker exec -i pms_postgres psql -U postgres -d project_management_system

# On Windows PowerShell
7z e ./backups/backup-2026-06-07-230000.sql.gz -so | docker exec -i pms_postgres psql -U postgres -d project_management_system
```

---

## 4. Verification & Integrity Audits

After restoring a backup, perform these verification checks to confirm data integrity:

### 1. Row Count Check
Query key tables to ensure records match expectations:
```bash
docker exec -it pms_postgres psql -U postgres -d project_management_system -c "SELECT COUNT(*) FROM users;"
docker exec -it pms_postgres psql -U postgres -d project_management_system -c "SELECT COUNT(*) FROM projects;"
```

### 2. NestJS Application Liveness
Check that the backend starts up correctly and establishes its connection:
```bash
docker compose logs backend
```
Access the readiness health route:
```http
GET http://localhost/api/health/ready
```
Verify it returns:
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

---

## 5. Monthly Staging Drill Schedule

To guarantee that your backups are reliable, run a restore drill on a staging or test environment on the **1st of every month**:

1. Boot a clean Postgres instance inside a temporary container.
2. Restore the latest backup file onto it.
3. Run the Prisma schema verification:
   ```bash
   npx prisma db validate
   ```
4. Verify that user login and token generation function correctly against the restored database.
5. Log the validation date, backup file size, and success status in the operations log.
