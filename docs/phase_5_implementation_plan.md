# Phase 5: Kanban Board - Implementation Plan (Revised)

This phase implements the Interactive Kanban Board module for the Enterprise Project Management System. It introduces stable card ordering via task position tracking, dedicated Kanban board and reordering endpoints, validation checks, and optimistic UI transitions.

---

## User Review Required

> [!IMPORTANT]
> **Task Positioning & Reordering Logic**:
> We will add a `position` field to the `Task` model. The `PATCH /tasks/:id/reorder` endpoint will handle task repositioning:
> 1. It will accept a target `position` (integer) and an optional `status` (if the task is moved to a different column).
> 2. Inside a transaction, it will shift positions of neighboring tasks within the target column to maintain consecutive sequential ordering (e.g. `0, 1, 2, 3...`).
> 3. If a column change (`status`) is involved, it will enforce the Phase 4 status transition rules.
>
> **React 19 & Next.js 16 Drag-and-Drop Library Choice**:
> Due to React 19 (`v19.2.4`) and Next.js 16 (`v16.2.7`) stack compatibility, many legacy drag-and-drop libraries (e.g. `react-beautiful-dnd`) will fail compilation due to breaking context/ref API changes.
>
> We propose using the **HTML5 Drag and Drop API** natively. This choice:
> 1. Eliminates third-party library bloat and compatibility risks.
> 2. Provides compile-time safety on React 19.
> 3. Allows lightweight styling with Tailwind transitions for drop indicators, drag ghosts, and active drop zones.

---

## Open Questions

> [!NOTE]
> 1. **Reorder Position Adjustments**:
>    When shifting neighboring tasks, we will re-index all tasks in the target column sequentially starting from `0`. This guarantees clean positions and prevents arithmetic overflow or index spacing bugs.

---

## Proposed Changes

### 1. Database Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
Add the `position` field to the `Task` model:
```prisma
model Task {
  // ... existing fields
  position Int @default(0)
}
```

---

### 2. Backend Kanban Support (NestJS)

Create/update backend logic under `backend/src/task/`.

#### [MODIFY] [task.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/task/task.controller.ts)
Expose the new endpoints:
* **`GET /projects/:projectId/board`**: Retrieves project tasks grouped by columns (Requires `VIEW_TASK` permission).
* **`PATCH /tasks/:id/reorder`**: Updates a task's column and position within the board (Requires `EDIT_TASK` permission).

#### [MODIFY] [task.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/task/task.service.ts)
* **`getKanbanBoard(organizationId: string, userId: string, projectId: string)`**:
  * Verify project active status, tenant isolation, and `VIEW_TASK` permission.
  * Retrieve all active tasks (`deletedAt: null`) for the project ordered by `position` ascending.
  * Group tasks into a JSON structure matching columns:
    ```json
    {
      "todo": [],
      "inProgress": [],
      "review": [],
      "done": [],
      "blocked": []
    }
    ```
* **`reorderTask(organizationId: string, userId: string, taskId: string, dto: ReorderTaskDto)`**:
  * **Validation Checks**:
    * Verify project and task are not archived.
    * Ensure the user has the `EDIT_TASK` permission.
    * Verify that the task belongs to the project and that the user belongs to the same organization (`organizationId`).
    * Return `403 Forbidden` on any validation failure.
  * **State Transition Check**: If the target `status` is provided and differs from the current status, validate the transition rules (e.g. `TODO` -> `IN_PROGRESS`, etc.).
  * **Transaction-Safe Reordering**: Inside a Prisma `$transaction`:
    1. Retrieve other tasks in the target status column ordered by position.
    2. Insert the target task at the requested `position`.
    3. Re-index all tasks in the column sequentially starting from `0` to keep the list clean and compact.
    4. Save the task updates.
    5. Log activity `TASK_STATUS_CHANGED` and audit logs if the column (`status`) changed.

---

### 3. Frontend Kanban Interface (Next.js)

#### [NEW] [kanban-board.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/kanban-board.tsx)
Build a modular Kanban Board:
* **Columns Layout**: Render columns for `To Do`, `In Progress`, `In Review`, `Done`, and `Blocked`.
* **HTML5 Drag Handlers**:
  * `onDragStart`: Set task ID and source status on dataTransfer.
  * `onDragOver`: Highlight drop column borders dynamically.
  * `onDrop`: Calculate the drop index based on the mouse hover position relative to other cards, and invoke the status/position reorder callback.
* **Simplified Cards**: Render minimal task cards containing only:
  * Task Number (e.g., `COR-5`) and Type Icon.
  * Title.
  * Priority Tag.
  * Assignee Avatar/initials.
  * Estimated Hours (optional, display if present).
  * **Archived / Read-only Lock**: Disable dragging (`draggable={false}`) and show cursor style `not-allowed` if the project/task is archived or if the user lacks the `EDIT_TASK` permission.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/projects/[id]/page.tsx)
* **View Toggle**: Add a segmented switch (`List` vs `Board`) under the Tasks tab, defaulting to `Board`.
* **Queries & Mutations**:
  * Fetch board data using `GET /projects/:projectId/board`.
  * Optimistically updates the column list states during drag operations.
  * On mutation error (e.g. `403 Forbidden` invalid transition), revert the optimistic card movement and display a warning banner at the top of the Tasks panel.

---

## Future Roadmap (Out of Scope for Phase 5)
* WIP (Work In Progress) Limits per column.
* Swimlanes (grouping cards by assignee/priority).
* Bulk card status updates.
* Infinite scrolling / virtualized board rendering.
* Saved custom filters (e.g., hiding done tasks).

---

## Verification Plan

### Automated Tests
* Run schema migrations:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npx-cli.js" prisma migrate dev --name add_task_position
  ```

### Manual Verification
1. **Reorder Within Column**: Drag a card to swap positions inside the same column. Refresh to verify the position is stable and persistent.
2. **Move Across Columns**: Drag a card to another column. Verify that the task status updates, and that the position shifts neighbors.
3. **Invalid Transition Block**: Drag `To Do` ➔ `Done`. Verify it snaps back and shows an error banner.
4. **Read-Only / Permission Lock**: Log in as a user without `EDIT_TASK` or open an archived project. Verify card dragging is disabled.
