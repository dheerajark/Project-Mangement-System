# Phase 3: Project Module - Revised Implementation Plan

This revised phase implements the Projects, Project Settings, and Project Membership system inside the Enterprise Project Management System. It establishes enum-based fields, visibility scopes (Private vs Organization), automated code generation, and project archiving instead of hard deletes under transaction-safe multi-tenant constraints.

---

## User Review Required

> [!IMPORTANT]
> **Prisma Enums**:
> We will add native Prisma enums `ProjectStatus`, `ProjectMemberRole`, and `ProjectVisibility` to improve type safety and validation constraints.
> 
> **Database Seed Updates**:
> The permission `DELETE_PROJECT` will be renamed to `ARCHIVE_PROJECT` in [seed.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/seed.ts). A database migration will be run to register this change.

> [!IMPORTANT]
> **Project Visibility Rules**:
> - **PRIVATE**: Only users in the `ProjectMember` table can view/access the project.
> - **ORGANIZATION**: Any user belonging to the same organization (`organizationId`) can view/access the project, even if they are not explicitly in the `ProjectMember` table.
> - Tenant isolation strictly bounds both visibility scopes.

---

## Open Questions

> [!WARNING]
> 1. **Project Code Generation Logic**: How should the `projectCode` be formatted? We propose using the first three letters of the project name (uppercased) followed by a sequential number scoped to the organization (e.g. `NSK-001`, `NSK-002`). If the project name is too short, we'll pad it (e.g. `PRO-001`).
> 2. **Archived Project Actions**: Archived projects will be searchable and visible, but all modifications (updates, member additions/removals) will be blocked.

---

## Proposed Changes

---

### 1. Database Schema & Migration (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
We will add new models, fields, and enums, preserving the RBAC tables.

- **[NEW] Enums**:
  ```prisma
  enum ProjectStatus {
    PLANNING
    ACTIVE
    COMPLETED
    ARCHIVED
  }

  enum ProjectMemberRole {
    OWNER
    MANAGER
    MEMBER
  }

  enum ProjectVisibility {
    PRIVATE
    ORGANIZATION
  }
  ```
- **[MODIFY] Project**:
  - `status`: `ProjectStatus` @default(ACTIVE)
  - `visibility`: `ProjectVisibility` @default(PRIVATE)
  - `projectCode`: String @unique
  - `settings`: `ProjectSettings?`
  - All other fields (`id`, `name`, `description`, `startDate`, `endDate`, `organizationId`, `ownerId`, `createdAt`, `updatedAt`, `deletedAt`) remain.
- **[NEW] ProjectSettings**:
  - `id`: String (UUID), Primary Key
  - `projectId`: String @unique
  - `allowTimeTracking`: Boolean @default(true)
  - `allowIssueTracking`: Boolean @default(true)
  - `allowFileUploads`: Boolean @default(true)
  - `createdAt`: DateTime (default: now)
  - `updatedAt`: DateTime (updatedAt)
- **[MODIFY] ProjectMember**:
  - `role`: `ProjectMemberRole` @default(MEMBER)
  - `addedBy`: String? (Tracks the userId of the user who added this member)
- **[MODIFY] seed.ts**:
  - Rename `DELETE_PROJECT` permission to `ARCHIVE_PROJECT` in the seeded permissions list and PM role mapping.

---

### 2. Backend Project Module (NestJS)

Create the project module under `backend/src/project/`.

#### [NEW] [project.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/project/project.module.ts)
- Register controllers, services, and export `ProjectService`.

#### [NEW] [project.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/project/project.controller.ts)
Expose the following endpoints protected by `AccessTokenGuard` and `PermissionsGuard`:
- `POST /projects`: Create a project (Requires `CREATE_PROJECT` permission).
- `GET /projects`: List all accessible projects in the organization. Scoped by:
  - User's `organizationId` AND (project `visibility` = `ORGANIZATION` OR user is in `ProjectMember`).
- `GET /projects/:id`: Fetch project details and members (Requires membership or `ORGANIZATION` visibility, and `VIEW_PROJECT` permission).
- `PATCH /projects/:id`: Update project details (Requires `EDIT_PROJECT` permission). Blocks edits if status is `ARCHIVED`.
- `POST /projects/:id/archive`: Archive a project (Requires `ARCHIVE_PROJECT` permission. Sets status to `ARCHIVED`).
- `POST /projects/:id/members`: Add a user to a project (Requires `EDIT_PROJECT` permission).
- `DELETE /projects/:id/members/:userId`: Remove a member from a project (Requires `EDIT_PROJECT` permission).

#### [NEW] [project.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/project/project.service.ts)
- **Cross-Tenant Validation**: Before adding a member to a project, explicitly check that the target user's `organizationId` matches the project's `organizationId`. Throw `403 Forbidden` if they differ.
- **Transaction-Safe Project Creation Workflow**:
  Create the project inside a single Prisma transaction:
  1. Generate `projectCode` (calculate sequential number).
  2. Create `Project` with code, visibility, and status.
  3. Create `ProjectSettings` default record linked to the project.
  4. Add the creator user as a `ProjectMember` with role `OWNER`.
  5. Log the action using `AuditService` with action `PROJECT_CREATED`.

- **Audit Logs Creation**:
  Create detailed audit logs for:
  - `PROJECT_CREATED`
  - `PROJECT_UPDATED`
  - `PROJECT_ARCHIVED` (triggered during archiving instead of physical delete)
  - `PROJECT_MEMBER_ADDED`
  - `PROJECT_MEMBER_REMOVED`

---

### 3. Frontend Integration (Next.js)

We will integrate Projects inside the main dashboard interface.

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/projects/page.tsx)
Create a premium dashboard panel:
- **Projects Grid**: Displays projects with Code, Status, Owner, Visibility, and dates. Shows "Archived" badge and hides edit actions on archived items.
- **Create Project Modal**: Form containing Name, Description, Start/End Dates, and Visibility selectors.

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/projects/[id]/page.tsx)
Detailed view page for a specific project:
- **Simplified Project Info**: Displays Project Name, Project Code, Status, Owner, Visibility, Start/End Date, and Settings toggles.
- **Members Widget**: Lists members, shows roles (`OWNER`, `MANAGER`, `MEMBER`), and tracks who added them (`addedBy`).
- **Archive Action**: Accessible button to Archive project (for users holding `ARCHIVE_PROJECT`). Disables updates if project is archived.
- Note: Progress metrics, tasks, and timesheets widgets are deferred to future phases.

---

## Verification Plan

### Automated Tests
- Database migrations and Client regeneration:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npx-cli.js" prisma migrate dev --name add_projects
  ```
- Run unit/integration tests:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npm-cli.js" run test
  ```

### Manual Verification
1. **Allowed Domain / Isolation Test**:
   - Create a project in Org A. Attempt to add a user from Org B to the project.
   - Verify that the backend throws a `403 Forbidden` error.
2. **Project Visibility Test**:
   - Create a `PRIVATE` project in Org A. Login as another user in Org A who is not in `ProjectMember`. Verify they cannot view/list it.
   - Change project visibility to `ORGANIZATION`. Verify that the other user can now list and view it.
3. **Archiving Flow**:
   - Archive a project. Verify status is `ARCHIVED`.
   - Attempt to add a member or edit fields, and verify the backend blocks it with an error.
4. **Seeding Validation**:
   - Seed database and verify the permission `ARCHIVE_PROJECT` exists instead of `DELETE_PROJECT`.
