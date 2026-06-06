# Phase 11: Salesforce-Style Dynamic Profiles & Permissions Manager

This phase implements a Salesforce-style **Profiles & Permissions Manager** for the Enterprise Project Management System. It transitions permission management from a dynamic role model to a dedicated **Profile** concept, leaving organizational roles (`Admin`, `Project Manager`, `Member`) to determine system hierarchy while profiles dictate granular object and action-level permissions. 

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Changes**:
> This plan requires executing a database migration to add `Profile`, `ProfilePermission`, and `UserProfile` tables, as well as updating the `AuditLog` table schema to support Json data structures in SQLite. This is critical for single-tenant / multi-tenant boundary isolation and clean separation of roles from permissions.

> [!WARNING]
> **System Default Profiles Protection**:
> The system comes seeded with read-only profiles (`Admin Profile`, `Project Manager Profile`, `Member Profile`). These system profiles cannot be archived, and the `Admin Profile` permissions cannot be modified.

---

## Open Questions

> [!NOTE]
> 1. **Automatic Profile Assignation during User Registration**:
>    When a user registers or is invited, what Profile should they receive by default? We propose mapping:
>    * Role `Admin` -> `Admin Profile`
>    * Role `Project Manager` -> `Project Manager Profile`
>    * Role `Member` -> `Member Profile`
>    Any subsequent custom profiles (e.g., `Contractor`, `Auditor`) can be manually assigned by an administrator.
>
> 2. **Fallback Profile for Archiving**:
>    When a profile is archived, what default profile should the system fall back to for active users? We propose falling back to the standard `Member Profile`.

---

## Proposed Changes

### 1. Database Schema (Prisma)

We will introduce a dedicated Profile schema in the database.

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/schema.prisma)
* **Add Profile, ProfilePermission, and UserProfile Models**:
  ```prisma
  model Profile {
    id                 String              @id @default(uuid())
    name               String
    description        String?
    isSystem           Boolean             @default(false)
    version            Int                 @default(1)
    organizationId     String?             // Null for default global templates, or specific to an org
    organization       Organization?       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    createdAt          DateTime            @default(now())
    updatedAt          DateTime            @updatedAt
    deletedAt          DateTime?           // Nullable for Soft-Archiving
    profilePermissions ProfilePermission[]
    userProfiles       UserProfile[]

    @@unique([name, organizationId])
    @@map("profiles")
  }

  model ProfilePermission {
    profileId    String
    permissionId String
    profile      Profile    @relation(fields: [profileId], references: [id], onDelete: Cascade)
    permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

    @@id([profileId, permissionId])
    @@map("profile_permissions")
  }

  model UserProfile {
    userId    String   @unique
    profileId String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)

    @@id([userId, profileId])
    @@map("user_profiles")
  }
  ```
* **Update `AuditLog` Model**:
  Change `oldValue` and `newValue` types to `Json?` to support structured audit trails:
  ```prisma
  model AuditLog {
    // ...
    oldValue Json?
    newValue Json?
    // ...
  }
  ```
* **Update `User` Model**:
  Add relation to `UserProfile`:
  ```prisma
  model User {
    // ...
    userProfile UserProfile?
  }
  ```

---

### 2. Backend Modules (NestJS)

#### [MODIFY] [organization.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/organization/organization.controller.ts)
Expose Profile management, permission retrieval, archiving, cloning, and assignment endpoints:
* `GET /organization/permissions`
  * Retrieve all available permissions grouped by module/category.
* `GET /organization/profiles`
  * Retrieve all active (non-archived) profiles for the organization, including their permission mappings.
* `POST /organization/profiles`
  * Create a new custom profile. Takes `name` and `description` in body.
* `POST /organization/profiles/:id/archive`
  * Soft-archives a custom profile (sets `deletedAt` to current date). System profiles are rejected.
* `POST /organization/profiles/:profileId/clone`
  * Copies a profile's permissions and settings to a new profile. Takes `name` and `description` in body.
* `POST /organization/profiles/:profileId/permissions/:permissionId`
  * Add a permission to a profile. Validates dependencies.
* `DELETE /organization/profiles/:profileId/permissions/:permissionId`
  * Remove a permission from a profile. Validates dependencies (e.g. revoking `VIEW_TASK` also revokes `EDIT_TASK`).
* `PATCH /organization/members/:memberId/profile`
  * Assigns/reassigns a profile to an organization member.

#### [MODIFY] [organization.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/organization/organization.service.ts)
* **Permission Dependency Mapping**:
  Define a static map of permission dependencies (e.g. `EDIT_TASK -> VIEW_TASK`).
