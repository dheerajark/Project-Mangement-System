# Phase 10: Reports & Analytics — Implementation Plan (Revised)

This phase implements a comprehensive **Reports & Analytics Module** (Phase 10) for the Enterprise Project Management System. It introduces custom date range query support, project issue and bug tracking metrics, milestone completion summaries, member productivity metrics, task delivery velocity calculations, overdue task trend analysis, top overdue tasks alerts, and CSV export capabilities.

---

## User Review Required

> [!IMPORTANT]
> **Permission Requirements**:
> * Accessing project report APIs (`GET /projects/:projectId/reports/summary` and `/projects/:projectId/reports/export`) requires `VIEW_PROJECT` permission on the project.
> * Global dashboard reports (`GET /dashboard/reports/summary`) are strictly scoped to projects, tasks, issues, and time logs associated with the authenticated user's organization.

> [!IMPORTANT]
> **Strict Read-Only reporting constraint**:
> Report services and endpoints must be strictly side-effect free. They can only execute read aggregates (`findMany`, `groupBy`, `aggregate`, `count`) and calculations. Under no circumstances will any report service perform `create`, `update`, `delete`, or `archive` database mutations.

> [!WARNING]
> **Performance of Date Aggregations**:
> To generate daily/weekly trends (for velocity, overdue tasks, and worklog logs) over variable date ranges (up to 90 days), we construct chronological calendars in memory and map database database records, ensuring zero missing gaps on charts even when no logs or tasks were recorded on certain dates.

---

## Open Questions

> [!NOTE]
> 1. **CSV Export Format Layout**:
>    The `/projects/:projectId/reports/export` endpoint will return a single `.csv` file download. We propose structuring it as a ZIP file containing multiple CSVs (e.g. `tasks.csv`, `time_entries.csv`, `issues.csv`, `milestones.csv`, `productivity.csv`) or a single compiled report with labeled sections. We recommend the ZIP archive approach to maintain clean tabular formatting for each metric type.

---

## Proposed Changes

### 1. Backend Modules (NestJS)

We will create a new report module under `backend/src/report/`.

#### [NEW] [report.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/report/report.module.ts)
Registers `ReportController` and `ReportService`. Imports `PrismaModule` and `JwtModule`.

#### [NEW] [report.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/report/report.service.ts)
Provides report calculations:
* **`getProjectReportSummary(orgId, userId, projectId, range, startDate, endDate)`**:
  * Resolves date range boundaries (supports presets `7d` (default 7 days), `30d` (default project range 30 days), `90d` (90 days), and `custom` via query parameters `startDate`/`endDate`).
  * **Summary Metrics**: Total, Open, Completed, and Overdue tasks (tasks with `status !== 'DONE'` and `dueDate` earlier than today).
  * **Time Tracking Metrics**: Estimated vs actual hours logged.
  * **Issue Analytics**:
    * Counts: Total Issues, Open Issues, Resolved Issues (`status === 'RESOLVED'`), Critical Issues (`severity === 'CRITICAL'`), and Reopened Issues (`status === 'REOPENED'`).
    * Average resolution duration: Calculated using `avg(resolvedAt - createdAt)` from database records where `resolvedAt` is not null.
    * Donut distributions for Issue Statuses and Issue Severities.
  * **Milestone Analytics**:
    * Counts: Total, Planned (`PLANNED`), In Progress (`IN_PROGRESS`), Achieved (`ACHIEVED`), and Missed (`MISSED`).
    * Milestone Completion Trend.
  * **Member Productivity Metrics**:
    * Generates productivity list for project members containing: `assignedTasksCount`, `completedTasksCount`, `openTasksCount`, `hoursLogged`, and `issuesResolvedCount`.
  * **Task Velocity Metrics**:
    * Number of tasks completed per week and per month.
    * Generates chart timeline array representing the delivery rate over time.
  * **Overdue Trend Analytics**:
    * Computes daily snapshot of overdue task count over the date range to plot a trend line.
  * **Top 5 Overdue Tasks**:
    * Queries the top 5 uncompleted tasks sorted by `dueDate` ascending (most overdue first), return `taskNumber`, `title`, `assignee` details, `daysOverdue` (difference from today), and `priority`.
  * **Charts Data**:
    * Generates chronological daily work logs, task completion trends, and issue resolutions.
