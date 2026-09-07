# Phase 11.6: Global Tasks, Issues, and Milestones Dashboards

This phase implements unified global dashboards for **Tasks**, **Issues**, and **Milestones** in the Enterprise Project Management System, and completes their left **Sidebar Navigation** integration. This transitions the tasks, issues, and milestones views from a project-specific scope to organization-wide dashboards, allowing users to view, filter, and manage items across all their projects.

---

## User Review Required

> [!IMPORTANT]
> **Tenant and Project Visibility Boundaries**:
> The global dashboards will query across all projects. To maintain organization and project boundaries, users will only see tasks, issues, and milestones belonging to projects they have authorization to view (public projects in their organization or private projects where they are members).
>
> **Global Creation Modals**:
> Floating "Create Task", "Report Issue", and "Add Milestone" buttons will be integrated into the dashboards. These global modals will require selecting a Project first, which dynamically populates subsequent dropdowns (like project members for Assignees, and project milestones for Tasks).

---

## Open Questions

> [!NOTE]
> 1. **Kanban Board vs List View on Global Tasks**:
>    We propose implementing both **Board (Kanban)** and **List** views on the global Tasks dashboard. The board view will group all authorized tasks by status across projects, while the list view will allow sorting and multi-column filtering.
>
> 2. **Milestones Layout**:
>    For Milestones, we propose a clean grid card-based view displaying each milestone's status, project name, progress bar (computed based on completed vs total linked tasks), and date range, with status filters (Planned, In Progress, Achieved, Missed).

---

## Proposed Changes

### 1. Backend API (NestJS)

#### [MODIFY] [task.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/task/task.controller.ts)
* Add a global `GET /tasks` endpoint to retrieve tasks across projects with filtering options.
```typescript
  @Get('tasks')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all tasks across projects with filtering' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully.' })
  getAllTasks(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('type') type?: TaskType,
    @Query('search') search?: string,
  ) {
    return this.taskService.getAllTasks(organizationId, userId, {
      projectId,
      assigneeId,
      status,
      priority,
      type,
      search,
    });
  }
```

#### [MODIFY] [task.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/task/task.service.ts)
* Implement the `getAllTasks` method. Enforce project visibility: only return tasks from projects where `visibility = ORGANIZATION` or the user is a member of the project.
```typescript
  async getAllTasks(
    organizationId: string,
    userId: string,
    filters: {
      projectId?: string;
      assigneeId?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      type?: TaskType;
      search?: string;
    },
  ) {
    const whereClause: any = {
      organizationId,
      deletedAt: null,
      project: {
        deletedAt: null,
        OR: [
          { visibility: 'ORGANIZATION' },
          { members: { some: { userId, deletedAt: null } } },
        ],
      },
    };

    if (filters.projectId) {
      whereClause.projectId = filters.projectId;
    }
    if (filters.assigneeId) {
      whereClause.assigneeId = filters.assigneeId;
    }
    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.priority) {
      whereClause.priority = filters.priority;
    }
    if (filters.type) {
      whereClause.type = filters.type;
    }
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return this.prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        milestone: true,
        labels: {
          include: { label: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
```

#### [MODIFY] [issue.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/issue/issue.controller.ts)
* Add a global `GET /issues` endpoint to fetch issues across all authorized projects.
```typescript
  @Get('issues')
  @Permissions('VIEW_ISSUE')
  @ApiOperation({ summary: 'Get all issues across projects with filtering' })
  getAllIssues(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: IssueStatus,
    @Query('priority') priority?: IssuePriority,
    @Query('severity') severity?: IssueSeverity,
    @Query('type') type?: IssueType,
    @Query('search') search?: string,
  ) {
    return this.issueService.getAllIssues(organizationId, userId, {
      projectId,
      assigneeId,
      status,
      priority,
      severity,
      type,
      search,
    });
  }
```

#### [MODIFY] [issue.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/issue/issue.service.ts)
* Implement `getAllIssues`. Apply the same project authorization constraints.
```typescript
  async getAllIssues(
    organizationId: string,
    userId: string,
    filters: {
      projectId?: string;
      assigneeId?: string;
      status?: IssueStatus;
      priority?: IssuePriority;
      severity?: IssueSeverity;
      type?: IssueType;
      search?: string;
    },
  ) {
    const whereClause: any = {
      organizationId,
      deletedAt: null,
      project: {
        deletedAt: null,
        OR: [
          { visibility: 'ORGANIZATION' },
          { members: { some: { userId, deletedAt: null } } },
        ],
      },
    };

    if (filters.projectId) whereClause.projectId = filters.projectId;
    if (filters.assigneeId) whereClause.assigneeId = filters.assigneeId;
    if (filters.status) whereClause.status = filters.status;
    if (filters.priority) whereClause.priority = filters.priority;
    if (filters.severity) whereClause.severity = filters.severity;
    if (filters.type) whereClause.type = filters.type;
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return this.prisma.issue.findMany({
      where: whereClause,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
```

#### [MODIFY] [milestone.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/milestone/milestone.controller.ts)
* Add a global `GET /milestones` endpoint to fetch milestones across all authorized projects.
```typescript
  @Get('milestones')
  @Permissions('VIEW_MILESTONE')
  @ApiOperation({ summary: 'Get all milestones across projects with filtering' })
  getAllMilestones(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: MilestoneStatus,
    @Query('search') search?: string,
  ) {
    return this.milestoneService.getAllMilestones(organizationId, userId, {
      projectId,
      status,
      search,
    });
  }
```

