# Phase 6: Milestones - Implementation Plan

This phase implements the **Milestones Module** for the Enterprise Project Management System. It introduces milestone tracking, progress calculation, and project completion tracking across both backend and frontend.

---

## User Review Required

> [!IMPORTANT]
> **Permission Requirements**:
> We propose introducing new permissions for milestones to maintain granular security:
> * `CREATE_MILESTONE`: Allowed to create milestones for a project.
> * `VIEW_MILESTONE`: Allowed to view a project's milestones and progress.
> * `EDIT_MILESTONE`: Allowed to edit details/status of milestones.
> * `DELETE_MILESTONE`: Allowed to delete milestones.
>
> We will seed these permissions in the database and map them to the standard roles (Admin, Project Manager, and Member).
>
> **Task Association**:
> A task can optionally be associated with a single milestone (`milestoneId`). When a task is updated or completed (`status = DONE`), the progress of its associated milestone will automatically update dynamically on queries.

---

## Open Questions

> [!NOTE]
> 1. **Project Completion Tracking Formula**:
>    We plan to define project completion progress as:
>    $$\text{Progress} = \left( \frac{\text{Completed Tasks}}{\text{Total Tasks}} \right) \times 100$$
>    If a project has no tasks, progress defaults to `0`. Alternatively, we can calculate it as the percentage of milestones achieved. We recommend the task-based progress as it provides more granular tracking, but we can display both if needed.

---

## Proposed Changes

### 1. Database Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
* Add `MilestoneStatus` enum: `PLANNED`, `ACHIEVED`, `MISSED`.
* Add `Milestone` model:
  ```prisma
  enum MilestoneStatus {
    PLANNED
    ACHIEVED
    MISSED
  }

  model Milestone {
    id             String          @id @default(uuid())
    title          String
    description    String?
    dueDate        DateTime?
    status         MilestoneStatus @default(PLANNED)
    
    projectId      String
    project        Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
    
    organizationId String
    organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    
    tasks          Task[]
    
    createdAt      DateTime        @default(now())
    updatedAt      DateTime        @updatedAt
    deletedAt      DateTime?

    @@map("milestones")
  }
  ```
* Update `Project` model to include a relation to `Milestone[]`.
* Update `Task` model to include a relation to `Milestone?` and field `milestoneId String?`.

---

### 2. Backend Milestone Module (NestJS)

Create a new milestone module under `backend/src/milestone/`.

#### [NEW] [milestone.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/milestone/milestone.module.ts)
Registers the controller, service, and binds DB dependencies.

#### [NEW] [milestone.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/milestone/milestone.controller.ts)
Exposes endpoints for Milestones CRUD:
* `POST /projects/:projectId/milestones` (Requires `CREATE_MILESTONE`)
* `GET /projects/:projectId/milestones` (Requires `VIEW_MILESTONE`)
* `GET /milestones/:id` (Requires `VIEW_MILESTONE`)
* `PATCH /milestones/:id` (Requires `EDIT_MILESTONE`)
* `DELETE /milestones/:id` (Requires `DELETE_MILESTONE`)

#### [NEW] [milestone.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/milestone/milestone.service.ts)
* **`createMilestone(orgId, userId, projectId, dto)`**: Creates a new milestone, validating that the project exists, belongs to the tenant, and is active.
* **`getProjectMilestones(orgId, userId, projectId)`**:
  * Retrieves all active milestones for a project.
  * Calculates `progress` for each milestone dynamically:
    $$\text{Progress} = \left( \frac{\text{Completed Tasks in Milestone}}{\text{Total Tasks in Milestone}} \right) \times 100$$
* **`getMilestoneById(orgId, userId, milestoneId)`**: Retrieves details of a milestone and its associated tasks list.
* **`updateMilestone(orgId, userId, milestoneId, dto)`**: Updates properties. If status is updated to `ACHIEVED`, logs audit logs.
* **`deleteMilestone(orgId, userId, milestoneId)`**: Soft deletes the milestone and sets `milestoneId = null` for all associated tasks.

#### [MODIFY] [project.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/project/project.service.ts)
Update project details response (`GET /projects/:id`) to calculate and return the project's overall `progress` percentage.

---

### 3. Frontend Milestone Integration (Next.js)

#### [NEW] [milestones-tab.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/milestones-tab.tsx)
Renders the Milestones tab within Project Details:
* **Progress Cards**: List milestones with title, description, due date, status badge, and progress bar.
* **Associated Tasks Sub-panel**: Clicking a milestone expands it to show the list of tasks linked to it.
* **Create/Edit Modal**: Inline form/modal to add or modify milestones.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/projects/[id]/page.tsx)
* Add **Milestones** tab to the navigation tabs list.
* Render `MilestonesTab` component when the tab is active.
* Add overall project progress bar to the project header or Overview tab.

#### [MODIFY] [task-detail-drawer.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/task-detail-drawer.tsx)
Add a **Milestone** selector field to view/edit the milestone a task is linked to.

---

## Verification Plan

### Automated Tests
* Seed database permissions:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npm-cli.js" run db:seed
  ```

### Manual Verification
1. **Create Milestone**: Create a milestone inside the new Milestones tab.
2. **Assign Tasks**: Create tasks and assign them to the milestone.
3. **Progress Recalculation**: Update task statuses to `DONE` and verify the milestone's progress bar recalculates and updates.
4. **Project Completion**: Verify the project overview page shows overall completion percentage.
5. **Soft Delete**: Delete a milestone and verify its tasks become unlinked (milestone name disappears from tasks, but tasks are not deleted).
