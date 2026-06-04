# Phase 4: Task Management - Revised Implementation Plan

This phase implements the Task Management module inside the Enterprise Project Management System. It establishes tasks scoped to projects, sequential task numbering using a project-level sequence counter, direct organization references for faster reporting, task categorization (Task, Bug, Story, Improvement), estimation fields, comments, attachment metadata, categorization labels, dedicated status transitions, task-level activity feeds, and task watchers under multi-tenant constraints.

---

## User Review Required

> [!IMPORTANT]
> **Prisma Enums for Tasks**:
> We will add native Prisma enums `TaskStatus`, `TaskPriority`, and `TaskType` to enforce categorization boundaries.
> 
> **Sequential Task Identifiers**:
> Tasks will be numbered sequentially *per project* (e.g., `COR-1`, `COR-2`). This relies on a project-level sequence counter `nextTaskNumber` to guarantee unique sequential identifiers and avoid race conditions.
>
> **Project Membership Validation**:
> Before assigning a task, the system will explicitly validate that the assignee is a member of the project (`ProjectMember`) and belongs to the same organization. Mismatches will return `403 Forbidden`.

> [!WARNING]
> **Audit Logging Enhancements**:
> We will add optional `projectId` and `taskId` fields directly to the `AuditLog` table structure to support fast indexing of project/task-level operations.

---

## Open Questions

> [!WARNING]
> 1. **Delete Tasks vs Archiving**:
>    Tasks will not be physically deleted. Instead, the permission `DELETE_TASK` is replaced by `ARCHIVE_TASK`. The deletion route is replaced by `POST /tasks/:id/archive`, freezing state while preserving all comments, attachment records, and time logs.
> 2. **Status Transition Restrictions**:
>    A dedicated `PATCH /tasks/:id/status` endpoint will enforce the following transitions (which can be expanded later):
>    - `TODO` -> `IN_PROGRESS`
>    - `IN_PROGRESS` -> `REVIEW`
>    - `REVIEW` -> `DONE`
>    - `Any State` -> `BLOCKED`

---

## Proposed Changes

### 1. Database Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
Add native enums, task-level fields to existing models, and new models.

- **[NEW] Enums**:
  ```prisma
  enum TaskStatus {
    TODO
    IN_PROGRESS
    REVIEW
    DONE
    BLOCKED
  }

  enum TaskPriority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum TaskType {
    TASK
    BUG
    STORY
    IMPROVEMENT
  }
  ```
- **[MODIFY] Project**:
  - Add `nextTaskNumber: Int @default(1)`
- **[MODIFY] AuditLog**:
  - Add optional `projectId: String?` and `taskId: String?`
- **[NEW] Task**:
  - `id`: String @id @default(uuid())
  - `title`: String
  - `description`: String?
  - `taskNumber`: Int
  - `status`: TaskStatus @default(TODO)
  - `priority`: TaskPriority @default(MEDIUM)
  - `type`: TaskType @default(TASK)
  - `estimatedHours`: Float?
  - `dueDate`: DateTime?
  - `projectId`: String
  - `project`: Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  - `organizationId`: String
  - `organization`: Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  - `assigneeId`: String?
  - `assignee`: User? @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  - `reporterId`: String?
  - `reporter`: User? @relation("TaskReporter", fields: [reporterId], references: [id], onDelete: SetNull)
  - `createdAt`: DateTime @default(now())
  - `updatedAt`: DateTime @updatedAt
  - `deletedAt`: DateTime?
  - Relations: `comments`: TaskComment[], `attachments`: TaskAttachment[], `watchers`: TaskWatcher[], `activities`: TaskActivity[], `labels`: TaskLabelMapping[]
- **[NEW] TaskLabel**:
  - `id`: String @id @default(uuid())
  - `name`: String
  - `color`: String
  - `organizationId`: String
  - `organization`: Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
- **[NEW] TaskLabelMapping**:
  - Join table for Task <=> TaskLabel relation.
- **[NEW] TaskComment**:
  - `id`: String @id @default(uuid())
  - `taskId`: String
  - `userId`: String
  - `content`: String
  - `organizationId`: String
  - `createdAt`: DateTime @default(now())
  - `updatedAt`: DateTime @updatedAt
  - `deletedAt`: DateTime?
- **[NEW] TaskAttachment**:
  - `id`: String @id @default(uuid())
  - `taskId`: String
  - `fileName`: String
  - `fileUrl`: String
  - `fileSize`: Int
  - `uploadedById`: String
  - `organizationId`: String
  - `createdAt`: DateTime @default(now())
