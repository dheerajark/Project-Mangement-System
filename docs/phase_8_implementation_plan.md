# Phase 8: Issue/Bug Tracking - Implementation Plan

This phase implements the **Issue/Bug Tracking Module** for the Enterprise Project Management System. It introduces bug lifecycles, severity/priority classifications, reporter and assignee tracking, issue discussion comment feeds, activity logging, and soft-archiving across both backend and frontend.

---

## User Review Required

> [!IMPORTANT]
> **Separate Sequence Counter**:
> We propose introducing a separate `nextIssueNumber Int @default(1)` counter on the `Project` model. This allows issues to have a dedicated numbering sequence (e.g. `PROJ-ISSUE-1`, `PROJ-ISSUE-2`) separate from standard tasks.
>
> **Task-to-Issue Association**:
> We propose adding an optional relationship between `Issue` and `Task` (`taskId`). This allows developers to link a bug to the specific task or story that addresses it.
>
> **Soft Archiving & Permissions**:
> True to our recent design updates, issues will support soft-archiving:
> * Permission `ARCHIVE_ISSUE` will be used instead of `DELETE_ISSUE`.
> * Soft-archived issues (where `deletedAt != null`) are hidden from active filters but retained in history.
> * Other permissions introduced: `CREATE_ISSUE`, `VIEW_ISSUE`, `EDIT_ISSUE`, `COMMENT_ISSUE`.

---

## Open Questions

> [!NOTE]
> 1. **Issue State Transitions**:
>    Should we enforce specific transitions on `IssueStatus` (e.g., `OPEN` can only transition to `ASSIGNED` or `RESOLVED`, only reporters can transition to `CLOSED`) or allow free updates like priority/severity?
>    * *Our recommendation*: We suggest a flexible state model for the MVP while logging status transition history in `IssueActivity`.

---

## Proposed Changes

### 1. Database Schema & Migration

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/schema.prisma)
* Add status and classification enums:
  ```prisma
  enum IssueStatus {
    OPEN
    ASSIGNED
    IN_PROGRESS
    RESOLVED
    CLOSED
    REOPENED
  }

  enum IssuePriority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum IssueSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }
  ```
* Add the `Issue` model with relations and unique constraint:
  ```prisma
  model Issue {
    id             String        @id @default(uuid())
    title          String
    description    String?
    issueNumber    Int
    status         IssueStatus   @default(OPEN)
    priority       IssuePriority @default(MEDIUM)
    severity       IssueSeverity @default(MEDIUM)
    
    projectId      String
    project        Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
    
    organizationId String
    organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    
    assigneeId     String?
    assignee       User?         @relation("IssueAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
    
    reporterId     String?
    reporter       User?         @relation("IssueReporter", fields: [reporterId], references: [id], onDelete: SetNull)
    
    taskId         String?
    task           Task?         @relation(fields: [taskId], references: [id], onDelete: SetNull)
    
    comments       IssueComment[]
    activities     IssueActivity[]
    
    createdAt      DateTime      @default(now())
    updatedAt      DateTime      @updatedAt
    deletedAt      DateTime?

    @@unique([projectId, issueNumber])
    @@map("issues")
  }
  ```
* Add `IssueComment` model:
  ```prisma
  model IssueComment {
    id             String    @id @default(uuid())
    issueId        String
    issue          Issue     @relation(fields: [issueId], references: [id], onDelete: Cascade)
    userId         String
    user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    content        String
    organizationId String
    createdAt      DateTime  @default(now())
    updatedAt      DateTime  @updatedAt
    deletedAt      DateTime?

    @@map("issue_comments")
  }
  ```
* Add `IssueActivity` model for fine-grained change logs:
  ```prisma
  model IssueActivity {
    id        String   @id @default(uuid())
    issueId   String
    issue     Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    action    String   // STATUS_CHANGED, SEVERITY_CHANGED, ASSIGNEE_CHANGED, etc.
    oldValue  String?
    newValue  String?
    createdAt DateTime @default(now())

    @@map("issue_activities")
  }
  ```
* Add `nextIssueNumber Int @default(1)` to `Project` model.
* Add relations to `Project`, `Organization`, `User`, and `Task` models in schema.

