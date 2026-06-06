# Phase 9: Notifications — Implementation Plan

This phase implements a highly customizable, event-driven, and database-backed **Notifications Module** for the Enterprise Project Management System. It introduces persistent notification records, user-controlled notification preferences, Socket.IO-based real-time push alerts, and an interactive frontend notification center.

---

## User Review Required

> [!IMPORTANT]
> **Decoupled Architecture (Event-Driven)**
> To avoid direct coupling between business services, persistence, and Socket.IO delivery, we implement an event-driven flow:
> `Business Service` ➔ `NotificationService.createNotification()` (Saves to DB) ➔ `Publish Internal Event` (via Node.js EventEmitter) ➔ `NotificationGateway` (Listens and delivers via Socket.IO). This allows future additions (e.g. email, SMS, mobile push) without changing business logic.

> [!IMPORTANT]
> **Implicit Preference Defaults**
> When a user is created, their `NotificationPreference` record will default to all values `true`. If no record exists for a user, the service will fallback to sending the notification, ensuring no alerts are missed.

---

## Proposed Changes

### 1. Database Schema & Migration

#### [MODIFY] [schema.prisma](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/prisma/schema.prisma)

Add `NotificationType` enum, update `User`, and add the `Notification` and `NotificationPreference` models:

```prisma
enum NotificationType {
  TASK_ASSIGNMENT
  TASK_COMMENT
  ISSUE_ASSIGNMENT
  ISSUE_COMMENT
  ISSUE_RESOLVED
  MILESTONE_UPDATE
  TIMESHEET_SUBMITTED
  TIMESHEET_APPROVED
  TIMESHEET_REJECTED
  SYSTEM
}

model Notification {
  id             String           @id @default(uuid())
  type           NotificationType
  title          String
  message        String
  isRead         Boolean          @default(false)
  readAt         DateTime?
  actionUrl      String?
  metadata       String?          // SQLite does not support JSON columns natively, stored as stringified JSON
  
  // Recipient of the notification
  userId         String
  user           User             @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  
  // Trigger Source (who caused the notification, e.g. commenter, assigner)
  triggeredById  String?
  triggeredBy    User?            @relation("NotificationTriggeredBy", fields: [triggeredById], references: [id], onDelete: SetNull)
  
  // Optional Entity Associations for deep-linking
  projectId      String?
  project        Project?         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  taskId         String?
  task           Task?            @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  issueId        String?
  issue          Issue?           @relation(fields: [issueId], references: [id], onDelete: Cascade)
  
  organizationId String
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?

  @@map("notifications")
}

model NotificationPreference {
  id                 String   @id @default(uuid())
  
  userId             String   @unique
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  taskAssignment     Boolean  @default(true)
  taskComment        Boolean  @default(true)
  
  issueAssignment    Boolean  @default(true)
  issueComment       Boolean  @default(true)
  
  milestoneUpdate    Boolean  @default(true)
  
  timesheetSubmitted Boolean  @default(true)
  timesheetApproved  Boolean  @default(true)
  timesheetRejected  Boolean  @default(true)
  
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("notification_preferences")
}
```

Update relation declarations in `User`, `Organization`, `Project`, `Task`, and `Issue` models.

---

### 2. Backend Implementation (NestJS)

#### [NEW] [notification.module.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/notification/notification.module.ts)
Registers `NotificationGateway`, `NotificationService`, and `NotificationController`. Imports `PrismaModule` and `JwtModule`. Exposes `NotificationService` for other modules.

#### [NEW] [notification.gateway.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/notification/notification.gateway.ts)
Socket.IO Gateway:
* Binds to namespace `/notifications`.
* Handshake level JWT middleware checks for validation and extracts client data.
* Joins connecting socket to `user:${userId}` room.
* Listens to the internal event system (`notification.created`) and emits events `notification_received` real-time to active user rooms.

#### [NEW] [notification.service.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/notification/notification.service.ts)
Key service layers:
* **`createNotification(dto)`**: Saves notification records to the database (checking preferences first) and emits an internal event.
* **`createNotificationsBulk(dtos)`**: Saves multiple notifications in a single Prisma transaction and fires internal socket broadcast events.
* **`getUserNotifications()`**: Retrieves non-archived notifications (`deletedAt: null`).
* **`markAsRead()`**: Sets `isRead: true` and `readAt: new Date()`.
* **`archiveNotification()`**: Sets `deletedAt: new Date()` (soft-delete behavior).

#### [NEW] [notification.controller.ts](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/backend/src/notification/notification.controller.ts)
REST APIs:
* `GET /notifications` - List user's active notifications.
* `POST /notifications/:id/archive` - Soft-delete/archive a notification.
* `POST /notifications/:id/read` - Mark specific notification as read.
* `POST /notifications/read-all` - Mark all notifications as read.
* `GET /notifications/preferences` - Get notification subscription settings.
* `PATCH /notifications/preferences` - Update settings.

---

### 3. Frontend Integration (Next.js)

#### [NEW] [notifications/page.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/app/(dashboard)/settings/notifications/page.tsx)
Notification subscription preference configuration panel rendering settings switches for custom categories.

#### [NEW] [notification-bell.tsx](file:///c:/Salesforce/Labs/NSK/Project%20Management%2520System/frontend/components/notification-bell.tsx)
Bell navigation button and dropdown panel:
* Listens for push events (`notification_received`) in real-time.
* Displays unread badge counts and sliding toast notifications.
* Integrates options to mark read, bulk read, and archive notifications.

---

## Verification Plan

### Automated Tests
* Run schema migration:
  ```bash
  npx prisma migrate dev --name add_notifications
  ```
* Seed tests: Ensure user seed creates notification preferences.

### Manual Verification
1. Login with multiple browsers for User A and User B.
2. User A updates notification preferences to disable "Issue Assignments".
3. User B assigns an issue to User A. Verify no notification is stored in DB or pushed.
4. User A enables "Issue Assignments". User B assigns another issue. Verify notification is successfully saved, pushed in real-time, and is visible in User A's dropdown.
5. Click a notification, verify routing redirect via `actionUrl` (automatically maps dynamic paths to project details page query params without 404s).
6. Click archive, verify `POST /notifications/:id/archive` soft-deletes and removes it from active list.
