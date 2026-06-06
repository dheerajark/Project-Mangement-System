# Phase 11.5: Global Time Logs Dashboard & Sidebar Integration

This phase implements a general **Time Logs Dashboard** and a global left **Sidebar Navigation** system for the Enterprise Project Management System. It transitions the time logging experience from a project-by-project basis to a unified dashboard, enabling users to log, view, and filter time entries across all projects from a single convenient screen.

---

## User Review Required

> [!IMPORTANT]
> **Tenant and Project Boundaries**:
> The "Add Time Log" modal on the global dashboard will fetch all projects in the organization. However, to maintain single/multi-tenant boundaries, the dropdown will only show projects where the user is a member or has authorization to log time.
>
> **Global Header Alignment**:
> Every dashboard page currently renders its own header. To integrate the left sidebar seamlessly without massive refactoring, we will wrap the routes under a shared `(dashboard)/layout.tsx` component. The sidebar will occupy the left column, and the existing pages (including their headers and main content areas) will load inside the right column.

---

## Open Questions

> [!NOTE]
> 1. **Sidebar Navigation for Tasks, Issues, and Milestones**:
>    The sidebar will include links for Tasks, Issues, and Milestones. Since there are currently no general pages for these, we will link them to `/dashboard` or `/projects` or show a clean "under construction" toast/message, OR implement them as query-filtered redirections (e.g. `/projects?tab=tasks`). We propose linking them to `/dashboard` or pointing them to `/projects` for now, with `/time-logs` pointing to the new general Time Logs page.
>
> 2. **Permissions for Viewing Other Users' Logs**:
>    We propose that users without `APPROVE_TIMESHEET` (or similar admin/manager permission) will only see their own time entries in the general view, while Admins and Project Managers can view entries from all users and use the "User" filter.

---

## Proposed Changes

### 1. Backend API (NestJS)

#### [MODIFY] [time-tracking.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/time-tracking/time-tracking.controller.ts)
* **Add global GET endpoint**:
  Expose `GET /time-entries` mapped to a new controller action `getAllEntries` to fetch time logs from all projects.
  ```typescript
  @Get('time-entries')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get all time entries across projects with filtering' })
  @ApiResponse({ status: 200, description: 'Time entries retrieved successfully.' })
  getAllEntries(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Query('projectId') projectId?: string,
    @Query('userId') filterUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billable') billable?: string,
    @Query('status') status?: string,
  ) {
    const billableBool = billable === 'true' ? true : billable === 'false' ? false : undefined;
    return this.timeTrackingService.getAllTimeEntries(organizationId, userId, permissions, {
      projectId,
      userId: filterUserId,
      startDate,
      endDate,
      billable: billableBool,
      status,
    });
  }
  ```

#### [MODIFY] [time-tracking.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/time-tracking/time-tracking.service.ts)
* **Implement `getAllTimeEntries` query**:
  Query `timeEntry` records from the DB using Prisma. Respect organization constraints. If the user does not have the `APPROVE_TIMESHEET` permission, restrict results to `userId = loggedInUserId`.
  ```typescript
  async getAllTimeEntries(
    organizationId: string,
    userId: string,
    userPermissions: string[],
    filters: {
      projectId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      billable?: boolean;
      status?: string;
    },
  ) {
    const canViewAll = userPermissions.includes('APPROVE_TIMESHEET');
    
    const whereClause: any = {
      organizationId,
      isTimerRunning: false,
      deletedAt: null,
    };

    if (!canViewAll) {
      whereClause.userId = userId;
    } else if (filters.userId) {
      whereClause.userId = filters.userId;
    }

    if (filters.projectId) {
      whereClause.projectId = filters.projectId;
    }

    if (filters.billable !== undefined) {
      whereClause.billable = filters.billable;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.loggedAt = {};
      if (filters.startDate) {
        whereClause.loggedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.loggedAt.lte = end;
      }
    }

    if (filters.status) {
      if (filters.status === 'UNSUBMITTED') {
        whereClause.timesheetId = null;
      } else {
        whereClause.timesheet = {
          status: filters.status,
        };
      }
    }

    return this.prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        task: {
          select: { id: true, title: true, taskNumber: true },
        },
        timesheet: {
          select: { id: true, status: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }
  ```