#### [MODIFY] [milestone.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/milestone/milestone.service.ts)
* Implement `getAllMilestones` respecting visibility permissions.
```typescript
  async getAllMilestones(
    organizationId: string,
    userId: string,
    filters: {
      projectId?: string;
      status?: MilestoneStatus;
      search?: string;
    },
  ) {
    const whereClause: any = {
      organizationId,
      deletedAt: null,
      project: {
        deletedAt: null,
        OR: [
          { visibility: 'ORGANIZATION' },
          { members: { some: { userId, deletedAt: null } } },
        ],
      },
    };

    if (filters.projectId) whereClause.projectId = filters.projectId;
    if (filters.status) whereClause.status = filters.status;
    if (filters.search) {
      whereClause.title = { contains: filters.search };
    }

    return this.prisma.milestone.findMany({
      where: whereClause,
      include: {
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
```

---

### 2. Frontend Sidebar Navigation

#### [MODIFY] [sidebar.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/sidebar.tsx)
* Replace `/dashboard` placeholders for Tasks, Issues, and Milestones links under **Overview** section with `/tasks`, `/issues`, and `/milestones`.
* Add Tasks, Issues, and Milestones buttons with proper icons and tooltips inside the collapsed sidebar view, similar to Time Logs.
```tsx
  {/* Collapsed view additional links */}
  <Link href="/tasks" className={collapsedItemClass('/tasks')} title="Tasks">
    <CheckSquare className="w-5 h-5" />
    <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
      Tasks
    </span>
  </Link>
  <Link href="/issues" className={collapsedItemClass('/issues')} title="Issues">
    <AlertTriangle className="w-5 h-5" />
    <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
      Issues
    </span>
  </Link>
  <Link href="/milestones" className={collapsedItemClass('/milestones')} title="Milestones">
    <Calendar className="w-5 h-5" />
    <span className="absolute left-12 bg-slate-900 border border-slate-800 text-slate-100 text-[10px] px-2.5 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 pointer-events-none whitespace-nowrap">
      Milestones
    </span>
  </Link>
```

---

### 3. Frontend Unified Dashboards (Next.js)

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/tasks/page.tsx)
* Implement global Tasks dashboard support for both Board and List view.
* Include status cards aggregating: Total, To Do, In Progress, In Review, Done, Blocked.
* Filters toolbar: Date picker, Project selection, Assignee selection, Priority selection, Status selection, Type selection, and text search input.
* Reuse `TaskDetailDrawer` to allow viewing details of a task and updating task parameters.
* Universal floating "Create Task" button that opens `GlobalTaskModal`.

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/issues/page.tsx)
* Implement global Issues dashboard displaying critical issues across projects.
* Aggregation cards displaying: Total Open Issues, Critical/High Issues, Resolved Issues, Closed Issues.
* Grid table view showing Issue ID, Title, Project Name, Assignee, Priority, Severity, Status, and Reporting User.
* Universal floating "Report Issue" button that opens `GlobalIssueModal`.

#### [NEW] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/milestones/page.tsx)
* Implement global Milestones dashboard.
* Card grid style showing Milestone Title, Project, Start/Due Dates, Status (Planned, In Progress, Achieved, Missed).
* Include a progress bar on each milestone representing the completion percentage of its linked tasks.
* Status metrics section at top.
* Universal floating "Add Milestone" button opening `GlobalMilestoneModal`.

---

### 4. Reusable Global Creation Modals

#### [NEW] [global-task-modal.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/global-task-modal.tsx)
* Implement a dialog to create tasks across projects:
  1. Prompts for Project selection.
  2. Dynamically queries project-specific resources (project members for Assignee, project milestones for Milestones) once a project is selected.
  3. Form fields: Title, Description, Priority, Type, Assignee, Milestone, Estimated Hours, Due Date.
  4. Dispatches `POST /tasks` upon submission and invalidates query cache `global-tasks`.

#### [NEW] [global-issue-modal.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/global-issue-modal.tsx)
* Implement a dialog to report issues across projects:
  1. Prompts for Project selection.
  2. Dynamically queries project members for Assignee.
  3. Form fields: Title, Description, Type, Priority, Severity, Environment, reproduction steps, Assignee.
  4. Dispatches `POST /projects/:projectId/issues` upon submission.

#### [NEW] [global-milestone-modal.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/global-milestone-modal.tsx)
* Implement a dialog to add milestones:
  1. Prompts for Project selection.
  2. Form fields: Title, Description, Start Date, Due Date, Status.
  3. Dispatches `POST /projects/:projectId/milestones` upon submission.

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
1. Login to the dashboard, collapse/expand the left sidebar, and verify that the links and tooltips for Tasks, Issues, and Milestones behave identically to Time Logs.
2. Click **Tasks** in the sidebar. Verify the global Tasks dashboard displays, allows toggling between List and Board view, and retrieves tasks from multiple authorized projects.
3. Apply filters (Project, Assignee, Priority, Status, Type) and verify filtering works.
4. Click **Create Task** in the global Tasks dashboard. Select a project, verify the assignee and milestone dropdowns populate correctly, and create a task. Confirm it appears in the list/board.
5. Click **Issues** in the sidebar. Verify the global Issues list displays, apply severity/priority filters, and click **Report Issue** to submit a new issue.
6. Click **Milestones** in the sidebar. Verify the milestones list displays, and verify the progress bar of a milestone is accurately computed.
7. Verify authorization: verify that a user who is not a member of a private project cannot see or select it in any of the global creation modal dropdowns or dashboard filter options.