- **[NEW] TaskWatcher**:
  - `id`: String @id @default(uuid())
  - `taskId`: String
  - `userId`: String
  - `createdAt`: DateTime @default(now())
- **[NEW] TaskActivity**:
  - `id`: String @id @default(uuid())
  - `taskId`: String
  - `userId`: String
  - `action`: String
  - `oldValue`: String?
  - `newValue`: String?
  - `createdAt`: DateTime @default(now())

---

### 2. Backend Task Module (NestJS)

Create the task module under `backend/src/task/`.

#### [NEW] [task.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/task/task.module.ts)
- Connect controller, service, Prisma, and Audit modules.

#### [NEW] [task.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/task/task.controller.ts)
Expose the endpoints secured by `AccessTokenGuard` and `PermissionsGuard`:
- `POST /tasks`: Create task (Requires `CREATE_TASK` permission).
- `GET /projects/:projectId/tasks`: Get all tasks under a project (Requires `VIEW_TASK`).
- `GET /tasks/:id`: Get task details, comments, activities, and attachments (Requires `VIEW_TASK`).
- `PATCH /tasks/:id`: Update task properties (Requires `EDIT_TASK`).
- `PATCH /tasks/:id/status`: Update status only with state transitions validation.
- `POST /tasks/:id/archive`: Archive task (Requires `ARCHIVE_TASK` permission).
- `POST /tasks/:id/comments`: Add comment (Requires `VIEW_TASK`).
- `POST /tasks/:id/attachments`: Upload attachment metadata (Requires `EDIT_TASK`).

#### [NEW] [task.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/task/task.service.ts)
- **Assignee Membership Validation**: Before assigning, ensure the assignee is in `ProjectMember` and shares the same `organizationId`. Throw `403 Forbidden` on mismatch.
- **Race-Condition-Safe Task Code Generation**: Create task inside Prisma `$transaction`:
  1. Lock/read the Project details.
  2. Assign current `nextTaskNumber` value to task `taskNumber`.
  3. Increment project `nextTaskNumber` by 1.
  4. Create `Task` and record `TaskActivity` entry for `TASK_CREATED`.
- **Status Update Validation**: Verify incoming transition states:
  - Allow `TODO` -> `IN_PROGRESS`, `IN_PROGRESS` -> `REVIEW`, `REVIEW` -> `DONE`, or any state -> `BLOCKED`.
  - Log `TaskActivity` status transition.
- **Audit Logging**: Write audit entries for `TASK_CREATED`, `TASK_UPDATED`, `TASK_ARCHIVED`, `TASK_STATUS_CHANGED`, `TASK_ASSIGNEE_CHANGED`, `TASK_COMMENT_ADDED`, and `TASK_ATTACHMENT_UPLOADED`. Ensure each log includes `organizationId`, `projectId`, `taskId`, and `userId`.

---

### 3. Frontend Task Views (Next.js)

Integrate tasks as a sub-panel in Project Details.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/projects/[id]/page.tsx)
- Add a **Tasks tab** alongside Project Members.
- Renders task cards with visual indicators of priority, type, estimated hours, and status.
- Add "Add Task" button (if user has `CREATE_TASK`).

#### [NEW] [task-detail-drawer.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/task-detail-drawer.tsx)
- Sliding panel that opens when clicking a task:
  - Details: Form to update status, type, priority, estimated hours, description, assignee. Disables inputs if task is archived.
  - Comments: Timeline displaying user comments with a post input.
  - Attachments: Upload panel (respects project setting `allowFileUploads`) to add mock attachments.
  - Watchers widget: Basic watcher follow/unfollow capability.
  - Activity feed: Timeline displaying task activities (e.g. status changes, assignee changes).

---

## Verification Plan

### Automated Tests
- Schema migration and Client regeneration:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npx-cli.js" prisma migrate dev --name add_tasks
  ```
- Run NestJS test suites:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npm-cli.js" run test
  ```

### Manual Verification
1. **Race-Condition-Safe Sequence Test**: Create multiple tasks in rapid succession. Verify task codes increments strictly from `1` (e.g. `NSK-1`, `NSK-2`, `NSK-3`).
2. **Access Control**: Attempt to assign a user who is not a member of the project, or is from another organization. Verify `403 Forbidden` response.
3. **Status Transitions**: Drag cards or trigger state changes (e.g., `TODO` -> `REVIEW`). Verify that illegal transitions are blocked and valid transitions are allowed and log `TaskActivity` entry.
4. **Archiving Flow**: Archive a task. Verify status is locked and editing is disabled while history (comments, attachments) remains visible.
