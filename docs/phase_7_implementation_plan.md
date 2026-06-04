# Phase 7: Time Tracking - Implementation Plan (Revised)

This phase implements the **Time Tracking Module** for the Enterprise Project Management System. It introduces manual and timer-based logging of hours against projects and tasks, weekly/monthly timesheet submission and approval flows, and comprehensive reporting.

---

## User Review Required

> [!IMPORTANT]
> **Project Settings Constraint**:
> Time logging will respect the `allowTimeTracking` flag in `ProjectSettings`. If `allowTimeTracking` is set to `false`, the backend will reject logging or timer operations with `403 Forbidden` and the frontend will hide time tracking features for that project.
>
> **Timesheet Submission & Period**:
> Timesheets represent a defined weekly or monthly period. When a user submits a timesheet:
> 1. It gathers all their unlinked `TimeEntry` records within that date range.
> 2. It locks those entries so they cannot be edited or archived while the timesheet is `SUBMITTED` or `APPROVED`.
> 3. Approval will require role permissions matching Manager/Owner.
>
> **Rejection Status Retention**:
> Instead of reverting to `DRAFT` upon rejection, the timesheet will explicitly enter the `REJECTED` state, preserving the manager's `approvalComment` in history. The user can review the rejection comments, modify their time entries, and resubmit.

---

## Open Questions

> [!NOTE]
> 1. **Time Entry Archiving Exclusion**:
>    Archived time entries (where `deletedAt != null`) will be kept in database history and remained linked to timesheets for reporting consistency, but will be excluded from active timesheet aggregation and user edits.

---

## Proposed Changes

