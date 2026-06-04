# Phase 1.5: Multi-Tenant Foundation & Organization Security

This phase updates the application architecture to support multi-tenancy. It ensures strict data isolation by Organization (tenant) using the user's tenant context from the validated JWT payload, while preserving the existing Role-Based Access Control (RBAC) system for application authorization.

---

## User Review Required

> [!IMPORTANT]
> **Existing RBAC Preserved**:
> The existing authorization architecture (`UserRole`, `Role`, `RolePermission`, `Permission`) remains untouched and will be the source of truth for user permissions (e.g. `MANAGE_USERS`, `CREATE_PROJECT`, `INVITE_MEMBERS`).
> Membership in an organization (`OrganizationMember`) is separated from authorization (RBAC).

> [!IMPORTANT]
> **Database Reset / Migration**:
> Because the `User` model will now require a mandatory `organizationId` relation (no users without an organization), the existing local SQLite database will need to be reset during migration. We will update the seed script to create a default organization ("Default Org") and link the seeded roles and default admin to it.

---

## Proposed Changes

---

### 1. Database Schema & Migration (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
We will add multi-tenant tables and update `User`, preserving the RBAC models.

- **[KEEP]**: `Role`, `Permission`, `UserRole`, `RolePermission`.
- **[NEW] Organization**: Added `deletedAt` for soft deletes.
- **[NEW] OrganizationSettings**: Contains settings like `theme`, `allowedEmailDomains`, `timezone`, `dateFormat`, `language`, and `currency`.
- **[NEW] OrganizationMember**: Tracks user membership status (`ACTIVE`, `SUSPENDED`, `INVITED`), `joinedAt`, and `deletedAt` for soft deletes.
- **[NEW] Invitation**: Tracks `tokenHash` (SHA-256 hashed token), `invitedBy` (userId), `acceptedAt`, `expiresAt`, and `deletedAt`.
- **[NEW] AuditLog**: Tracks `organizationId`, `userId`, `entityType`, `entityId`, `action`, `oldValue` (JSON), and `newValue` (JSON). Audit logs are never deleted.
- **[MODIFY] User**: Added mandatory `organizationId` and `deletedAt` for soft deletes.

#### [MODIFY] [seed.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/seed.ts)
- Update seed script to create a default Organization ("Default Org") and its default settings.
- Seed roles (`Admin`, `Project Manager`, `Member`) and permissions.
- Create default Admin user, linking them to "Default Org" via `organizationId` and creating their `OrganizationMember` membership record.
- Assign the `Admin` role to user via `UserRole`.

---

### 2. Backend Modules & Security (NestJS)

We will modify the NestJS authentication module and implement tenant context mapping.

#### [NEW] [tenant-id.decorator.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/auth/decorators/tenant-id.decorator.ts)
- Custom decorator `@TenantId()` to quickly retrieve `req.user.organizationId` from the request.

#### [MODIFY] [jwt.strategy.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/auth/strategies/jwt.strategy.ts)
- Update `JwtPayload` structure to include `organizationId`.

#### [MODIFY] [auth.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/auth/auth.service.ts)
- Update registration:
  1. Create the `Organization`.
  2. Create the `OrganizationSettings` for that Organization.
  3. Create the `User` linked to the Organization.
  4. Create the `OrganizationMember` record for the user (status: `ACTIVE`).
  5. Assign the `Admin` role to the user via `UserRole`.
  6. Return signed tokens (JWT payload includes `organizationId`).

#### [NEW] [organization/](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/organization)
Create an Organization module to handle:
- Organization Settings management (viewing/updating settings).
- Member management (list members, update status, soft delete).

#### [NEW] [invitation/](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/invitation)
Create an Invitation module to handle:
- **Inviting User**: Restricts invitation to users with the `INVITE_MEMBERS` permission.
- **Token Generation**: Generates a secure random raw token, computes its SHA-256 hash, and saves the hash in `tokenHash` in the database.
- **Accepting Invitation**:
  1. Verify invitation by hashing incoming token and querying `Invitation` with valid expiration/status.
  2. Create the `User` linked to the inviter's `organizationId`.
  3. Create their `OrganizationMember` record (status: `ACTIVE`).
  4. Assign the requested `Role` via `UserRole`.
  5. Mark the invitation as accepted (`acceptedAt`, status: `ACCEPTED`).

#### [NEW] [audit/](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/audit)
Create an Audit Logging service:
- Log actions such as user status changes, setting updates, etc., capturing `oldValue` and `newValue` as JSON.
- Expose a readonly query service (audit logs are never deleted).

---

### 3. Frontend Integration (Next.js)

#### [MODIFY] [useAuth.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/hooks/useAuth.ts)
- Update `UserPayload` to include `organizationId`.
- Add invitation acceptance mutation hook.

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(auth)/accept-invite/page.tsx)
- Onboarding page UI (sets name and password to join organization).

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/settings/page.tsx)
- Organization Settings UI and member manager.

---

## Verification Plan

### Automated Tests
- Database reset and schema migrations:
  ```bash
  npx prisma migrate dev --name add_multitenancy
  ```
- Run seed verification:
  ```bash
  npx prisma db seed
  ```
- Run test suites for authentication:
  ```bash
  npm run test
  ```

### Manual Verification
1. **JWT Inspection**:
   - Register a new organization and inspect the returned JWT access token using a tool or debugger to verify the presence of `organizationId`.
2. **Tenant Isolation Check**:
   - Register two different users in two different organizations.
   - Verify that they cannot view or access each other's data (e.g. audit logs or settings) by testing endpoints.
3. **Invitation Onboarding & Token Hashing**:
   - As an Admin, invite a new email. Copy the invitation token from the terminal output (as the database only stores the SHA-256 hash).
   - Verify that trying to onboard using an incorrect token returns a validation error.
   - Onboard using the correct token and verify they join the correct organization with the assigned role.
4. **Soft Delete Verification**:
   - Delete a member and verify they are marked with `deletedAt` and cannot log in, but the database record is preserved.
5. **Enforce Allowed Email Domains & Theme Switch**:
   - Update Settings theme to Light and verify live UI change.
   - Set allowed email domains and verify that domains are validated during invitation creation.