* **`getDashboardReportSummary(orgId, userId, range, startDate, endDate)`**:
  * Resolves preset/custom date ranges (defaults to `14d`).
  * Aggregates user's personal summaries: open assigned tasks, overdue assigned tasks, hours logged by this user in the week.
  * Compiles active projects with progress details and milestones summary.
  * Personal daily work logs and task completion velocity over the chosen range.
* **`exportProjectReport(orgId, userId, projectId)`**:
  * Fetches raw tasks, time entries, issues, milestones, and productivity summaries.
  * Compiles these into a standard formatted CSV response stream.

#### [NEW] [report.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/report/report.controller.ts)
Exposes REST endpoints with tenant isolation and permission guards:
* `GET /projects/:projectId/reports/summary` (Requires `VIEW_PROJECT`)
  * Parameters: `range` (7d/30d/90d/custom), `startDate` (optional), `endDate` (optional)
* `GET /projects/:projectId/reports/export` (Requires `VIEW_PROJECT`)
  * Returns CSV attachment.
* `GET /dashboard/reports/summary`
  * Parameters: `range` (7d/14d/30d/custom), `startDate` (optional), `endDate` (optional)

#### [MODIFY] [app.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/app.module.ts)
Register the new `ReportModule`.

---

### 2. Frontend Integration (Next.js)

#### [NEW] [reports-tab.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/reports-tab.tsx)
Build a tab layout rendering Recharts components, filters, and tables:
* **Controls Toolbar**:
  * Date range selector dropdown: `7 Days`, `30 Days`, `90 Days`, and `Custom Range` (renders date picker components on custom selection).
  * **Export CSV** button triggering download from `GET /projects/:projectId/reports/export`.
* **Summary Ribbon Cards**: Grid showing total/completed/overdue tasks, logged hours, issue metrics (total/open/resolved/critical), and milestone metrics.
* **Widgets Grid**:
  * **Task Status & Issue Status Distribution**: Side-by-side Donut charts.
  * **Velocity Trend Chart**: Bar chart displaying tasks completed per week/month.
  * **Hours Logged and Completion Trends**: Area/Line charts showing trends within the selected date window.
  * **Overdue Trend Line Chart**: Visualizes overdue task growth/decline.
  * **Top 5 Overdue Tasks**: Rendered as a priority table highlighting task number, title, assignee name, days overdue, and priority.
* **Member Productivity Table**:
  * Sortable grid showing: Project Member, Assigned Tasks, Open Tasks, Completed Tasks, Hours Logged, and Issues Resolved.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/projects/[id]/page.tsx)
* Register `'reports'` tab in the dynamic tabs layout list.
* Include the `<ReportsTab projectId={projectId} />` component.

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/dashboard/page.tsx)
* Replace placeholders with reports endpoints payload.
* Add date range selector (presets `7d`, `14d`, `30d`).
* Render user-scoped logs trends, weekly work log bar charts, project completion cards (including milestone counts), and recent time log tables.

---

### 3. Architecture for Caching & Future Formats (Readiness Documentation)

#### Future Caching Strategy
* For high scalability under heavy traffic, we outline support for **Redis Caching** inside `ReportService`:
  * Use a caching interceptor or direct Redis wrapper on report summary endpoints.
  * Cache key format: `org:${orgId}:project:${projectId}:user:${userId}:reports:${range}`.
  * Cache duration: **5 minutes** (300 seconds), cleared or invalidated whenever major updates occur (e.g. task completion or time log edits).
  * *Note: Caching is not implemented in this phase.*

#### Future Document Formats
* The export endpoint is designed to support additional formats in subsequent phases:
  * `PDF`: For executive briefings (e.g., using `pdfkit` or `puppeteer`).
  * `Excel`: For spreadsheet analysis (e.g., using `exceljs`).
  * *Note: PDF/Excel are not implemented in this phase.*

---

## Verification Plan

### Automated Tests
* Validate backend compilation:
  ```bash
  npm run build
  ```
* Validate frontend build & dynamic page generation:
  ```bash
  next build
  ```

### Manual Verification
1. Log in and navigate to the project reports tab.
2. Select preset date ranges (`7d`, `90d`) and confirm curves and logs recalculate correctly.
3. Assign a task that is overdue, verify it appears at the top of the **Top 5 Overdue Tasks** table with correct overdue day calculations.
4. Click **Export CSV** and assert that the file downloads successfully and contains correct rows for tasks, logs, issues, milestones, and member productivity.
5. Toggle task completion, verify that the task velocity trends adjust.
6. Verify multi-tenant bounds: User A cannot fetch project reports of organization B.
