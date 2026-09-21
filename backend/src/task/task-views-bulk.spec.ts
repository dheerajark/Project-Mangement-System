import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { RecurringTaskService } from './recurring-task.service';
import { TaskReminderService } from './task-reminder.service';
import {
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskBillingType,
} from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BulkTaskActionType } from './dto/bulk-task-action.dto';

import { CustomFieldService } from '../custom-field/custom-field.service';

describe('Task Views & Bulk Operations System (Zoho Projects Spec)', () => {
  let service: TaskService;
  let prisma: PrismaService;

  const mockOrgId = 'org-1';
  const mockUserId = 'user-owner';
  const mockProjectId = 'proj-1';
  const mockMilestoneId = 'ms-1';
  const mockTaskListId = 'tl-1';

  const mockProject = {
    id: mockProjectId,
    name: 'Mission Control',
    projectCode: 'MC',
    organizationId: mockOrgId,
    status: 'ACTIVE',
    visibility: 'ORGANIZATION',
    members: [
      { userId: mockUserId, role: 'OWNER', deletedAt: null },
      { userId: 'user-2', role: 'MEMBER', deletedAt: null },
    ],
  };

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Task 1',
      taskNumber: 1,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      type: TaskType.TASK,
      progress: 0,
      projectId: mockProjectId,
      organizationId: mockOrgId,
      assigneeId: 'user-2',
      taskListId: mockTaskListId,
      milestoneId: mockMilestoneId,
      startDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-10'),
      position: 0,
      deletedAt: null,
      project: mockProject,
      subtasks: [],
    },
    {
      id: 'task-2',
      title: 'Task 2',
      taskNumber: 2,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.LOW,
      type: TaskType.TASK,
      progress: 30,
      projectId: mockProjectId,
      organizationId: mockOrgId,
      assigneeId: 'user-2',
      taskListId: mockTaskListId,
      milestoneId: mockMilestoneId,
      startDate: new Date('2026-09-05'),
      dueDate: new Date('2026-09-15'),
      position: 1,
      deletedAt: null,
      project: mockProject,
      subtasks: [],
    },
  ];

  const mockPrisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue(mockProject),
      findUnique: jest.fn().mockResolvedValue(mockProject),
      update: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    milestone: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    taskList: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
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
    taskDependency: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return cb;
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
  };

  const mockNotificationService = {
    createNotification: jest.fn().mockResolvedValue({}),
    createNotificationsBulk: jest.fn().mockResolvedValue({}),
  };

  const mockRecurringTaskService = {
    processRecurringTaskOnComplete: jest.fn().mockResolvedValue(null),
  };

  const mockTaskReminderService = {
    rescheduleTaskReminders: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: RecurringTaskService, useValue: mockRecurringTaskService },
        { provide: TaskReminderService, useValue: mockTaskReminderService },
        {
          provide: CustomFieldService,
          useValue: {
            validateAndSanitizeTaskCustomFields: jest.fn().mockImplementation((_, __, val) => Promise.resolve(val)),
            getCustomFieldDefinitions: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('bulkTaskAction', () => {
    it('should throw BadRequestException if taskIds array is empty', async () => {
      await expect(
        service.bulkTaskAction(mockOrgId, mockUserId, ['EDIT_TASK'], {
          taskIds: [],
          action: BulkTaskActionType.UPDATE_STATUS,
          status: TaskStatus.DONE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user lacks DELETE_TASK when action is DELETE', async () => {
      await expect(
        service.bulkTaskAction(mockOrgId, mockUserId, ['VIEW_TASK'], {
          taskIds: ['task-1'],
          action: BulkTaskActionType.DELETE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully bulk update task status and adjust progress to 100% when status is DONE', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['EDIT_TASK'],
        {
          taskIds: ['task-1', 'task-2'],
          action: BulkTaskActionType.UPDATE_STATUS,
          status: TaskStatus.DONE,
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: TaskStatus.DONE,
            progress: 100,
          }),
        }),
      );
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-2' },
          data: expect.objectContaining({
            status: TaskStatus.DONE,
            progress: 100,
          }),
        }),
      );
      expect(mockPrisma.taskActivity.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
    });

    it('should successfully bulk update task priority', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['EDIT_TASK'],
        {
          taskIds: ['task-1', 'task-2'],
          action: BulkTaskActionType.UPDATE_PRIORITY,
          priority: TaskPriority.CRITICAL,
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { priority: TaskPriority.CRITICAL },
        }),
      );
    });

    it('should successfully bulk assign tasks to a user', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['EDIT_TASK'],
        {
          taskIds: ['task-1', 'task-2'],
          action: BulkTaskActionType.UPDATE_ASSIGNEE,
          assigneeId: 'user-new-lead',
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { assigneeId: 'user-new-lead' },
        }),
      );
    });

    it('should successfully bulk move tasks to another task list', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['EDIT_TASK'],
        {
          taskIds: ['task-1', 'task-2'],
          action: BulkTaskActionType.MOVE_TASK_LIST,
          taskListId: 'tl-phase-2',
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { taskListId: 'tl-phase-2' },
        }),
      );
    });

    it('should successfully bulk shift dates by +5 days', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce([mockTasks[0]]);
      mockPrisma.task.update.mockResolvedValue({});

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['EDIT_TASK'],
        {
          taskIds: ['task-1'],
          action: BulkTaskActionType.UPDATE_DATES,
          shiftDays: 5,
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            startDate: new Date('2026-09-06'),
            dueDate: new Date('2026-09-15'),
          }),
        }),
      );
    });

    it('should successfully bulk delete tasks and their subtasks', async () => {
      mockPrisma.task.findMany.mockResolvedValueOnce(mockTasks);
      mockPrisma.task.update.mockResolvedValue({});
      mockPrisma.task.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkTaskAction(
        mockOrgId,
        mockUserId,
        ['DELETE_TASK'],
        {
          taskIds: ['task-1', 'task-2'],
          action: BulkTaskActionType.DELETE,
        },
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockPrisma.task.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.task.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('reorderTask with multi-grouping support', () => {
    it('should update taskListId when reordering in Task List Kanban grouping', async () => {
      mockPrisma.task.findFirst.mockResolvedValueOnce(mockTasks[0]);
      mockPrisma.task.findMany.mockResolvedValueOnce([]); // other column tasks
      mockPrisma.task.update.mockResolvedValue({});

      await service.reorderTask(mockOrgId, mockUserId, 'task-1', {
        position: 0,
        taskListId: 'tl-new-target',
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            position: 0,
            taskListId: 'tl-new-target',
          }),
        }),
      );
    });

    it('should update priority when reordering in Priority Kanban grouping', async () => {
      mockPrisma.task.findFirst.mockResolvedValueOnce(mockTasks[0]);
      mockPrisma.task.findMany.mockResolvedValueOnce([]);
      mockPrisma.task.update.mockResolvedValue({});

      await service.reorderTask(mockOrgId, mockUserId, 'task-1', {
        position: 0,
        priority: TaskPriority.CRITICAL,
      });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            position: 0,
            priority: TaskPriority.CRITICAL,
          }),
        }),
      );
    });
  });
});
