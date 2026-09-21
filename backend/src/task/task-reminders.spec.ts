import { Test, TestingModule } from '@nestjs/testing';
import { TaskReminderService } from './task-reminder.service';
import { TaskService } from './task.service';
import { RecurringTaskService } from './recurring-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import {
  ReminderType,
  ReminderRecipientType,
  ReminderStatus,
  TaskStatus,
  TaskPriority,
  TaskType,
  NotificationType,
} from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CustomFieldService } from '../custom-field/custom-field.service';

describe('Task Reminders & Notifications System (Zoho Projects Spec)', () => {
  let reminderService: TaskReminderService;
  let taskService: TaskService;
  let recurringService: RecurringTaskService;
  let notificationService: NotificationService;
  let prisma: PrismaService;

  const mockOrgId = 'org-101';
  const mockUserId = 'user-owner';
  const mockAssigneeId = 'user-assignee';
  const mockReporterId = 'user-reporter';
  const mockWatcherId = 'user-watcher';
  const mockMentionedId = 'user-mentioned';
  const mockProjectId = 'proj-202';
  const mockTaskId = 'task-303';

  const mockProject = {
    id: mockProjectId,
    name: 'Mars Rover Mission',
    projectCode: 'ROVER',
    organizationId: mockOrgId,
    status: 'ACTIVE',
    visibility: 'ORGANIZATION',
    isStrict: false,
    workingDays: '1,2,3,4,5',
    nextTaskNumber: 10,
    members: [
      { userId: mockUserId, role: 'OWNER', deletedAt: null },
      { userId: mockAssigneeId, role: 'MEMBER', deletedAt: null },
      { userId: mockWatcherId, role: 'MEMBER', deletedAt: null },
      { userId: mockMentionedId, role: 'MEMBER', deletedAt: null },
    ],
  };

  const mockTask = {
    id: mockTaskId,
    title: 'Deploy Telemetry Sensor',
    description: 'Calibrate and deploy rover sensor package',
    taskNumber: 42,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    type: TaskType.TASK,
    startDate: new Date('2026-10-10T09:00:00.000Z'),
    dueDate: new Date('2026-10-15T18:00:00.000Z'),
    projectId: mockProjectId,
    organizationId: mockOrgId,
    assigneeId: mockAssigneeId,
    reporterId: mockReporterId,
    project: mockProject,
    watchers: [{ userId: mockWatcherId }],
    deletedAt: null,
  };

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
      findUnique: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
    },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskReminder: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskComment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    taskAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    taskActivity: {
      create: jest.fn(),
    },
    taskDependency: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id || 'user-default',
          organizationId: mockOrgId,
          firstName: 'User',
          lastName: 'Test',
          email: 'user@test.com',
        });
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockNotificationService = {
    createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    createNotificationsBulk: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskReminderService,
        TaskService,
        RecurringTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        {
          provide: CustomFieldService,
          useValue: {
            validateAndSanitizeTaskCustomFields: jest.fn().mockImplementation((_, __, val) => Promise.resolve(val)),
            getCustomFieldDefinitions: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    reminderService = module.get<TaskReminderService>(TaskReminderService);
    taskService = module.get<TaskService>(TaskService);
    recurringService = module.get<RecurringTaskService>(RecurringTaskService);
    notificationService = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);

    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.task.findFirst.mockResolvedValue(mockTask);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
  });

  // ─── 1. Reminder Calculation Engine Tests ─────────────────────────────────

  describe('1. Reminder Calculation Engine', () => {
    it('should calculate BEFORE_DUE reminder (1 day before default)', () => {
      const due = new Date('2026-10-15T18:00:00.000Z');
      const remindAt = reminderService.calculateRemindAt(
        due,
        ReminderType.BEFORE_DUE,
        1440, // 1440 mins = 24 hours
      );

      expect(remindAt.toISOString()).toBe('2026-10-14T18:00:00.000Z');
    });

    it('should calculate BEFORE_DUE reminder with custom offset (2 hours before)', () => {
      const due = new Date('2026-10-15T18:00:00.000Z');
      const remindAt = reminderService.calculateRemindAt(
        due,
        ReminderType.BEFORE_DUE,
        120, // 120 mins = 2 hours
      );

      expect(remindAt.toISOString()).toBe('2026-10-15T16:00:00.000Z');
    });

    it('should calculate ON_DUE reminder with specific timeOfDay', () => {
      const due = new Date('2026-10-15T00:00:00.000Z');
      const remindAt = reminderService.calculateRemindAt(
        due,
        ReminderType.ON_DUE,
        undefined,
        '09:30',
      );

      expect(remindAt.getHours()).toBe(9);
      expect(remindAt.getMinutes()).toBe(30);
    });

    it('should calculate AFTER_DUE (overdue) reminder (1 day after)', () => {
      const due = new Date('2026-10-15T18:00:00.000Z');
      const remindAt = reminderService.calculateRemindAt(
        due,
        ReminderType.AFTER_DUE,
        1440,
      );

      expect(remindAt.toISOString()).toBe('2026-10-16T18:00:00.000Z');
    });

    it('should handle CUSTOM_DATE reminder correctly', () => {
      const customIso = '2026-10-12T14:30:00.000Z';
      const remindAt = reminderService.calculateRemindAt(
        null,
        ReminderType.CUSTOM_DATE,
        undefined,
        undefined,
        customIso,
      );

      expect(remindAt.toISOString()).toBe(customIso);
    });

    it('should reject due date reminder if task has no due date', () => {
      expect(() => {
        reminderService.calculateRemindAt(null, ReminderType.BEFORE_DUE);
      }).toThrow(BadRequestException);
    });
  });

  // ─── 2. Reminder CRUD & Permission Tests ──────────────────────────────────

  describe('2. Reminder CRUD & Configuration', () => {
    it('should create a reminder with proper defaults', async () => {
      mockPrisma.taskReminder.create.mockResolvedValue({
        id: 'rem-1',
        taskId: mockTaskId,
        type: ReminderType.BEFORE_DUE,
        remindAt: new Date('2026-10-14T18:00:00.000Z'),
        recipientType: ReminderRecipientType.ASSIGNEE,
        status: ReminderStatus.PENDING,
      });

      const result = await reminderService.createReminder(
        mockOrgId,
        mockUserId,
        mockTaskId,
        {
          type: ReminderType.BEFORE_DUE,
          offsetMinutes: 1440,
        },
      );

      expect(result.id).toBe('rem-1');
      expect(mockPrisma.taskReminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: mockTaskId,
            type: ReminderType.BEFORE_DUE,
            recipientType: ReminderRecipientType.ASSIGNEE,
            status: ReminderStatus.PENDING,
          }),
        }),
      );
    });

    it('should reject creating a reminder in an archived project', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        ...mockTask,
        project: { ...mockProject, status: 'ARCHIVED' },
      });

      await expect(
        reminderService.createReminder(mockOrgId, mockUserId, mockTaskId, {
          type: ReminderType.BEFORE_DUE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject CUSTOM_USER recipientType without recipientId', async () => {
      await expect(
        reminderService.createReminder(mockOrgId, mockUserId, mockTaskId, {
          type: ReminderType.BEFORE_DUE,
          recipientType: ReminderRecipientType.CUSTOM_USER,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── 3. Dynamic Rescheduling on Due Date Change ───────────────────────────

  describe('3. Dynamic Rescheduling on Due Date Change', () => {
    it('should recalculate remindAt for all relative pending reminders when task due date changes', async () => {
      const originalReminder = {
        id: 'rem-1',
        taskId: mockTaskId,
        type: ReminderType.BEFORE_DUE,
        offsetMinutes: 1440, // 1 day before
        remindAt: new Date('2026-10-14T18:00:00.000Z'),
        status: ReminderStatus.PENDING,
      };

      mockPrisma.taskReminder.findMany.mockResolvedValue([originalReminder]);
      mockPrisma.taskReminder.update.mockResolvedValue({});

      const newDueDate = new Date('2026-10-20T18:00:00.000Z');
      await reminderService.rescheduleTaskReminders(mockTaskId, newDueDate);

      expect(mockPrisma.taskReminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: {
          remindAt: new Date('2026-10-19T18:00:00.000Z'), // 1 day before new due date
        },
      });
    });

    it('should cancel relative pending reminders if due date is removed', async () => {
      const originalReminder = {
        id: 'rem-1',
        taskId: mockTaskId,
        type: ReminderType.BEFORE_DUE,
        remindAt: new Date('2026-10-14T18:00:00.000Z'),
        status: ReminderStatus.PENDING,
      };

      mockPrisma.taskReminder.findMany.mockResolvedValue([originalReminder]);

      await reminderService.rescheduleTaskReminders(mockTaskId, null);

      expect(mockPrisma.taskReminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: { status: ReminderStatus.CANCELLED },
      });
    });
  });

  // ─── 4. Auto-Dismissal on Task Completion ─────────────────────────────────

  describe('4. Task Completion Auto-Dismissal', () => {
    it('should auto-dismiss pending reminders when task is marked DONE', async () => {
      await reminderService.dismissTaskRemindersOnDone(mockTaskId);

      expect(mockPrisma.taskReminder.updateMany).toHaveBeenCalledWith({
        where: {
          taskId: mockTaskId,
          deletedAt: null,
          status: ReminderStatus.PENDING,
        },
        data: {
          status: ReminderStatus.DISMISSED,
        },
      });
    });
  });

  // ─── 5. Scheduled Reminder Processing & Overdue Repetition ────────────────

  describe('5. Scheduled Reminder Processing Engine', () => {
    it('should dispatch due reminders to designated recipients', async () => {
      const dueReminder = {
        id: 'rem-1',
        organizationId: mockOrgId,
        type: ReminderType.BEFORE_DUE,
        remindAt: new Date(Date.now() - 1000), // Past due
        recipientType: ReminderRecipientType.ALL_STAKEHOLDERS,
        repeatDailyIfOverdue: false,
        createdById: mockUserId,
        task: {
          ...mockTask,
          status: TaskStatus.IN_PROGRESS,
        },
      };

      mockPrisma.taskReminder.findMany.mockResolvedValue([dueReminder]);
      mockPrisma.taskReminder.update.mockResolvedValue({});

      const stats = await reminderService.processDueReminders(50);

      expect(stats.processed).toBe(1);
      expect(stats.dispatched).toBeGreaterThan(0);
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.TASK_REMINDER_DUE,
            taskId: mockTaskId,
          }),
        ]),
      );
      expect(mockPrisma.taskReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-1' },
          data: expect.objectContaining({ status: ReminderStatus.SENT }),
        }),
      );
    });

    it('should advance remindAt by 24h for repeating overdue reminders', async () => {
      const pastTime = new Date('2026-10-16T18:00:00.000Z');
      const overdueReminder = {
        id: 'rem-overdue',
        organizationId: mockOrgId,
        type: ReminderType.AFTER_DUE,
        remindAt: pastTime,
        recipientType: ReminderRecipientType.ASSIGNEE,
        repeatDailyIfOverdue: true,
        createdById: mockUserId,
        task: {
          ...mockTask,
          status: TaskStatus.IN_PROGRESS,
          dueDate: new Date('2026-10-15T18:00:00.000Z'),
        },
      };

      mockPrisma.taskReminder.findMany.mockResolvedValue([overdueReminder]);
      mockPrisma.taskReminder.update.mockResolvedValue({});

      await reminderService.processDueReminders(50);

      expect(mockPrisma.taskReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-overdue' },
          data: expect.objectContaining({
            status: ReminderStatus.PENDING, // Kept pending for next run
            remindAt: new Date(pastTime.getTime() + 24 * 60 * 60 * 1000),
          }),
        }),
      );
    });

    it('should dismiss reminder if task was completed before scheduler ran', async () => {
      const dueReminder = {
        id: 'rem-completed-task',
        organizationId: mockOrgId,
        type: ReminderType.BEFORE_DUE,
        remindAt: new Date(Date.now() - 1000),
        recipientType: ReminderRecipientType.ASSIGNEE,
        task: {
          ...mockTask,
          status: TaskStatus.DONE, // Already completed
        },
      };

      mockPrisma.taskReminder.findMany.mockResolvedValue([dueReminder]);
      mockPrisma.taskReminder.update.mockResolvedValue({});

      const stats = await reminderService.processDueReminders(50);

      expect(stats.dismissed).toBe(1);
      expect(mockPrisma.taskReminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-completed-task' },
        data: { status: ReminderStatus.DISMISSED },
      });
      expect(mockNotificationService.createNotificationsBulk).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Event-Driven Notifications & Mention Parsing ──────────────────────

  describe('6. Event-Driven Notifications & Mention Parsing', () => {
    it('should parse @mentions in comment and dispatch TASK_MENTION vs TASK_COMMENT', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id || mockUserId,
          organizationId: mockOrgId,
          firstName: 'Jane',
          lastName: 'Doe',
        });
      });

      mockPrisma.taskComment.create.mockResolvedValue({
        id: 'comment-1',
        taskId: mockTaskId,
        userId: mockUserId,
        content: `Hey @[Dave Mention](${mockMentionedId}), please review telemetry.`,
      });

      await taskService.createComment(mockOrgId, mockUserId, mockTaskId, {
        content: `Hey @[Dave Mention](${mockMentionedId}), please review telemetry.`,
      });

      // 1. Mention notification should be sent to mentioned user
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.TASK_MENTION,
            userId: mockMentionedId,
          }),
        ]),
      );

      // 2. Regular comment notification should be sent to watcher / assignee
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.TASK_COMMENT,
            userId: mockAssigneeId,
          }),
        ]),
      );
    });

    it('should dispatch TASK_ATTACHMENT notification when file is attached', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id || mockUserId,
          organizationId: mockOrgId,
          firstName: 'Jane',
          lastName: 'Doe',
        });
      });

      mockPrisma.taskAttachment.create.mockResolvedValue({
        id: 'att-1',
        fileName: 'telemetry_report.pdf',
        fileUrl: 'https://cdn.example.com/telemetry_report.pdf',
        fileSize: 1024,
      });

      await taskService.createAttachment(mockOrgId, mockUserId, mockTaskId, {
        fileName: 'telemetry_report.pdf',
        fileUrl: 'https://cdn.example.com/telemetry_report.pdf',
        fileSize: 1024,
      });

      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.TASK_ATTACHMENT,
            userId: mockAssigneeId,
          }),
        ]),
      );
    });

    it('should dispatch TASK_UNASSIGNED to previous assignee when task is unassigned or reassigned', async () => {
      mockPrisma.task.update.mockResolvedValue({
        ...mockTask,
        assigneeId: mockMentionedId,
      });

      await taskService.updateTask(mockOrgId, mockUserId, mockTaskId, {
        assigneeId: mockMentionedId,
      });

      // Unassigned notification to previous assignee
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.TASK_UNASSIGNED,
          userId: mockAssigneeId,
        }),
      );

      // Assigned notification to new assignee
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.TASK_ASSIGNMENT,
          userId: mockMentionedId,
        }),
      );
    });
  });

  // ─── 7. Recipient Determination & Self-Action Suppression ─────────────────

  describe('7. Recipient Rules & Self-Action Suppression', () => {
    it('should NOT send notification to the user who triggered the action', async () => {
      // User is the assignee and performs status change
      mockPrisma.task.findFirst.mockResolvedValue({
        ...mockTask,
        assigneeId: mockUserId, // User is self
        watchers: [{ userId: mockWatcherId }],
      });

      mockPrisma.task.update.mockResolvedValue({
        ...mockTask,
        assigneeId: mockUserId,
        status: TaskStatus.DONE,
      });

      await taskService.updateTask(mockOrgId, mockUserId, mockTaskId, {
        status: TaskStatus.DONE,
      });

      // Watcher gets notified, but triggering user (mockUserId) does NOT get self-notified
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: mockWatcherId,
          }),
        ]),
      );

      const bulkCalls = mockNotificationService.createNotificationsBulk.mock.calls;
      const allRecipientIds = bulkCalls.flatMap((call: any) => call[0].map((n: any) => n.userId));
      expect(allRecipientIds).not.toContain(mockUserId);
    });
  });
});
