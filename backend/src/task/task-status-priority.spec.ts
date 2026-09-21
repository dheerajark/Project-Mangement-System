import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { TaskStatus, TaskPriority, TaskType, TaskBillingType, NotificationType } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Task Status and Priority System (Zoho Projects Spec)', () => {
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
    title: 'Alpha Release',
    status: 'PLANNED',
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
        return Promise.resolve({ id: mockAssigneeId, organizationId: mockOrgId, firstName: 'Alice', email: 'alice@test.com' });
      }
      return Promise.resolve({ id: mockUserId, organizationId: mockOrgId, firstName: 'Owner', email: 'owner@test.com' });
    });
  });

  describe('1. Task Creation & Defaults', () => {
    it('should create a task with default status (TODO) and default priority (MEDIUM)', async () => {
      const createdTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        type: TaskType.TASK,
        progress: 0,
        billingType: TaskBillingType.BILLABLE,
        projectId: mockProjectId,
        organizationId: mockOrgId,
        assigneeId: mockAssigneeId,
        reporterId: mockUserId,
        milestoneId: null,
      };

      mockPrisma.task.findFirst.mockResolvedValue(null);
      mockPrisma.task.create.mockResolvedValue(createdTask);

      const res = await service.createTask(mockOrgId, mockUserId, {
        title: 'Initial Setup Task',
        projectId: mockProjectId,
        assigneeId: mockAssigneeId,
      });

      expect(res.status).toBe(TaskStatus.TODO);
      expect(res.priority).toBe(TaskPriority.MEDIUM);
      expect(res.progress).toBe(0);

      // Verify activity & audit logging
      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: createdTask.id,
            action: 'TASK_CREATED',
          }),
        }),
      );

      // Verify assignment notification sent to assignee
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.TASK_ASSIGNMENT,
          userId: mockAssigneeId,
        }),
      );
    });
  });

  describe('2. Status Transitions & Zoho Flexible Workflow', () => {
    it('should allow status change to IN_PROGRESS and log activity', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [{ userId: mockWatcherId }],
      };

      const updated = { ...existingTask, status: TaskStatus.IN_PROGRESS };
      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(res.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STATUS_CHANGED',
            oldValue: TaskStatus.TODO,
            newValue: TaskStatus.IN_PROGRESS,
          }),
        }),
      );

      // Verify watchers and assignee received update notification
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: mockAssigneeId,
            message: expect.stringContaining('status changed from TODO to IN_PROGRESS'),
          }),
          expect.objectContaining({
            userId: mockWatcherId,
          }),
        ]),
      );
    });

    it('should allow direct completion from TODO or IN_PROGRESS to DONE and automatically set progress to 100%', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      const updated = { ...existingTask, status: TaskStatus.DONE, progress: 100 };
      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
        status: TaskStatus.DONE,
      });

      expect(res.status).toBe(TaskStatus.DONE);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.DONE,
            progress: 100,
          }),
        }),
      );
    });

    it('should allow reopening a completed task (DONE -> IN_PROGRESS) and adjust progress', async () => {
      const completedTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        progress: 100,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      const reopenedTask = { ...completedTask, status: TaskStatus.IN_PROGRESS, progress: 50 };
      mockPrisma.task.findFirst.mockResolvedValue(completedTask);
      mockPrisma.task.findUnique.mockResolvedValue(completedTask);
      mockPrisma.task.update.mockResolvedValue(reopenedTask);

      const res = await service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(res.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.IN_PROGRESS,
            progress: 50,
          }),
        }),
      );
    });

    it('should allow reopening a completed task back to TODO and reset progress to 0%', async () => {
      const completedTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        progress: 100,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      const resetTask = { ...completedTask, status: TaskStatus.TODO, progress: 0 };
      mockPrisma.task.findFirst.mockResolvedValue(completedTask);
      mockPrisma.task.findUnique.mockResolvedValue(completedTask);
      mockPrisma.task.update.mockResolvedValue(resetTask);

      const res = await service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
        status: TaskStatus.TODO,
      });

      expect(res.status).toBe(TaskStatus.TODO);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.TODO,
            progress: 0,
          }),
        }),
      );
    });
  });

  describe('3. Priority Updates & Independence from Status', () => {
    it('should change priority without changing status, and log PRIORITY_CHANGED', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        progress: 40,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [{ userId: mockWatcherId }],
      };

      const updated = { ...existingTask, priority: TaskPriority.CRITICAL };
      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await service.updateTask(mockOrgId, mockUserId, 'task-100', {
        priority: TaskPriority.CRITICAL,
      });

      expect(res.priority).toBe(TaskPriority.CRITICAL);
      expect(res.status).toBe(TaskStatus.IN_PROGRESS); // Status remains untouched

      expect(mockPrisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PRIORITY_CHANGED',
            oldValue: TaskPriority.MEDIUM,
            newValue: TaskPriority.CRITICAL,
          }),
        }),
      );

      // Verify notification on priority escalation
      expect(mockNotificationService.createNotificationsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('priority changed to CRITICAL'),
          }),
        ]),
      );
    });
  });

  describe('4. Progress-driven Status Automation', () => {
    it('should automatically set status to DONE when progress is updated to 100%', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        progress: 60,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      const updated = { ...existingTask, status: TaskStatus.DONE, progress: 100 };
      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      await service.updateTask(mockOrgId, mockUserId, 'task-100', {
        progress: 100,
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.DONE,
            progress: 100,
          }),
        }),
      );
    });

    it('should automatically move status from TODO to IN_PROGRESS when partial progress is entered', async () => {
      const existingTask = {
        id: 'task-100',
        title: 'Initial Setup Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        projectId: mockProjectId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      const updated = { ...existingTask, status: TaskStatus.IN_PROGRESS, progress: 25 };
      mockPrisma.task.findFirst.mockResolvedValue(existingTask);
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue(updated);

      await service.updateTask(mockOrgId, mockUserId, 'task-100', {
        progress: 25,
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.IN_PROGRESS,
            progress: 25,
          }),
        }),
      );
    });
  });

  describe('5. Milestone Automation & Permissions', () => {
    it('should auto-transition a linked milestone from PLANNED to IN_PROGRESS when a task starts', async () => {
      const taskInMilestone = {
        id: 'task-100',
        title: 'Milestone Task',
        taskNumber: 10,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        progress: 0,
        projectId: mockProjectId,
        milestoneId: mockMilestoneId,
        project: mockProject,
        assigneeId: mockAssigneeId,
        watchers: [],
      };

      mockPrisma.task.findFirst.mockResolvedValue(taskInMilestone);
      mockPrisma.task.findUnique.mockResolvedValue(taskInMilestone);
      mockPrisma.milestone.findUnique.mockResolvedValue(mockMilestone);
      mockPrisma.milestone.update.mockResolvedValue({ ...mockMilestone, status: 'IN_PROGRESS' });
      mockPrisma.task.update.mockResolvedValue({ ...taskInMilestone, status: TaskStatus.IN_PROGRESS });

      await service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(mockPrisma.milestone.update).toHaveBeenCalledWith({
        where: { id: mockMilestoneId },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('should prohibit modifying task in an archived project', async () => {
      const archivedProject = { ...mockProject, status: 'ARCHIVED' };
      const taskInArchived = {
        id: 'task-100',
        projectId: mockProjectId,
        project: archivedProject,
        status: TaskStatus.TODO,
      };

      mockPrisma.task.findFirst.mockResolvedValue(taskInArchived);
      mockPrisma.task.findUnique.mockResolvedValue(taskInArchived);

      await expect(
        service.updateTaskStatus(mockOrgId, mockUserId, 'task-100', {
          status: TaskStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