* **Validation logic**:
  Ensure that checking or unchecking a permission maintains valid combinations on profile update. Return a `BadRequestException` if validation fails.
* **Cloning implementation**:
  Read source profile permissions, insert identical mappings for the new profile, and generate a `PROFILE_CLONED` audit event.
* **Archiving logic**:
  Mark `deletedAt = new Date()`, then search for all users assigned to the archived profile and assign them to the standard `Member Profile`.
* **Profile Version Increment**:
  Any change to a profile's permissions increments its `version` column in the database.
* **Audit Logging**:
  Update `AuditService` calls to log `PROFILE_CREATED`, `PROFILE_UPDATED`, `PROFILE_ARCHIVED`, `PROFILE_CLONED`, `PERMISSION_GRANTED`, `PERMISSION_REVOKED`, `PROFILE_ASSIGNED`, `PROFILE_UNASSIGNED` with structured old/new values.

#### [MODIFY] [permissions.guard.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/auth/guards/permissions.guard.ts)
* Extract the `profileVersion` from the request user's JWT payload.
* Fetch the current version of the user's Profile from the database (optimized using a short-lived cache or memory lookup, or falling back to a quick Prisma read).
* If `jwtProfileVersion !== dbProfileVersion`, throw an `UnauthorizedException('OUTDATED_TOKEN')` to trigger the client-side axios interceptor token refresh.

#### [MODIFY] [auth.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/auth/auth.service.ts)
* **JWT payload updates**:
  Add `profileVersion` to the JWT Access Token inside `getTokens()`.
* **Seed update**:
  Update seed file logic to seed the read-only templates (`Auditor`, `Client`, `Stakeholder`, and default roles) with their corresponding profile definitions.

---

### 3. Frontend Integration (Next.js)

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/frontend/app/(dashboard)/settings/page.tsx)
Create the Salesforce-style Profiles & Permissions panel:
* **Sidebar Tab**: Add **Profiles & Permissions** tab.
* **Grouped Permissions Matrix**:
  * Instead of a single flat grid, group permissions by module (Project, Task, Issue, Milestone, Reports, Notification, Administration) into collapsible accordions.
  * Render the grid with Profiles on the Y-axis and grouped Permissions on the X-axis.
  * Handle dependency checks dynamically (e.g., if the user checks `EDIT_TASK`, automatically check `VIEW_TASK`; if they uncheck `VIEW_TASK`, automatically uncheck `EDIT_TASK`).
* **Clone & Archive Buttons**:
  * Action controls next to each profile name to clone (opens modal) or archive (shows verification pop-up).
* **Assign Profiles in Member Management**:
  * Update the **Member Management** table to allow admins to assign both a Role (hierarchy) and a Profile (permissions) via inline dropdowns.

#### [MODIFY] [api.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/frontend/services/api.ts)
* No direct modifications required, as the interceptor already intercepts all `401` responses, issues a `/auth/refresh` request, saves new tokens, and retries the request seamlessly! We will ensure that when NestJS returns `401 Unauthorized` for `OUTDATED_TOKEN`, the axios response interceptor behaves as expected.

---

## 4. Future Field-Level Security Readiness (Architecture Only)

To prepare for future iterations supporting dynamic security extensions:
* **Object-Level Permissions**: Defined in metadata mappings inside backend guard pipelines using decorators like `@ObjectPermissions({ project: ['READ', 'EDIT'] })`.
* **Field-Level Permissions**: Evaluated using NestJS interceptors that filter class serialization outputs (`ClassSerializerInterceptor`) based on active profile field accessibility.
* **Record-Level Sharing**: Query conditions built dynamically based on role/profile hierarchy bounds (e.g., adding user ownership or team member sub-clauses on runtime database queries).

No execution will take place for field/record security in this phase.

---

## Verification Plan

### Automated Tests
* Validate backend compilation and types:
  ```bash
  npm run build
  ```
* Validate Next.js build:
  ```bash
  next build
  ```

### Manual Verification
1. Navigate to settings, select the **Profiles & Permissions** tab.
2. Verify read-only templates (`Auditor`, `Client`, `Stakeholder`) are displayed and locked.
3. Uncheck `VIEW_TASK` for a custom profile. Verify `EDIT_TASK` is automatically unchecked (dependency validation).
4. Assign this profile to a member and verify their screen updates immediately (JWT token refresh triggered by `profileVersion` mismatch).
5. Clone the profile, verify permissions copy successfully, and verify audit records are created in the Audit Logs.
6. Archive the profile and verify that users are reassigned to the default profile.