#### [MODIFY] [seed.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/seed.ts)
* Seed permissions: `CREATE_ISSUE`, `VIEW_ISSUE`, `EDIT_ISSUE`, `ARCHIVE_ISSUE`, `COMMENT_ISSUE`.
* Map these permissions to Admin and Project Manager roles. Map `VIEW_ISSUE` and `COMMENT_ISSUE` to Member role.

---

### 2. Backend Issue Module (NestJS)

Create the issue module under `backend/src/issue/`.

#### [NEW] [create-issue.dto.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/dto/create-issue.dto.ts)
Validates bug payload: `title`, `description`, `priority`, `severity`, `assigneeId`, `taskId`.

#### [NEW] [update-issue.dto.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/dto/update-issue.dto.ts)
Allows updating `title`, `description`, `status`, `priority`, `severity`, `assigneeId`, `taskId`.

#### [NEW] [create-issue-comment.dto.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/dto/create-issue-comment.dto.ts)
Validates comment string: `content`.

#### [NEW] [issue.module.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/issue.module.ts)
Registers dependencies and controllers.

#### [NEW] [issue.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/issue.controller.ts)
Exposes endpoints for Issues:
* `POST /projects/:projectId/issues` (Requires `CREATE_ISSUE`)
* `GET /projects/:projectId/issues` (Requires `VIEW_ISSUE`)
* `GET /issues/:id` (Requires `VIEW_ISSUE`)
* `PATCH /issues/:id` (Requires `EDIT_ISSUE`)
* `POST /issues/:id/archive` (Requires `ARCHIVE_ISSUE`)
* `POST /issues/:id/comments` (Requires `COMMENT_ISSUE`)

#### [NEW] [issue.service.ts](file:///c:/Salesforce/Labs/NSK/Project%2520Management%2520System/backend/src/issue/issue.service.ts)
* **`createIssue(orgId, userId, projectId, dto)`**: Starts transaction, reads and increments `nextIssueNumber` on `Project`, creates Issue, creates `IssueActivity: ISSUE_CREATED`, and writes general `AuditLog`.
* **`getProjectIssues(orgId, userId, projectId)`**: Retrieves active issues.
* **`getIssueById(orgId, userId, issueId)`**: Retrieves detail payload (with comments, activities, assignee/reporter).
* **`updateIssue(orgId, userId, issueId, dto)`**: Applies updates. Generates `IssueActivity` logs for state changes.
* **`archiveIssue(orgId, userId, issueId)`**: Soft archives (`deletedAt = now()`) and logs activity.
* **`addComment(orgId, userId, issueId, dto)`**: Creates comment and logs activity.

---

### 3. Frontend Issue Integration (Next.js)

#### [NEW] [issues-tab.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/issues-tab.tsx)
Renders inside project details pages under **Issues** tab:
* **Metric Cards**: Showing Open, Resolved, Critical, and High severity counts.
* **Filter Bar**: Allows filtering by status, severity, and assignee.
* **Issues List/Table**: Displays number (e.g. `PROJ-ISSUE-10`), title, severity badge (using curated rose/amber colors), status, and assignee.
* **Create/Edit Issue Modals**: For creating and managing bugs.

#### [NEW] [issue-detail-drawer.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/issue-detail-drawer.tsx)
Exposes details of the selected issue in a sidebar drawer layout:
* Title & Description inline editing.
* Discussion comments feed (supporting posting new comments).
* Full history activity feed.
* Selectors for Status, Priority, Severity, Assignee, and linked Task.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/projects/[id]/page.tsx)
* Add **Issues** tab to navigation selector.
* Render `<IssuesTab projectId={projectId} />` when active.
* Add overall issue counts next to tasks/milestones counters.

---

## Verification Plan

### Automated Tests
* Run Prisma migrations to apply database changes:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npx-cli.js" prisma migrate dev --name add_issues
  ```
* Seed database permissions:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npm-cli.js" run db:seed
  ```
* Verify TypeScript compiler integrity:
  * Backend: `npm run build`
  * Frontend: `npm run build`

### Manual Verification
1. **Create Issue**: Submit a new bug. Verify it receives a sequential number.
2. **Comment Feed**: Post comments on the bug detail drawer and verify they appear immediately.
3. **State Updates**: Change assignee, severity, and status. Verify that the bug detail drawer activity feed logs these modifications.
4. **Soft Archiving**: Archive a bug. Verify it vanishes from the active list but is preserved in the database.
