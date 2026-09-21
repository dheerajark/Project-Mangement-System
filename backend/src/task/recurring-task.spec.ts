import { Test, TestingModule } from '@nestjs/testing';
import { RecurringTaskService } from './recurring-task.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  RecurrenceFrequency,
  RecurrenceEndType,
  RecurrenceNonWorkingDayAction,
  RecurrenceStatus,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskBillingType,
  NotificationType,
} from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RecurringTaskService (Zoho Projects Spec)', () => {
  let service: RecurringTaskService;
  let prisma: PrismaService;
  let notificationService: NotificationService;

  const mockOrgId = 'org-1';
  const mockUserId = 'user-owner';
  const mockAssigneeId = 'user-assignee';
  const mockProjectId = 'proj-1';
  const mockTaskId = 'task-1';
  const mockRecurrenceId = 'recur-1';

  const mockProject = {
    id: mockProjectId,
    name: 'Apollo Project',
    projectCode: 'APOLLO',
    organizationId: mockOrgId,
    status: 'ACTIVE',
    visibility: 'ORGANIZATION',
    isStrict: false,
    workingDays: '1,2,3,4,5', // Mon-Fri
    nextTaskNumber: 5,
    members: [
      { userId: mockUserId, role: 'OWNER', deletedAt: null },
      { userId: mockAssigneeId, role: 'MEMBER', deletedAt: null },
    ],
  };

  const mockTask = {
    id: mockTaskId,
    title: 'Weekly Standup Preparation',
    description: 'Prepare standup agenda and notes',
    taskNumber: 1,
    status: TaskStatus.TODO,
    priority: TaskPriority.HIGH,
    type: TaskType.TASK,
    billingType: TaskBillingType.BILLABLE,
    estimatedHours: 2.5,
    startDate: new Date('2026-10-05T09:00:00.000Z'), // Monday
    dueDate: new Date('2026-10-07T18:00:00.000Z'), // Wednesday (2 days duration)
    tags: 'standup, weekly',
    customFields: '{"room":"A1"}',
    projectId: mockProjectId,
    organizationId: mockOrgId,
    assigneeId: mockAssigneeId,
    reporterId: mockUserId,
    milestoneId: null,
    taskListId: null,
    parentTaskId: null,
    project: mockProject,
    subtasks: [],
    deletedAt: null,
  };

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskRecurrence: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskActivity: {
      create: jest.fn(),
    },
    taskReminder: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringTaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<RecurringTaskService>(RecurringTaskService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);

    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.project.update.mockResolvedValue(mockProject);
    mockPrisma.task.findFirst.mockResolvedValue(mockTask);
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    mockPrisma.task.update.mockResolvedValue(mockTask);
    mockPrisma.task.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `task-gen-${data.recurrenceIndex || 2}`, ...data }),
    );
    mockPrisma.taskActivity.create.mockResolvedValue({ id: 'act-1' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  // ─── 1. Recurrence Calculations (Daily, Weekly, Monthly, Yearly) ───────────

  describe('1. Recurrence Calculation Engine', () => {
    const workingDays = new Set([1, 2, 3, 4, 5]);

    it('should calculate daily recurrence with interval', () => {
      const fromDate = new Date('2026-10-01T09:00:00.000Z');
      const nextDate = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.DAILY,
          interval: 3,
          startDate: fromDate,
          nonWorkingDayAction: RecurrenceNonWorkingDayAction.EXACT_DATE,
        },
        fromDate,
      );

      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toBe('2026-10-04T09:00:00.000Z');
    });

    it('should calculate weekly recurrence on specific days (Mon, Wed, Fri)', () => {
      // 2026-10-05 is a Monday (ISO day 1)
      const monday = new Date('2026-10-05T09:00:00.000Z');
      const wednesday = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: '1,3,5', // Mon, Wed, Fri
          startDate: monday,
        },
        monday,
      );

      // Next in week should be Wednesday (2026-10-07)
      expect(wednesday).toBeDefined();
      expect(wednesday?.toISOString()).toBe('2026-10-07T09:00:00.000Z');

      // From Friday, next should jump to following Monday
      const friday = new Date('2026-10-09T09:00:00.000Z');
      const nextMonday = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: '1,3,5',
          startDate: monday,
        },
        friday,
      );
      expect(nextMonday?.toISOString()).toBe('2026-10-12T09:00:00.000Z');
    });

    it('should calculate monthly recurrence on a specific day of the month', () => {
      const oct15 = new Date('2026-10-15T09:00:00.000Z');
      const nov15 = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          dayOfMonth: 15,
          startDate: oct15,
          nonWorkingDayAction: RecurrenceNonWorkingDayAction.EXACT_DATE,
        },
        oct15,
      );

      expect(nov15?.toISOString()).toBe('2026-11-15T09:00:00.000Z');
    });

    it('should calculate monthly recurrence on the last day of month (-1)', () => {
      const oct31 = new Date('2026-10-31T09:00:00.000Z');
      const nov30 = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          dayOfMonth: -1,
          startDate: oct31,
          nonWorkingDayAction: RecurrenceNonWorkingDayAction.EXACT_DATE,
        },
        oct31,
      );

      expect(nov30?.toISOString()).toBe('2026-11-30T09:00:00.000Z');
    });

    it('should calculate relative weekday monthly recurrence (e.g. 2nd Tuesday)', () => {
      // In Nov 2026: 1st Tue is Nov 3, 2nd Tue is Nov 10
      const oct10 = new Date('2026-10-10T09:00:00.000Z');
      const novSecondTue = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          weekOfMonth: 2, // 2nd week
          relativeDayOfWeek: 2, // Tuesday
          startDate: oct10,
          nonWorkingDayAction: RecurrenceNonWorkingDayAction.EXACT_DATE,
        },
        oct10,
      );

      expect(novSecondTue?.getDate()).toBe(10);
      expect(novSecondTue?.getMonth()).toBe(10); // November (0-indexed 10)
    });

    it('should calculate yearly recurrence', () => {
      const oct1 = new Date('2026-10-01T09:00:00.000Z');
      const nextYear = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.YEARLY,
          interval: 1,
          dayOfMonth: 1,
          monthOfYear: 10,
          startDate: oct1,
          nonWorkingDayAction: RecurrenceNonWorkingDayAction.EXACT_DATE,
        },
        oct1,
      );

      expect(nextYear?.getFullYear()).toBe(2027);
      expect(nextYear?.getMonth()).toBe(9); // October
      expect(nextYear?.getDate()).toBe(1);
    });
  });

  // ─── 2. Working Days & Non-Working Day Adjustment ──────────────────────────

  describe('2. Working Days & Weekend Adjustment', () => {
    const workingDays = new Set([1, 2, 3, 4, 5]); // Mon-Fri

    it('should shift weekend date forward to next Monday with NEXT_WORKING_DAY', () => {
      // 2026-10-10 is a Saturday
      const saturday = new Date('2026-10-10T09:00:00.000Z');
      const adjusted = service.adjustForNonWorkingDays(
        saturday,
        RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY,
        workingDays,
      );

      // Should become Monday 2026-10-12
      expect(adjusted.getDate()).toBe(12);
      expect(adjusted.getDay()).toBe(1); // Monday
    });

    it('should shift weekend date backward to Friday with PREVIOUS_WORKING_DAY', () => {
      // 2026-10-10 is a Saturday
      const saturday = new Date('2026-10-10T09:00:00.000Z');
      const adjusted = service.adjustForNonWorkingDays(
        saturday,
        RecurrenceNonWorkingDayAction.PREVIOUS_WORKING_DAY,
        workingDays,
      );

      // Should become Friday 2026-10-09
      expect(adjusted.getDate()).toBe(9);
      expect(adjusted.getDay()).toBe(5); // Friday
    });

    it('should preserve exact calendar date with EXACT_DATE', () => {
      const saturday = new Date('2026-10-10T09:00:00.000Z');
      const adjusted = service.adjustForNonWorkingDays(
        saturday,
        RecurrenceNonWorkingDayAction.EXACT_DATE,
        workingDays,
      );

      expect(adjusted.getDate()).toBe(10);
      expect(adjusted.getDay()).toBe(6); // Saturday
    });
  });

  // ─── 3. Recurrence Duration & End Conditions ───────────────────────────────

  describe('3. Recurrence End Conditions', () => {
    it('should return null when maxOccurrences is reached with AFTER_OCCURRENCES', () => {
      const start = new Date('2026-10-01T09:00:00.000Z');
      const nextDate = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          startDate: start,
          endType: RecurrenceEndType.AFTER_OCCURRENCES,
          maxOccurrences: 5,
          occurrencesCount: 5,
        },
        start,
      );

      expect(nextDate).toBeNull();
    });

    it('should return null when next date exceeds endDate with ON_DATE', () => {
      const start = new Date('2026-10-01T09:00:00.000Z');
      const endDate = new Date('2026-10-10T09:00:00.000Z');
      const current = new Date('2026-10-09T09:00:00.000Z');

      const nextDate = service.calculateNextOccurrenceDate(
        {
          frequency: RecurrenceFrequency.DAILY,
          interval: 3,
          startDate: start,
          endType: RecurrenceEndType.ON_DATE,
          endDate,
          occurrencesCount: 3,
        },
        current,
      );

      // 2026-10-09 + 3 days = 2026-10-12 > 2026-10-10
      expect(nextDate).toBeNull();
    });
  });

  // ─── 4. Recurrence Configuration & CRUD ────────────────────────────────────

  describe('4. Recurrence Configuration & Lifecycle', () => {
    it('should configure recurrence on a task and link it as template', async () => {
      const mockCreatedRecurrence = {
        id: mockRecurrenceId,
        organizationId: mockOrgId,
        projectId: mockProjectId,
        originalTaskId: mockTaskId,
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        daysOfWeek: '1,3',
        status: RecurrenceStatus.ACTIVE,
        occurrencesCount: 1,
      };

      mockPrisma.taskRecurrence.create.mockResolvedValue(mockCreatedRecurrence);

      const res = await service.configureRecurrence(
        mockOrgId,
        mockUserId,
        mockTaskId,
        {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: '1,3',
          startDate: '2026-10-05T09:00:00.000Z',
          endType: RecurrenceEndType.NEVER,
        },
      );

      expect(res).toBeDefined();
      expect(mockPrisma.taskRecurrence.create).toHaveBeenCalled();
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: mockTaskId },
        data: expect.objectContaining({
          recurringTaskId: mockRecurrenceId,
          recurrenceIndex: 1,
          isRecurringTemplate: true,
        }),
      });
      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: mockTaskId,
          action: 'TASK_RECURRENCE_CONFIGURED',
        }),
      });
    });

    it('should pause, resume, and stop recurrence series', async () => {
      const mockRec = {
        id: mockRecurrenceId,
        organizationId: mockOrgId,
        projectId: mockProjectId,
        originalTaskId: mockTaskId,
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
        startDate: new Date('2026-10-01T09:00:00.000Z'),
        status: RecurrenceStatus.ACTIVE,
        project: mockProject,
      };

      mockPrisma.taskRecurrence.findFirst.mockResolvedValue(mockRec);
      mockPrisma.taskRecurrence.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...mockRec, ...data }),
      );

      // Pause
      const paused = await service.pauseRecurrence(
        mockOrgId,
        mockUserId,
        mockRecurrenceId,
      );
      expect(paused.status).toBe(RecurrenceStatus.PAUSED);
      expect(paused.nextRunDate).toBeNull();

      // Resume
      const resumed = await service.resumeRecurrence(
        mockOrgId,
        mockUserId,
        mockRecurrenceId,
      );
      expect(resumed.status).toBe(RecurrenceStatus.ACTIVE);
      expect(resumed.nextRunDate).toBeDefined();

      // Stop
      const stopped = await service.stopRecurrence(
        mockOrgId,
        mockUserId,
        mockRecurrenceId,
      );
      expect(stopped.status).toBe(RecurrenceStatus.STOPPED);
    });
  });

  // ─── 5. Occurrence Generation & Idempotency ────────────────────────────────

  describe('5. Occurrence Generation & Idempotency', () => {
    it('should generate an occurrence with preserved fields, new taskNumber, and duration', async () => {
      const scheduledDate = new Date('2026-10-12T09:00:00.000Z');
      const mockRec = {
        id: mockRecurrenceId,
        organizationId: mockOrgId,
        projectId: mockProjectId,
        originalTaskId: mockTaskId,
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        startDate: new Date('2026-10-05T09:00:00.000Z'),
        endType: RecurrenceEndType.NEVER,
        status: RecurrenceStatus.ACTIVE,
        occurrencesCount: 1,
        nextRunDate: scheduledDate,
        cloneSubtasks: false,
        taskTemplate: JSON.stringify({
          title: 'Weekly Standup Preparation',
          priority: TaskPriority.HIGH,
          assigneeId: mockAssigneeId,
          originalDurationDays: 2,
        }),
        project: mockProject,
        createdById: mockUserId,
        deletedAt: null,
      };

      mockPrisma.taskRecurrence.findUnique.mockResolvedValue(mockRec);
      mockPrisma.task.findFirst.mockResolvedValue(null); // No duplicate exists
      mockPrisma.taskRecurrence.update.mockResolvedValue({
        ...mockRec,
        occurrencesCount: 2,
      });

      const generatedTask = await service.generateOccurrence(
        mockRecurrenceId,
        scheduledDate,
        mockUserId,
      );

      expect(generatedTask).toBeDefined();
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Weekly Standup Preparation',
          status: TaskStatus.TODO,
          progress: 0,
          recurringTaskId: mockRecurrenceId,
          recurrenceIndex: 2,
          startDate: scheduledDate,
          assigneeId: mockAssigneeId,
        }),
      });

      // Notification sent to assignee
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.RECURRING_TASK_GENERATED,
          userId: mockAssigneeId,
        }),
      );
    });

    it('should prevent duplicate task creation if occurrence index already exists', async () => {
      const existingTask = {
        id: 'task-existing-2',
        title: 'Weekly Standup',
        recurringTaskId: mockRecurrenceId,
        recurrenceIndex: 2,
      };

      const mockRec = {
        id: mockRecurrenceId,
        organizationId: mockOrgId,
        projectId: mockProjectId,
        status: RecurrenceStatus.ACTIVE,
        occurrencesCount: 1,
        project: mockProject,
        deletedAt: null,
      };

      mockPrisma.taskRecurrence.findUnique.mockResolvedValue(mockRec);
      mockPrisma.task.findFirst.mockResolvedValue(existingTask); // Existing instance found

      const res = await service.generateOccurrence(
        mockRecurrenceId,
        new Date(),
        mockUserId,
      );

      expect(res.id).toBe('task-existing-2');
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });
  });

  // ─── 6. Schedule Preview ───────────────────────────────────────────────────

  describe('6. Recurrence Schedule Preview', () => {
    it('should generate preview array of ISO date strings for UI feedback', () => {
      const previewDates = service.previewRecurrenceSchedule({
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        daysOfWeek: '1,4', // Mon, Thu
        startDate: '2026-10-05T09:00:00.000Z',
        previewCount: 4,
      });

      expect(previewDates).toHaveLength(4);
      expect(typeof previewDates[0]).toBe('string');
    });
  });
});
