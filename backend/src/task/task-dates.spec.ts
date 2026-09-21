import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { TaskStatus, TaskPriority, TaskType, TaskBillingType, NotificationType } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Task Start Date and Due Date System (Zoho Projects Spec)', () => {
  let service: TaskService;
  let prisma: PrismaService;
  let notificationService: NotificationService;

  const mockOrgId = 'org-1';
  const mockUserId = 'user-owner';
  const mockAssigneeId = 'user-assignee';
  const mockWatcherId = 'user-watcher';
  const mockProjectId = 'proj-1';
  const mockMilestoneId = 'ms-1';

  const mockProject = {
    id: mockProjectId,
    name: 'Apollo Project',
    projectCode: 'APOLLO',
    organizationId: mockOrgId,
    status: 'ACTIVE',
    visibility: 'ORGANIZATION',
    isStrict: false,
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    nextTaskNumber: 10,
    members: [
      { userId: mockUserId, role: 'OWNER', deletedAt: null },
      { userId: mockAssigneeId, role: 'MEMBER', deletedAt: null },
      { userId: mockWatcherId, role: 'MEMBER', deletedAt: null },
    ],
    settings: {
      allowFileUploads: true,
      allowTimeTracking: true,
    },
  };

  const mockMilestone = {
    id: mockMilestoneId,
    projectId: mockProjectId,
    title: 'Milestone 1',
    status: 'PLANNED',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    dueDate: new Date('2026-07-31T00:00:00.000Z'),
    organizationId: mockOrgId,
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
    milestone: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    taskList: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    taskActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    projectActivity: {
      create: jest.fn(),
    },
    taskWatcher: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    taskDependency: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
    createNotificationsBulk: jest.fn(),
  };

  const mockRecurringTaskService = {
    configureRecurrence: jest.fn().mockResolvedValue({}),
  };

  const mockTaskReminderService = {
    rescheduleTaskReminders: jest.fn().mockResolvedValue({}),
    dismissTaskRemindersOnDone: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: 'RecurringTaskService', useValue: mockRecurringTaskService },
        {
          provide: require('./recurring-task.service').RecurringTaskService,
          useValue: mockRecurringTaskService,
        },
        {
          provide: require('./task-reminder.service').TaskReminderService,
          useValue: mockTaskReminderService,
        },
        {
          provide: require('../custom-field/custom-field.service').CustomFieldService,
          useValue: {
            validateAndSanitizeTaskCustomFields: jest.fn().mockImplementation((_, __, val) => Promise.resolve(val)),
            getCustomFieldDefinitions: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);

    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.milestone.findFirst.mockResolvedValue(mockMilestone);
    mockPrisma.milestone.findUnique.mockResolvedValue(mockMilestone);
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === mockAssigneeId) {
        return Promise.resolve({
          id: mockAssigneeId,
          organizationId: mockOrgId,
          firstName: 'Alice',
          email: 'alice@test.com',
        });
      }
      return Promise.resolve({
        id: mockUserId,
        organizationId: mockOrgId,
        firstName: 'Owner',
        email: 'owner@test.com',
      });
    });
  });

  describe('1. Task Date Creation & Basic Range Validation', () => {
    it('1. should create a Task with valid start and due dates', async () => {
      const createdTask = {
        id: 'task-100',
        title: 'Scheduled Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        type: TaskType.TASK,
        progress: 0,
        billingType: TaskBillingType.BILLABLE,
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        projectId: mockProjectId,
        organizationId: mockOrgId,
        assigneeId: mockAssigneeId,
        reporterId: mockUserId,
      };

      mockPrisma.task.create.mockResolvedValue(createdTask);

      const res = await service.createTask(mockOrgId, mockUserId, {
        title: 'Scheduled Task',
        projectId: mockProjectId,
        startDate: '2026-06-10T00:00:00.000Z',
        dueDate: '2026-06-20T00:00:00.000Z',
        assigneeId: mockAssigneeId,
      });

      expect(res.startDate).toEqual(new Date('2026-06-10T00:00:00.000Z'));
      expect(res.dueDate).toEqual(new Date('2026-06-20T00:00:00.000Z'));
    });

    it('2. should reject when Start Date is after Due Date on creation', async () => {
      await expect(
        service.createTask(mockOrgId, mockUserId, {
          title: 'Invalid Date Task',
          projectId: mockProjectId,
          startDate: '2026-06-25T00:00:00.000Z',
          dueDate: '2026-06-10T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. should allow past dates for historical tracking in non-strict projects', async () => {
      const pastTask = {
        id: 'task-101',
        title: 'Historical Task',
        taskNumber: 11,
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        progress: 100,
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        dueDate: new Date('2025-01-10T00:00:00.000Z'),
        projectId: mockProjectId,
        organizationId: mockOrgId,
        reporterId: mockUserId,
      };

      mockPrisma.task.create.mockResolvedValue(pastTask);

      const res = await service.createTask(mockOrgId, mockUserId, {
        title: 'Historical Task',
        projectId: mockProjectId,
        startDate: '2025-01-01T00:00:00.000Z',
        dueDate: '2025-01-10T00:00:00.000Z',
      });

      expect(res.startDate).toEqual(new Date('2025-01-01T00:00:00.000Z'));
      expect(res.dueDate).toEqual(new Date('2025-01-10T00:00:00.000Z'));
    });
  });

  describe('2. Date Changes & Activity / Notifications', () => {
    it('4. should change Start Date and log START_DATE_CHANGED activity', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Scheduled Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [{ userId: mockWatcherId }],
      };

      const updated = {
        ...existingTask,
        startDate: new Date('2026-06-12T00:00:00.000Z'),
      };

      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await service.updateTask(mockOrgId, mockUserId, 'task-100', {
        startDate: '2026-06-12T00:00:00.000Z',
      });

      expect(res.startDate).toEqual(new Date('2026-06-12T00:00:00.000Z'));

      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'START_DATE_CHANGED',
            oldValue: '2026-06-10',
            newValue: '2026-06-12',
          }),
        }),
      );

      // Verify schedule notification sent to assignee and watchers
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: mockAssigneeId,
            message: expect.stringContaining('start date updated'),
          }),
        ]),
      );
    });

    it('5. should change Due Date and log DUE_DATE_CHANGED activity', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Scheduled Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [{ userId: mockWatcherId }],
      };

      const updated = {
        ...existingTask,
        dueDate: new Date('2026-06-25T00:00:00.000Z'),
      };

      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await service.updateTask(mockOrgId, mockUserId, 'task-100', {
        dueDate: '2026-06-25T00:00:00.000Z',
      });

      expect(res.dueDate).toEqual(new Date('2026-06-25T00:00:00.000Z'));

      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DUE_DATE_CHANGED',
            oldValue: '2026-06-20',
            newValue: '2026-06-25',
          }),
        }),
      );

      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: mockAssigneeId,
            message: expect.stringContaining('due date updated to 2026-06-25'),
          }),
        ]),
      );
    });
  });

  describe('3. Strict Project Bounds & Schedule Enforcement', () => {
    it('6. should reject task start date before project start date in strict project', async () => {
      const strictProject = {
        ...mockProject,
        isStrict: true,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
      };

      mockPrisma.project.findFirst.mockResolvedValue(strictProject);

      await expect(
        service.createTask(mockOrgId, mockUserId, {
          title: 'Out of bounds task',
          projectId: mockProjectId,
          startDate: '2026-05-15T00:00:00.000Z', // Before June 1
          dueDate: '2026-06-15T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. should reject task due date after milestone due date in strict project', async () => {
      const strictProject = {
        ...mockProject,
        isStrict: true,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
      };

      mockPrisma.project.findFirst.mockResolvedValue(strictProject);
      mockPrisma.milestone.findUnique.mockResolvedValue(mockMilestone); // Milestone ends 2026-07-31

      await expect(
        service.createTask(mockOrgId, mockUserId, {
          title: 'Exceeding milestone task',
          projectId: mockProjectId,
          milestoneId: mockMilestoneId,
          startDate: '2026-06-15T00:00:00.000Z',
          dueDate: '2026-08-15T00:00:00.000Z', // After July 31
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. should prohibit modifying task dates in an archived project', async () => {
      const archivedProject = { ...mockProject, status: 'ARCHIVED' };
      const taskInArchived = {
        id: 'task-100',
        projectId: mockProjectId,
        project: archivedProject,
        startDate: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
      };

      mockPrisma.task.findFirst.mockResolvedValue(taskInArchived);
      mockPrisma.task.findUnique.mockResolvedValue(taskInArchived);

      await expect(
        service.updateTask(mockOrgId, mockUserId, 'task-100', {
          dueDate: '2026-07-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