### 1. Database Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/prisma/schema.prisma)
* Add `TimesheetStatus` enum: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`.
* Add `TimeEntrySource` enum: `MANUAL`, `TIMER`.
* Add `Timesheet` model to track period approvals:
  ```prisma
  enum TimesheetStatus {
    DRAFT
    SUBMITTED
    APPROVED
    REJECTED
  }

  model Timesheet {
    id              String          @id @default(uuid())
    userId          String
    user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
    organizationId  String
    organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    
    startDate       DateTime
    endDate         DateTime
    status          TimesheetStatus @default(DRAFT)
    approvalComment String?
    
    approvedById    String?
    approvedBy      User?           @relation("ApprovedTimesheets", fields: [approvedById], references: [id], onDelete: SetNull)
    
    timeEntries     TimeEntry[]
    
    createdAt       DateTime        @default(now())
    updatedAt       DateTime        @updatedAt
    deletedAt       DateTime?

    @@map("timesheets")
  }
  ```
* Add `TimeEntry` model to track actual logged work hours:
  ```prisma
  enum TimeEntrySource {
    MANUAL
    TIMER
  }

  model TimeEntry {
    id             String          @id @default(uuid())
    hours          Float           @default(0)
    loggedAt       DateTime
    description    String?
    billable       Boolean         @default(true)
    source         TimeEntrySource
    
    // Timer properties
    isTimerRunning Boolean         @default(false)
    timerStartedAt DateTime?
    
    projectId      String
    project        Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
    
    taskId         String?
    task           Task?           @relation(fields: [taskId], references: [id], onDelete: SetNull)
    
    userId         String
    user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
    
    organizationId String
    organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    
    timesheetId    String?
    timesheet      Timesheet?      @relation(fields: [timesheetId], references: [id], onDelete: SetNull)
    
    createdAt      DateTime        @default(now())
    updatedAt      DateTime        @updatedAt
    deletedAt      DateTime?

    @@map("time_entries")
  }
  ```
* Update `User` model to relate to `Timesheet[]`, `TimeEntry[]`, and `ApprovedTimesheets`.

---

### 2. Backend Time Tracking Module (NestJS)

Create the `time-tracking` module under `backend/src/time-tracking/`.

#### [NEW] [time-tracking.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/time-tracking/time-tracking.module.ts)
Registers dependencies, controllers, and services.

#### [NEW] [time-tracking.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/time-tracking/time-tracking.controller.ts)
Exposes endpoints for manual and timer logging:
* `POST /time-entries` (Log manual time; Requires `LOG_TIME_ENTRY`)
* `POST /time-entries/timer/start` (Start timer; Requires `LOG_TIME_ENTRY`)
* `POST /time-entries/timer/stop` (Stop timer & log hours; Requires `LOG_TIME_ENTRY`)
* `GET /time-entries/active` (Get current active timer; Requires `LOG_TIME_ENTRY`)
* `POST /time-entries/:id/archive` (Soft deletes time entry; Requires `ARCHIVE_TIME_ENTRY`)
* `GET /projects/:projectId/time-entries` (Get project logs; Requires `VIEW_TIME_ENTRY`)
* `GET /tasks/:taskId/time-entries` (Get task logs; Requires `VIEW_TIME_ENTRY`)
* `POST /timesheets/submit` (Submit timesheet; Requires `SUBMIT_TIMESHEET`)
* `PATCH /timesheets/:id/approve` (Approve/reject timesheet with comments; Requires `APPROVE_TIMESHEET`)

#### [NEW] [time-tracking.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/backend/src/time-tracking/time-tracking.service.ts)
* **`logManualTime(orgId, userId, dto)`**:
  * Validates `allowTimeTracking` in project settings.
  * Sets `source = MANUAL`.
  * Creates `TimeEntry`, creates `TaskActivity` of type `TIME_LOGGED` and `AuditLog` of type `TIME_LOGGED`.
* **`startTimer(orgId, userId, dto)`**:
  * Enforces active timer protection. Checks for existing running timer for user.
  * If found, automatically stops it, calculates duration, persists its `TimeEntry` with `source = TIMER`, and creates stopping logs.
  * Starts a new timer: `isTimerRunning: true`, `timerStartedAt: now`.
  * Creates `TaskActivity: TIMER_STARTED`.
* **`stopTimer(orgId, userId)`**:
  * Calculates duration from `timerStartedAt` to `now` in hours.
  * Updates `TimeEntry` set `isTimerRunning: false`, `hours: duration`, `loggedAt: now`, and `source = TIMER`.
  * Creates `TaskActivity: TIMER_STOPPED`.
* **`archiveTimeEntry(orgId, userId, timeEntryId)`**:
  * Updates `deletedAt` with timestamp (soft delete).
  * Creates `TaskActivity: TIME_ARCHIVED` and `AuditLog: TIME_ARCHIVED`.
* **`submitTimesheet(orgId, userId, dto)`**:
  * Gathers and links all unarchived time entries for the date range.
  * Updates or creates timesheet setting status to `SUBMITTED`.
  * Logs `AuditLog: TIMESHEET_SUBMITTED`.
* **`approveTimesheet(orgId, userId, timesheetId, dto)`**:
  * Updates timesheet status to `APPROVED` or `REJECTED` and saves `approvalComment`.
  * Logs `AuditLog: TIMESHEET_APPROVED` or `TIMESHEET_REJECTED`.

---

### 3. Frontend Time Integration (Next.js)

#### [NEW] [floating-timer.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/floating-timer.tsx)
Floating widget visible on all pages:
* Periodically fetches current running timer.
* Shows stopwatch ticking.
* Stop button prompts for task description and submits status change.

#### [NEW] [time-logs-tab.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/time-logs-tab.tsx)
Renders inside project details pages under **Time Logs** tab:
* **Manual Time Log Form**: Pop-up to enter date, task link, hours, description, and billable toggle.
* **Totals Panel**: Shows summary statistics:
  * Total Logged Hours
  * Billable Hours
  * Non-Billable Hours
  * Estimated Hours
  * Remaining Hours
  * Variance Indicator: **Under Budget** (logged < estimated), **On Target** (logged = estimated), or **Over Budget** (logged > estimated).

#### [MODIFY] [page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/app/(dashboard)/projects/[id]/page.tsx)
* Integrate navigation tab for **Time Logs**.
* Hide/disable if `allowTimeTracking === false` on project settings.

#### [MODIFY] [task-detail-drawer.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%20System/frontend/components/task-detail-drawer.tsx)
* Integrate task-level time log list.
* Add stopwatch action toggle.
* Render comparison progress bar of task estimated hours vs logged hours.

---

## Verification Plan

### Automated Tests
* Run schema migrations:
  ```bash
  $env:PATH = "C:\Program Files\sf\client\bin;" + $env:PATH; node "C:\Program Files\sf\client\node_modules\npm\bin\npx-cli.js" prisma migrate dev --name add_time_tracking
  ```

### Manual Verification
1. **Log Manual Time**: Add a log for `3` hours. Toggle billable on and off. Check reports.
2. **Start/Stop Stopwatch**: Test timer, stop, add description, and confirm source is saved as `TIMER`.
3. **Timer Conflict**: Run a timer on task A, then click start on task B. Verify timer A stops automatically and records time logs.
4. **Approval Flow with Comments**:
   * Submit weekly timesheet.
   * Approve timesheet with comment: "APPROVED". Confirm status becomes `APPROVED`.
   * Submit another week, reject with comment: "Need descriptions on Sunday logs". Confirm status becomes `REJECTED` and comment is visible to user.
5. **Archive Action**: Click archive on a log. Confirm it is removed from active lists but visible in historical reports and linked timesheets.