---

### 2. Frontend Layout & Navigation (Next.js)

#### [NEW] [layout.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/layout.tsx)
* Create a shared dashboard layout wrapping all sub-routes inside `(dashboard)`.
* Include a `SidebarProvider` context to share the toggle status (expanded vs collapsed) and drawer state on mobile screens.
* Structure:
  ```tsx
  <div className="flex h-screen overflow-hidden bg-slate-950">
    <Sidebar />
    <div className="flex-1 flex flex-col overflow-y-auto">
      {children}
    </div>
  </div>
  ```

#### [NEW] [sidebar.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/sidebar.tsx)
* Design a premium, collapsible, Zoho-style vertical sidebar.
* **Navigation Nodes**:
  * Home (links to `/dashboard`)
  * Projects (links to `/projects`)
  * Collaboration (links to `/collaboration` or placeholder)
  * Collapsible **Overview** subtab:
    * Tasks (links to `/dashboard` or query-filtered redirects)
    * Issues (links to project lists / dashboard)
    * Milestone (links to milestones)
    * **Time Logs** (links to the new `/time-logs` page)
  * Collapsible **Recent Projects**:
    * Dynamically fetch user projects from `/projects` and list the first 3-5 projects.
* **Layout Modes**:
  * Desktop Expanded: Full sidebar with icons and names.
  * Desktop Collapsed: Thin column showing only icons with hover tooltips.
  * Mobile/Tablet: Drawer hidden by default, toggled via a floating hamburger icon in the top-left corner.

---

### 3. General Time Logs Dashboard & Submission (Next.js)

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/time-logs/page.tsx)
* Implement `/time-logs` page.
* **Aggregation Cards**:
  * Display Total Logged Hours, Billable Hours, Non-Billable Hours.
* **Filter Toolbar**:
  * Date Range Filter: Week selection with `<` and `>` navigational buttons, plus a custom start/end date picker.
  * Project Filter: Dropdown listing all active projects the user has access to.
  * User Filter: Dropdown showing all users (only displayed for Admins and Project Managers).
  * Billing Type Filter: Dropdown with All, Billable, Non-Billable options.
  * Approval Status Filter: Dropdown with All, Unsubmitted, Submitted, Approved, Rejected.
* **Entries Table**:
  * Columns: Project, Date, Task, Description, User, Billing Type, Approval Status, Hours, Actions (Archive/Delete).
  * Actions are disabled if the entry is locked in a `SUBMITTED` or `APPROVED` timesheet.
* **Submission Trigger**:
  * A button to open the global "Add Time Log" modal.

#### [NEW] [global-time-log-modal.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/global-time-log-modal.tsx)
* Create a reusable time entry dialog that adds a **Project Selector Dropdown**.
* Flow:
  1. User clicks "Add Time Log".
  2. Dialog prompts user to select a Project (fetching active, non-archived projects with time tracking enabled).
  3. Once a project is chosen, the Task Selector Dropdown is dynamically populated by fetching `/projects/:id/tasks` for that project.
  4. User inputs Hours, Date worked, Notes, and checks/unchecks Billable.
  5. Form submits to `POST /time-entries` and invalidates query caches to reload the grid.

---

## Verification Plan

### Automated Tests
* Build and verify backend:
  ```bash
  cd backend && npm run build
  ```
* Build and verify frontend:
  ```bash
  cd frontend && npm run build
  ```

### Manual Verification
1. Login to the dashboard, verify the new vertical sidebar is displayed on the left and collapses correctly.
2. Shrink screen size and verify it collapses to drawer mode and triggers via the floating hamburger button.
3. Click "Time Logs" under the Overview section to navigate to `/time-logs`.
4. Verify the top cards compile aggregated hours.
5. Apply filters (Project, Billing, Status, Date) and verify query results are filtered correctly.
6. Click "Add Time Log", select a Project, select an Associated Task, and fill details. Submit and verify that:
   * The entry appears immediately in the general grid.
   * If you navigate to that specific project's "Time Logs" tab, the entry is visible there as well.
7. Verify multi-tenant bounds: a user cannot see or select projects they are not members of in the dropdown list.
