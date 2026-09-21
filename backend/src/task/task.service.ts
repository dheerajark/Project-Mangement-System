import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  CreateAttachmentMetadataDto,
  BulkCreateAttachmentMetadataDto,
  UpdateAttachmentMetadataDto,
  LinkDocumentToTaskDto,
} from './dto/create-attachment-metadata.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import {
  BulkTaskActionDto,
  BulkTaskActionType,
} from './dto/bulk-task-action.dto';
import {
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskBillingType,
  NotificationType,
  DependencyType,
  DependencyLinkType,
} from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { isClientUser } from '../common/utils/client-detection.util';
import {
  CreateTaskDependencyDto,
  UpdateTaskDependencyDto,
} from './dto/task-dependency.dto';
import { RecurringTaskService } from './recurring-task.service';
import { TaskReminderService } from './task-reminder.service';
import { CustomFieldService } from '../custom-field/custom-field.service';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private recurringTaskService: RecurringTaskService,
    private taskReminderService: TaskReminderService,
    private customFieldService: CustomFieldService,
  ) {}

  async getAllTasks(
    organizationId: string,
    userId: string,
    userPermissions: string[],
    filters: {
      projectId?: string;
      assigneeId?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      type?: TaskType;
      search?: string;
    },
  ) {
    const canViewAll = userPermissions.includes('VIEW_ALL_TASKS');

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

    const conditions: any[] = [];
    if (!canViewAll) {
      conditions.push({
        OR: [{ assigneeId: userId }, { reporterId: userId }],
      });
    }

    if (filters.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
          { customFields: { contains: filters.search } },
        ],
      });
    }

    const isClient = await isClientUser(this.prisma, userId, filters.projectId);
    if (isClient) {
      conditions.push({
        OR: [
          { taskList: { flag: 'EXTERNAL' } },
          { taskListId: null, milestone: { flag: 'EXTERNAL' } },
        ],
      });
    }

    if (conditions.length > 0) {
      whereClause.AND = conditions;
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
        recurringTask: true,
        labels: {
          include: { label: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async bulkTaskAction(
    organizationId: string,
    userId: string,
    userPermissions: string[],
    dto: BulkTaskActionDto,
  ) {
    if (!dto.taskIds || dto.taskIds.length === 0) {
      throw new BadRequestException('At least one task must be selected');
    }

    if (dto.action === BulkTaskActionType.DELETE) {
      const canDelete =
        userPermissions.includes('DELETE_TASK') ||
        userPermissions.includes('EDIT_TASK');
      if (!canDelete) {
        throw new ForbiddenException(
          'You do not have permission to delete tasks',
        );
      }
    }

    // Fetch accessible tasks
    const tasks = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        organizationId,
        deletedAt: null,
      },
      include: {
        project: {
          include: {
            members: { where: { deletedAt: null } },
          },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subtasks: { where: { deletedAt: null } },
        milestone: true,
        taskList: true,
      },
    });

    if (tasks.length === 0) {
      throw new NotFoundException(
        'No matching tasks found to perform bulk action',
      );
    }

    // Filter by project access
    const accessibleTasks = tasks.filter((t) => {
      if (t.project.status === 'ARCHIVED') return false;
      if (t.project.visibility === 'PRIVATE') {
        const isMember = t.project.members.some((m) => m.userId === userId);
        return isMember;
      }
      return true;
    });

    if (accessibleTasks.length === 0) {
      throw new ForbiddenException(
        'You do not have access to modify the selected tasks',
      );
    }

    const updatedTaskIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const task of accessibleTasks) {
        if (dto.action === BulkTaskActionType.UPDATE_STATUS && dto.status) {
          const oldStatus = task.status;
          const newStatus = dto.status;
          let newProgress = task.progress;
          if (dto.progress !== undefined) {
            newProgress = dto.progress;
          } else if (newStatus === TaskStatus.DONE) {
            newProgress = 100;
          } else if (
            newStatus === TaskStatus.TODO &&
            oldStatus === TaskStatus.DONE
          ) {
            newProgress = 0;
          }

          await tx.task.update({
            where: { id: task.id },
            data: { status: newStatus, progress: newProgress },
          });

          if (task.milestoneId) {
            await this.autoTransitionMilestone(
              tx,
              task.milestoneId,
              newStatus,
              userId,
              organizationId,
            );
          }

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'STATUS_CHANGED',
              oldValue: oldStatus,
              newValue: newStatus,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_STATUS_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: oldStatus,
              newValue: newStatus,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (
          dto.action === BulkTaskActionType.UPDATE_PRIORITY &&
          dto.priority
        ) {
          const oldPriority = task.priority;
          const newPriority = dto.priority;

          await tx.task.update({
            where: { id: task.id },
            data: { priority: newPriority },
          });

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'PRIORITY_CHANGED',
              oldValue: oldPriority,
              newValue: newPriority,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_PRIORITY_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: oldPriority,
              newValue: newPriority,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.UPDATE_ASSIGNEE) {
          const oldAssigneeId = task.assigneeId;
          const newAssigneeId = dto.assigneeId || null;

          await tx.task.update({
            where: { id: task.id },
            data: { assigneeId: newAssigneeId },
          });

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'ASSIGNEE_CHANGED',
              oldValue: oldAssigneeId,
              newValue: newAssigneeId,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_ASSIGNEE_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: oldAssigneeId ?? undefined,
              newValue: newAssigneeId ?? undefined,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.MOVE_TASK_LIST) {
          const oldTaskListId = task.taskListId;
          const newTaskListId = dto.taskListId || null;

          await tx.task.update({
            where: { id: task.id },
            data: { taskListId: newTaskListId },
          });

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'TASK_LIST_CHANGED',
              oldValue: oldTaskListId,
              newValue: newTaskListId,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_LIST_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: oldTaskListId ?? undefined,
              newValue: newTaskListId ?? undefined,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.MOVE_MILESTONE) {
          const oldMilestoneId = task.milestoneId;
          const newMilestoneId = dto.milestoneId || null;

          await tx.task.update({
            where: { id: task.id },
            data: { milestoneId: newMilestoneId },
          });

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'MILESTONE_CHANGED',
              oldValue: oldMilestoneId,
              newValue: newMilestoneId,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_MILESTONE_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: oldMilestoneId ?? undefined,
              newValue: newMilestoneId ?? undefined,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.UPDATE_DATES) {
          let newStart = task.startDate;
          let newDue = task.dueDate;

          if (dto.shiftDays !== undefined && dto.shiftDays !== 0) {
            if (newStart) {
              const d = new Date(newStart);
              d.setDate(d.getDate() + dto.shiftDays);
              newStart = d;
            }
            if (newDue) {
              const d = new Date(newDue);
              d.setDate(d.getDate() + dto.shiftDays);
              newDue = d;
            }
          } else {
            if (dto.startDate !== undefined) {
              newStart = dto.startDate ? new Date(dto.startDate) : null;
            }
            if (dto.dueDate !== undefined) {
              newDue = dto.dueDate ? new Date(dto.dueDate) : null;
            }
          }

          if (newStart && newDue && newDue < newStart) {
            newDue = newStart;
          }

          await tx.task.update({
            where: { id: task.id },
            data: { startDate: newStart, dueDate: newDue },
          });

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'DATES_CHANGED',
              oldValue: JSON.stringify({
                start: task.startDate,
                due: task.dueDate,
              }),
              newValue: JSON.stringify({ start: newStart, due: newDue }),
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_DATES_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: JSON.stringify({
                start: task.startDate,
                due: task.dueDate,
              }),
              newValue: JSON.stringify({ start: newStart, due: newDue }),
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.MARK_COMPLETED) {
          await tx.task.update({
            where: { id: task.id },
            data: { status: TaskStatus.DONE, progress: 100 },
          });

          if (task.milestoneId) {
            await this.autoTransitionMilestone(
              tx,
              task.milestoneId,
              TaskStatus.DONE,
              userId,
              organizationId,
            );
          }

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'STATUS_CHANGED',
              oldValue: task.status,
              newValue: TaskStatus.DONE,
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_STATUS_CHANGED',
              projectId: task.projectId,
              taskId: task.id,
              oldValue: task.status,
              newValue: TaskStatus.DONE,
            },
          });
          updatedTaskIds.push(task.id);
        } else if (dto.action === BulkTaskActionType.DELETE) {
          const now = new Date();
          // Delete subtasks as well
          await tx.task.updateMany({
            where: { parentTaskId: task.id, deletedAt: null },
            data: { deletedAt: now },
          });

          await tx.task.update({
            where: { id: task.id },
            data: { deletedAt: now },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              userId,
              entityType: 'Task',
              entityId: task.id,
              action: 'TASK_DELETED',
              projectId: task.projectId,
              taskId: task.id,
            },
          });
          updatedTaskIds.push(task.id);
        }
      }
    });

    return {
      success: true,
      action: dto.action,
      count: updatedTaskIds.length,
      updatedTaskIds,
    };
  }

  async autoTransitionMilestone(
    tx: any,
    milestoneId: string,
    taskStatus: TaskStatus,
    userId: string,
    organizationId: string,
  ) {
    if (taskStatus !== TaskStatus.DONE) {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
      });
      if (milestone && milestone.status === 'PLANNED' && !milestone.deletedAt) {
        const updatedMilestone = await tx.milestone.update({
          where: { id: milestoneId },
          data: { status: 'IN_PROGRESS' },
        });

        // Log ProjectActivity
        await tx.projectActivity.create({
          data: {
            projectId: milestone.projectId,
            userId,
            organizationId,
            milestoneId,
            action: 'MILESTONE_UPDATED',
            oldValue: JSON.stringify(milestone),
            newValue: JSON.stringify(updatedMilestone),
          },
        });

        // Log general AuditLog
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            entityType: 'Milestone',
            entityId: milestoneId,
            action: 'MILESTONE_UPDATED',
            oldValue: JSON.stringify(milestone),
            newValue: JSON.stringify(updatedMilestone),
          },
        });
      }
    }
  }

  private async validateSubtaskHierarchy(
    organizationId: string,
    projectId: string,
    taskId: string | null,
    targetParentId: string | null,
  ): Promise<void> {
    if (!targetParentId) return;

    if (taskId && targetParentId === taskId) {
      throw new BadRequestException('A task cannot be its own parent');
    }

    const targetParent = await this.prisma.task.findFirst({
      where: { id: targetParentId, organizationId, projectId, deletedAt: null },
    });

    if (!targetParent) {
      throw new NotFoundException('Parent task not found in this project');
    }

    // Traverse upstream to check for cycles and depth
    let currentParentId: string | null = targetParent.parentTaskId;
    let upstreamDepth = 1;

    while (currentParentId) {
      if (taskId && currentParentId === taskId) {
        throw new BadRequestException(
          'Circular task hierarchy detected: a task cannot be a subtask of its own descendant',
        );
      }
      upstreamDepth++;
      if (upstreamDepth > 6) {
        throw new BadRequestException(
          'Maximum subtask hierarchy depth of 6 levels exceeded',
        );
      }
      const ancestor = await this.prisma.task.findUnique({
        where: { id: currentParentId },
        select: { parentTaskId: true },
      });
      currentParentId = ancestor?.parentTaskId || null;
    }

    if (taskId) {
      const downstreamDepth = await this.getTaskMaxSubtreeDepth(taskId);
      if (upstreamDepth + downstreamDepth > 6) {
        throw new BadRequestException(
          `Maximum subtask hierarchy depth of 6 levels exceeded (upstream depth: ${upstreamDepth}, downstream depth: ${downstreamDepth})`,
        );
      }
    }
  }

  private async getTaskMaxSubtreeDepth(taskId: string): Promise<number> {
    const directChildren = await this.prisma.task.findMany({
      where: { parentTaskId: taskId, deletedAt: null },
      select: { id: true },
    });

    if (directChildren.length === 0) return 0;

    let maxChildDepth = 0;
    for (const child of directChildren) {
      const depth = await this.getTaskMaxSubtreeDepth(child.id);
      if (depth > maxChildDepth) {
        maxChildDepth = depth;
      }
    }
    return 1 + maxChildDepth;
  }

  private async getAllDescendantTaskIds(taskId: string): Promise<string[]> {
    const directChildren = await this.prisma.task.findMany({
      where: { parentTaskId: taskId, deletedAt: null },
      select: { id: true },
    });

    let allIds: string[] = [];
    for (const child of directChildren) {
      allIds.push(child.id);
      const subIds = await this.getAllDescendantTaskIds(child.id);
      allIds = allIds.concat(subIds);
    }
    return allIds;
  }

  private async cascadeParentHierarchyUpdates(
    tx: any,
    parentTaskId: string,
    taskListId: string | null | undefined,
    milestoneId: string | null | undefined,
  ) {
    const directChildren = await tx.task.findMany({
      where: { parentTaskId, deletedAt: null },
      select: { id: true },
    });

    if (directChildren.length === 0) return;

    const data: any = {};
    if (taskListId !== undefined) data.taskListId = taskListId;
    if (milestoneId !== undefined) data.milestoneId = milestoneId;

    if (Object.keys(data).length > 0) {
      await tx.task.updateMany({
        where: { parentTaskId, deletedAt: null },
        data,
      });

      for (const child of directChildren) {
        await this.cascadeParentHierarchyUpdates(
          tx,
          child.id,
          taskListId,
          milestoneId,
        );
      }
    }
  }

  async createTask(organizationId: string, userId: string, dto: CreateTaskDto) {
    if (!dto.projectId) {
      throw new BadRequestException('Project ID is required');
    }
    const projectId: string = dto.projectId;

    // 1. Verify project exists, belongs to tenant, and is active
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot add tasks to an archived project');
    }

    // 2. Subtask hierarchy validation
    if (dto.parentTaskId) {
      await this.validateSubtaskHierarchy(
        organizationId,
        projectId,
        null,
        dto.parentTaskId,
      );
    }

    // 2. Project membership and cross-tenant validation for assignee
    if (dto.assigneeId) {
      const assigneeUser = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });

      if (!assigneeUser || assigneeUser.organizationId !== organizationId) {
        throw new ForbiddenException(
          'Assignee must belong to the same organization',
        );
      }

      const isProjectMember = project.members.some(
        (m) => m.userId === dto.assigneeId,
      );
      if (!isProjectMember) {
        throw new ForbiddenException('Assignee must be a project member');
      }
    }

    // Verify milestone exists in this project and is active
    if (dto.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: {
          id: dto.milestoneId,
          projectId: dto.projectId,
          deletedAt: null,
        },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone not found in this project');
      }
    }

    let effectiveMilestoneId = dto.milestoneId;
    let effectiveTaskListId = dto.taskListId;

    if (dto.parentTaskId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: dto.parentTaskId },
      });
      if (parentTask) {
        if (!effectiveMilestoneId && parentTask.milestoneId) {
          effectiveMilestoneId = parentTask.milestoneId;
        }
        if (!effectiveTaskListId && parentTask.taskListId) {
          effectiveTaskListId = parentTask.taskListId;
        }
      }
    }

    if (effectiveTaskListId && !effectiveMilestoneId) {
      const parentTaskList = await this.prisma.taskList.findUnique({
        where: { id: effectiveTaskListId },
        select: { milestoneId: true },
      });
      if (parentTaskList?.milestoneId) {
        effectiveMilestoneId = parentTaskList.milestoneId;
      }
    }

    // In Zoho Projects, Client users cannot be assigned to internal tasks or task lists
    if (dto.assigneeId) {
      const isAssigneeClient = await isClientUser(
        this.prisma,
        dto.assigneeId,
        dto.projectId,
      );
      if (isAssigneeClient) {
        let isTargetInternal = true;
        if (effectiveTaskListId) {
          const tList = await this.prisma.taskList.findUnique({
            where: { id: effectiveTaskListId },
            select: { flag: true },
          });
          if (tList?.flag === 'EXTERNAL') isTargetInternal = false;
        } else if (effectiveMilestoneId) {
          const ms = await this.prisma.milestone.findUnique({
            where: { id: effectiveMilestoneId },
            select: { flag: true },
          });
          if (ms?.flag === 'EXTERNAL') isTargetInternal = false;
        }
        if (isTargetInternal) {
          throw new BadRequestException(
            'Client users cannot be assigned to internal tasks or task lists',
          );
        }
      }
    }

    // Validate date ranges (Zoho Projects requirement)
    if (dto.startDate && dto.dueDate) {
      const start = new Date(dto.startDate);
      const due = new Date(dto.dueDate);
      if (start > due) {
        throw new BadRequestException('Start date cannot be after due date');
      }
    }

    // Strict project date bounds validation
    if (project.isStrict) {
      if (dto.startDate && project.startDate && new Date(dto.startDate) < new Date(project.startDate)) {
        throw new BadRequestException(
          'Task start date cannot be before project start date in a strict project',
        );
      }
      if (dto.dueDate && project.endDate && new Date(dto.dueDate) > new Date(project.endDate)) {
        throw new BadRequestException(
          'Task due date cannot be after project end date in a strict project',
        );
      }
      if (effectiveMilestoneId) {
        const ms = await this.prisma.milestone.findUnique({
          where: { id: effectiveMilestoneId },
        });
        if (ms) {
          if (dto.startDate && ms.startDate && new Date(dto.startDate) < new Date(ms.startDate)) {
            throw new BadRequestException(
              'Task start date cannot be before milestone start date in a strict project',
            );
          }
          if (dto.dueDate && ms.dueDate && new Date(dto.dueDate) > new Date(ms.dueDate)) {
            throw new BadRequestException(
              'Task due date cannot be after milestone due date in a strict project',
            );
          }
        }
      }
    }

    // Validate and sanitize custom fields according to Zoho Projects active schema
    const sanitizedCustomFields = await this.customFieldService.validateAndSanitizeTaskCustomFields(
      organizationId,
      projectId,
      dto.customFields,
      true,
    );

    // 3. Sequential generation and creation inside single transaction
    const task = await this.prisma.$transaction(async (tx) => {
      const proj = await tx.project.findUnique({
        where: { id: projectId },
      });

      if (!proj) {
        throw new NotFoundException('Project not found');
      }

      const highestTask = await tx.task.findFirst({
        where: { projectId },
        orderBy: { taskNumber: 'desc' },
        select: { taskNumber: true },
      });
      const currentMax = highestTask ? highestTask.taskNumber : 0;
      const taskNumber = Math.max(proj.nextTaskNumber || 1, currentMax + 1);

      // Increment project sequence counter
      await tx.project.update({
        where: { id: projectId },
        data: { nextTaskNumber: taskNumber + 1 },
      });

      // Create Task
      const task = await tx.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          taskNumber,
          status: dto.status || TaskStatus.TODO,
          priority: dto.priority || TaskPriority.MEDIUM,
          type: dto.type || TaskType.TASK,
          progress: dto.progress ?? (dto.status === TaskStatus.DONE ? 100 : 0),
          billingType: dto.billingType || TaskBillingType.BILLABLE,
          estimatedHours: dto.estimatedHours,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          position: 0,
          tags: dto.tags || null,
          customFields: sanitizedCustomFields,
          projectId,
          organizationId,
          assigneeId: dto.assigneeId,
          reporterId: userId,
          milestoneId: effectiveMilestoneId,
          taskListId: effectiveTaskListId,
          parentTaskId: dto.parentTaskId || null,
        },
      });

      // Log TaskActivity
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId,
          action: 'TASK_CREATED',
          newValue: JSON.stringify(task),
        },
      });

      // Log Milestone Link if applicable
      if (dto.milestoneId) {
        const ms = await tx.milestone.findUnique({
          where: { id: dto.milestoneId },
        });
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId,
            action: 'TASK_LINKED_TO_MILESTONE',
            newValue: JSON.stringify({
              milestoneId: dto.milestoneId,
              title: ms?.title,
            }),
          },
        });

        // Trigger auto transition
        await this.autoTransitionMilestone(
          tx,
          dto.milestoneId,
          task.status,
          userId,
          organizationId,
        );
      }

      // Log detailed Audit Entry
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Task',
          entityId: task.id,
          action: 'TASK_CREATED',
          projectId,
          taskId: task.id,
          newValue: JSON.stringify(task),
        },
      });

      return task;
    });

    if (task.assigneeId && task.assigneeId !== userId) {
      await this.notificationService.createNotification({
        type: NotificationType.TASK_ASSIGNMENT,
        title: 'New Task Assigned',
        message: `You have been assigned task [${project.projectCode}-${task.taskNumber}]: ${task.title}`,
        userId: task.assigneeId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: project.projectCode,
          taskNumber: task.taskNumber,
        },
      });
    }

    // If recurrence was requested on creation, configure recurrence series
    if (dto.recurrence) {
      try {
        await this.recurringTaskService.configureRecurrence(
          organizationId,
          userId,
          task.id,
          dto.recurrence,
        );
      } catch (recurrenceErr) {
        // Log recurrence creation warning without failing initial task creation
      }
    }

    return task;
  }

  async getTasksForProject(
    organizationId: string,
    userId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Enforce private project visibility checks
    if (project.visibility === 'PRIVATE') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const isClient = await isClientUser(this.prisma, userId, projectId);

    const whereClause: any = {
      projectId,
      deletedAt: null,
    };

    if (isClient) {
      whereClause.OR = [
        { taskList: { flag: 'EXTERNAL' } },
        { taskListId: null, milestone: { flag: 'EXTERNAL' } },
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
        labels: {
          include: { label: true },
        },
        milestone: true,
        taskList: true,
        recurringTask: true,
        parentTask: {
          select: { id: true, title: true, taskNumber: true },
        },
        subtasks: {
          where: { deletedAt: null },
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { subtasks: { where: { deletedAt: null } } },
        },
        predecessorDependencies: {
          include: {
            predecessor: {
              select: {
                id: true,
                taskNumber: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { taskNumber: 'asc' },
    });
  }

  async getTaskById(organizationId: string, userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: {
        project: {
          include: {
            members: {
              where: { deletedAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            settings: true,
          },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        comments: {
          where: { deletedAt: null },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          where: { deletedAt: null },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            folder: { select: { id: true, name: true } },
            versions: {
              include: {
                uploadedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        watchers: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        labels: {
          include: { label: true },
        },
        milestone: true,
        taskList: true,
        parentTask: {
          select: { id: true, title: true, taskNumber: true, status: true },
        },
        subtasks: {
          where: { deletedAt: null },
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            subtasks: {
              where: { deletedAt: null },
              select: { id: true, status: true },
            },
            _count: {
              select: { subtasks: { where: { deletedAt: null } } },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { subtasks: { where: { deletedAt: null } } },
        },
        predecessorDependencies: {
          include: {
            predecessor: {
              select: {
                id: true,
                taskNumber: true,
                title: true,
                status: true,
                priority: true,
                type: true,
                progress: true,
                startDate: true,
                dueDate: true,
                assignee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        successorDependencies: {
          include: {
            successor: {
              select: {
                id: true,
                taskNumber: true,
                title: true,
                status: true,
                priority: true,
                type: true,
                progress: true,
                startDate: true,
                dueDate: true,
                assignee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        recurringTask: {
          include: {
            tasks: {
              where: { deletedAt: null },
              select: {
                id: true,
                taskNumber: true,
                title: true,
                status: true,
                recurrenceIndex: true,
                startDate: true,
                dueDate: true,
                createdAt: true,
              },
              orderBy: { recurrenceIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.visibility === 'PRIVATE') {
      const isMember = task.project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const isClient = await isClientUser(this.prisma, userId, task.projectId);
    if (isClient) {
      const isExternal =
        task.taskList?.flag === 'EXTERNAL' ||
        (!task.taskList && task.milestone?.flag === 'EXTERNAL');
      if (!isExternal) {
        throw new ForbiddenException('Access denied: Internal task');
      }
    }

    return task;
  }

  async updateTask(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (dto.assigneeId) {
        const assigneeUser = await this.prisma.user.findUnique({
          where: { id: dto.assigneeId },
        });

        if (!assigneeUser || assigneeUser.organizationId !== organizationId) {
          throw new ForbiddenException(
            'Assignee must belong to the same organization',
          );
        }

        const isProjectMember = task.project.members.some(
          (m) => m.userId === dto.assigneeId,
        );
        if (!isProjectMember) {
          throw new ForbiddenException('Assignee must be a project member');
        }
      }
    }

    if (dto.parentTaskId !== undefined && dto.parentTaskId !== task.parentTaskId) {
      if (dto.parentTaskId) {
        await this.validateSubtaskHierarchy(
          organizationId,
          task.projectId,
          taskId,
          dto.parentTaskId,
        );
      }
    }
    // If taskListId is changed and milestoneId is not explicitly provided,
    // sync milestoneId from target task list to keep consistency with Zoho hierarchy
    if (
      dto.taskListId !== undefined &&
      dto.taskListId !== task.taskListId &&
      dto.milestoneId === undefined
    ) {
      if (dto.taskListId) {
        const targetList = await this.prisma.taskList.findUnique({
          where: { id: dto.taskListId },
          select: { milestoneId: true },
        });
        if (targetList) {
          dto.milestoneId = targetList.milestoneId ?? null;
        }
      }
    }

    // Enforce client assignee restriction on internal tasks/lists
    const targetAssigneeId =
      dto.assigneeId !== undefined ? dto.assigneeId : task.assigneeId;
    const targetTaskListId =
      dto.taskListId !== undefined ? dto.taskListId : task.taskListId;
    const targetMilestoneId =
      dto.milestoneId !== undefined ? dto.milestoneId : task.milestoneId;

    if (targetAssigneeId) {
      const isAssigneeClient = await isClientUser(
        this.prisma,
        targetAssigneeId,
        task.projectId,
      );
      if (isAssigneeClient) {
        let isTargetInternal = true;
        if (targetTaskListId) {
          const tList = await this.prisma.taskList.findUnique({
            where: { id: targetTaskListId },
            select: { flag: true },
          });
          if (tList?.flag === 'EXTERNAL') isTargetInternal = false;
        } else if (targetMilestoneId) {
          const ms = await this.prisma.milestone.findUnique({
            where: { id: targetMilestoneId },
            select: { flag: true },
          });
          if (ms?.flag === 'EXTERNAL') isTargetInternal = false;
        }
        if (isTargetInternal) {
          throw new BadRequestException(
            'Client users cannot be assigned to internal tasks or task lists',
          );
        }
      }
    }

    if (dto.milestoneId !== undefined && dto.milestoneId !== task.milestoneId) {
      if (dto.milestoneId) {
        const milestone = await this.prisma.milestone.findFirst({
          where: {
            id: dto.milestoneId,
            projectId: task.projectId,
            deletedAt: null,
          },
        });
        if (!milestone) {
          throw new NotFoundException('Milestone not found in this project');
        }
      }
    }

    // Validate effective date ranges
    const effectiveStartDate =
      dto.startDate !== undefined
        ? dto.startDate
          ? new Date(dto.startDate)
          : null
        : task.startDate;
    const effectiveDueDate =
      dto.dueDate !== undefined
        ? dto.dueDate
          ? new Date(dto.dueDate)
          : null
        : task.dueDate;

    if (
      effectiveStartDate &&
      effectiveDueDate &&
      effectiveStartDate > effectiveDueDate
    ) {
      throw new BadRequestException('Start date cannot be after due date');
    }

    // Strict project date bounds validation
    if (task.project.isStrict) {
      if (
        effectiveStartDate &&
        task.project.startDate &&
        effectiveStartDate < new Date(task.project.startDate)
      ) {
        throw new BadRequestException(
          'Task start date cannot be before project start date in a strict project',
        );
      }
      if (
        effectiveDueDate &&
        task.project.endDate &&
        effectiveDueDate > new Date(task.project.endDate)
      ) {
        throw new BadRequestException(
          'Task due date cannot be after project end date in a strict project',
        );
      }
      const targetMilestoneId =
        dto.milestoneId !== undefined ? dto.milestoneId : task.milestoneId;
      if (targetMilestoneId) {
        const ms = await this.prisma.milestone.findUnique({
          where: { id: targetMilestoneId },
        });
        if (ms) {
          if (
            effectiveStartDate &&
            ms.startDate &&
            effectiveStartDate < new Date(ms.startDate)
          ) {
            throw new BadRequestException(
              'Task start date cannot be before milestone start date in a strict project',
            );
          }
          if (
            effectiveDueDate &&
            ms.dueDate &&
            effectiveDueDate > new Date(ms.dueDate)
          ) {
            throw new BadRequestException(
              'Task due date cannot be after milestone due date in a strict project',
            );
          }
        }
      }
    }

    // Auto-sync status and progress according to Zoho Projects rules
    let effectiveStatus = dto.status !== undefined ? dto.status : task.status;
    let effectiveProgress = dto.progress !== undefined ? dto.progress : task.progress;

    if (dto.status === TaskStatus.DONE && dto.progress === undefined) {
      effectiveProgress = 100;
    } else if (dto.progress === 100 && dto.status === undefined && task.status !== TaskStatus.DONE) {
      effectiveStatus = TaskStatus.DONE;
    } else if (
      dto.progress !== undefined &&
      dto.progress > 0 &&
      dto.progress < 100 &&
      task.status === TaskStatus.TODO &&
      dto.status === undefined
    ) {
      effectiveStatus = TaskStatus.IN_PROGRESS;
    } else if (dto.status === TaskStatus.TODO && dto.progress === undefined && task.progress > 0) {
      effectiveProgress = 0;
    } else if (
      task.status === TaskStatus.DONE &&
      dto.status !== undefined &&
      dto.status !== TaskStatus.DONE &&
      dto.progress === undefined
    ) {
      // Reopened task
      effectiveProgress = dto.status === TaskStatus.TODO ? 0 : (task.progress === 100 ? 50 : task.progress);
    }

    const oldTaskSnapshot = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      progress: task.progress,
      billingType: task.billingType,
      tags: task.tags,
      customFields: task.customFields,
      estimatedHours: task.estimatedHours,
      startDate: task.startDate,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      milestoneId: task.milestoneId,
      taskListId: task.taskListId,
    };

    // Determine fine-grained updates for Activity log
    const activitiesToCreate: any[] = [];
    if (dto.title && dto.title !== task.title) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'TITLE_CHANGED',
        oldValue: task.title,
        newValue: dto.title,
      });
    }
    if (dto.description !== undefined && dto.description !== task.description) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'DESCRIPTION_CHANGED',
        oldValue: task.description || '',
        newValue: dto.description || '',
      });
    }
    if (effectiveStatus !== task.status) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'STATUS_CHANGED',
        oldValue: task.status,
        newValue: effectiveStatus,
      });
    }
    if (dto.priority && dto.priority !== task.priority) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'PRIORITY_CHANGED',
        oldValue: task.priority,
        newValue: dto.priority,
      });
    }
    if (effectiveProgress !== task.progress) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'PROGRESS_CHANGED',
        oldValue: `${task.progress}%`,
        newValue: `${effectiveProgress}%`,
      });
    }
    if (dto.billingType && dto.billingType !== task.billingType) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'BILLING_TYPE_CHANGED',
        oldValue: task.billingType,
        newValue: dto.billingType,
      });
    }
    if (dto.tags !== undefined && dto.tags !== task.tags) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'TAGS_CHANGED',
        oldValue: task.tags || '',
        newValue: dto.tags || '',
      });
    }

    let sanitizedCustomFields = dto.customFields;
    if (dto.customFields !== undefined) {
      sanitizedCustomFields = await this.customFieldService.validateAndSanitizeTaskCustomFields(
        organizationId,
        task.projectId,
        dto.customFields,
        false,
        task.customFields,
      );
    }

    if (dto.customFields !== undefined && sanitizedCustomFields !== task.customFields) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'CUSTOM_FIELDS_CHANGED',
        oldValue: task.customFields || '',
        newValue: sanitizedCustomFields || '',
      });
    }
    if (dto.estimatedHours !== undefined && dto.estimatedHours !== task.estimatedHours) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'ESTIMATION_CHANGED',
        oldValue: task.estimatedHours != null ? `${task.estimatedHours}h` : 'None',
        newValue: dto.estimatedHours != null ? `${dto.estimatedHours}h` : 'None',
      });
    }
    const oldStartStr = task.startDate ? task.startDate.toISOString().split('T')[0] : 'None';
    const newStartStr = dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate).toISOString().split('T')[0] : 'None') : oldStartStr;
    const oldDueStr = task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'None';
    const newDueStr = dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate).toISOString().split('T')[0] : 'None') : oldDueStr;
    const isScheduleChanged = oldStartStr !== newStartStr || oldDueStr !== newDueStr;

    if (dto.startDate !== undefined && oldStartStr !== newStartStr) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'START_DATE_CHANGED',
        oldValue: oldStartStr,
        newValue: newStartStr,
      });
    }
    if (dto.dueDate !== undefined && oldDueStr !== newDueStr) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'DUE_DATE_CHANGED',
        oldValue: oldDueStr,
        newValue: newDueStr,
      });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      const oldAssigneeName = task.assignee
        ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim() || task.assignee.email
        : 'Unassigned';

      let newAssigneeName = 'Unassigned';
      if (dto.assigneeId) {
        const foundMember = task.project?.members?.find(
          (m: any) => m.userId === dto.assigneeId || m.user?.id === dto.assigneeId,
        );
        if (foundMember?.user) {
          newAssigneeName =
            `${foundMember.user.firstName || ''} ${foundMember.user.lastName || ''}`.trim() ||
            foundMember.user.email;
        } else {
          const u = await this.prisma.user.findUnique({
            where: { id: dto.assigneeId },
            select: { firstName: true, lastName: true, email: true },
          });
          if (u) {
            newAssigneeName =
              `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
          }
        }
      }

      activitiesToCreate.push({
        taskId,
        userId,
        action: 'ASSIGNEE_CHANGED',
        oldValue: oldAssigneeName,
        newValue: newAssigneeName,
      });
    }
    if (dto.taskListId !== undefined && dto.taskListId !== task.taskListId) {
      activitiesToCreate.push({
        taskId,
        userId,
        action: 'TASK_LIST_CHANGED',
        oldValue: task.taskListId,
        newValue: dto.taskListId,
      });
    }

    if (dto.milestoneId !== undefined && dto.milestoneId !== task.milestoneId) {
      if (task.milestoneId) {
        const ms = await this.prisma.milestone.findUnique({
          where: { id: task.milestoneId },
        });
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'TASK_UNLINKED_FROM_MILESTONE',
          oldValue: JSON.stringify({
            milestoneId: task.milestoneId,
            title: ms?.title,
          }),
          newValue: null,
        });
      }
      if (dto.milestoneId) {
        const ms = await this.prisma.milestone.findUnique({
          where: { id: dto.milestoneId },
        });
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'TASK_LINKED_TO_MILESTONE',
          oldValue: null,
          newValue: JSON.stringify({
            milestoneId: dto.milestoneId,
            title: ms?.title,
          }),
        });
      }
    }

    if (dto.parentTaskId !== undefined && dto.parentTaskId !== task.parentTaskId) {
      if (dto.parentTaskId === null) {
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'SUBTASK_CONVERTED_TO_TASK',
          oldValue: task.parentTaskId,
          newValue: null,
        });
      } else {
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'TASK_PARENT_CHANGED',
          oldValue: task.parentTaskId,
          newValue: dto.parentTaskId,
        });
      }
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto.description,
          status: effectiveStatus,
          priority: dto.priority,
          type: dto.type,
          progress: effectiveProgress,
          billingType: dto.billingType,
          tags: dto.tags !== undefined ? dto.tags : undefined,
          customFields: dto.customFields !== undefined ? sanitizedCustomFields : undefined,
          estimatedHours: dto.estimatedHours,
          startDate:
            dto.startDate !== undefined
              ? dto.startDate
                ? new Date(dto.startDate)
                : null
              : undefined,
          dueDate:
            dto.dueDate !== undefined
              ? dto.dueDate
                ? new Date(dto.dueDate)
                : null
              : undefined,
          assigneeId: dto.assigneeId,
          milestoneId: dto.milestoneId,
          taskListId: dto.taskListId,
          parentTaskId: dto.parentTaskId,
        },
      });

      for (const act of activitiesToCreate) {
        await tx.taskActivity.create({ data: act });
      }

      await tx.taskActivity.create({
        data: {
          taskId,
          userId,
          action: 'TASK_UPDATED',
          oldValue: JSON.stringify(oldTaskSnapshot),
          newValue: JSON.stringify(updated),
        },
      });

      // Cascade task list and milestone changes to child subtasks
      if (dto.taskListId !== undefined || dto.milestoneId !== undefined) {
        await this.cascadeParentHierarchyUpdates(
          tx,
          taskId,
          dto.taskListId,
          dto.milestoneId,
        );
      }

      // Trigger auto transition for milestone
      const finalStatus = effectiveStatus;
      const finalMilestoneId =
        dto.milestoneId !== undefined ? dto.milestoneId : task.milestoneId;
      if (finalMilestoneId) {
        await this.autoTransitionMilestone(
          tx,
          finalMilestoneId,
          finalStatus,
          userId,
          organizationId,
        );
      }

      // If schedule dates changed, cascade dependent task dates
      if (isScheduleChanged) {
        await this.cascadeDependentTaskDates(tx, taskId);
      }

      return updated;
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'Task',
        entityId: taskId,
        action: 'TASK_UPDATED',
        projectId: task.projectId,
        taskId: task.id,
        oldValue: JSON.stringify(oldTaskSnapshot),
        newValue: JSON.stringify(updatedTask),
      },
    });

    // 1. Assignment / Reassignment notification to new assignee
    if (
      dto.assigneeId &&
      dto.assigneeId !== task.assigneeId &&
      dto.assigneeId !== userId
    ) {
      await this.notificationService.createNotification({
        type: NotificationType.TASK_ASSIGNMENT,
        title: 'New Task Assigned',
        message: `You have been assigned task [${task.project.projectCode}-${task.taskNumber}]: ${updatedTask.title}`,
        userId: dto.assigneeId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
        },
      });
    }

    // 1.1 Unassignment notification to previous assignee
    if (
      task.assigneeId &&
      dto.assigneeId !== undefined &&
      dto.assigneeId !== task.assigneeId &&
      task.assigneeId !== userId
    ) {
      await this.notificationService.createNotification({
        type: NotificationType.TASK_UNASSIGNED,
        title: 'Task Unassigned',
        message: `You have been unassigned from task [${task.project.projectCode}-${task.taskNumber}]: ${updatedTask.title}`,
        userId: task.assigneeId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
        },
      });
    }

    // 2. Reschedule relative reminders if due date changed
    if (isScheduleChanged && oldDueStr !== newDueStr) {
      await this.taskReminderService.rescheduleTaskReminders(
        taskId,
        updatedTask.dueDate,
      );
    }

    // 3. Dismiss reminders if task is completed
    if (effectiveStatus === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      await this.taskReminderService.dismissTaskRemindersOnDone(taskId);
    }

    // 4. Status, Priority, or Schedule change notifications to watchers, assignee, reporter
    if (
      (effectiveStatus !== task.status || (dto.priority && dto.priority !== task.priority) || isScheduleChanged) &&
      (updatedTask.assigneeId || (task.watchers && task.watchers.length > 0) || task.reporterId)
    ) {
      const recipientIds = new Set<string>();
      if (updatedTask.assigneeId && updatedTask.assigneeId !== userId) {
        recipientIds.add(updatedTask.assigneeId);
      }
      if (task.reporterId && task.reporterId !== userId) {
        recipientIds.add(task.reporterId);
      }
      if (task.watchers) {
        for (const w of task.watchers) {
          if (w.userId !== userId) {
            recipientIds.add(w.userId);
          }
        }
      }

      if (recipientIds.size > 0) {
        let notifType: NotificationType = NotificationType.TASK_STATUS_CHANGED;
        let title = 'Task Status Updated';
        let msg = `Task [${task.project.projectCode}-${task.taskNumber}] was updated.`;

        if (effectiveStatus !== task.status) {
          if (effectiveStatus === TaskStatus.DONE) {
            notifType = NotificationType.TASK_COMPLETED;
            title = 'Task Completed';
            msg = `Task [${task.project.projectCode}-${task.taskNumber}] "${updatedTask.title}" was marked as completed.`;
          } else if (task.status === TaskStatus.DONE) {
            notifType = NotificationType.TASK_REOPENED;
            title = 'Task Reopened';
            msg = `Task [${task.project.projectCode}-${task.taskNumber}] "${updatedTask.title}" was reopened to ${effectiveStatus}.`;
          } else {
            notifType = NotificationType.TASK_STATUS_CHANGED;
            title = 'Task Status Updated';
            msg = `Task [${task.project.projectCode}-${task.taskNumber}] status changed to ${effectiveStatus}`;
          }
        } else if (dto.priority && dto.priority !== task.priority) {
          notifType = NotificationType.TASK_PRIORITY_CHANGED;
          title = 'Task Priority Updated';
          msg = `Task [${task.project.projectCode}-${task.taskNumber}] priority changed to ${dto.priority}`;
        } else if (isScheduleChanged) {
          notifType = NotificationType.TASK_DUE_DATE_CHANGED;
          title = 'Task Schedule Updated';
          if (oldDueStr !== newDueStr) {
            msg = `Task [${task.project.projectCode}-${task.taskNumber}] due date updated to ${newDueStr}`;
          } else {
            msg = `Task [${task.project.projectCode}-${task.taskNumber}] start date updated to ${newStartStr}`;
          }
        }

        const notifications = Array.from(recipientIds).map((recId) => ({
          type: notifType,
          title,
          message: msg,
          userId: recId,
          actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
          triggeredById: userId,
          projectId: task.projectId,
          taskId: task.id,
          organizationId,
          metadata: {
            projectCode: task.project.projectCode,
            taskNumber: task.taskNumber,
            status: effectiveStatus,
            priority: updatedTask.priority,
            dueDate: updatedTask.dueDate,
          },
        }));

        await this.notificationService.createNotificationsBulk(notifications);
      }
    }

    // If task was marked DONE, notify assignees of dependent successor tasks
    if (effectiveStatus === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      await this.notifySuccessorsOnPredecessorDone(
        organizationId,
        userId,
        taskId,
        task.taskNumber,
        task.title,
        task.projectId,
        task.project.projectCode,
      );
    }

    return updatedTask;
  }

  async updateTaskStatus(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const current = task.status;
    const target = dto.status;

    if (current !== target) {
      // Auto-sync completion progress according to Zoho Projects rules
      let effectiveProgress = task.progress;
      if (target === TaskStatus.DONE) {
        effectiveProgress = 100;
      } else if (target === TaskStatus.TODO) {
        effectiveProgress = 0;
      } else if (current === TaskStatus.DONE) {
        // Reopened task
        effectiveProgress = task.progress === 100 ? 50 : task.progress;
      }

      const updatedTask = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id: taskId },
          data: {
            status: target,
            progress: effectiveProgress,
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId,
            userId,
            action: 'STATUS_CHANGED',
            oldValue: current,
            newValue: target,
          },
        });

        if (effectiveProgress !== task.progress) {
          await tx.taskActivity.create({
            data: {
              taskId,
              userId,
              action: 'PROGRESS_CHANGED',
              oldValue: `${task.progress}%`,
              newValue: `${effectiveProgress}%`,
            },
          });
        }

        if (updated.milestoneId) {
          await this.autoTransitionMilestone(
            tx,
            updated.milestoneId,
            target,
            userId,
            organizationId,
          );
        }

        return updated;
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Task',
          entityId: taskId,
          action: 'TASK_STATUS_CHANGED',
          projectId: task.projectId,
          taskId: task.id,
          oldValue: current,
          newValue: target,
        },
      });

      // If marked DONE, dismiss reminders
      if (target === TaskStatus.DONE) {
        await this.taskReminderService.dismissTaskRemindersOnDone(taskId);
      }

      // Dispatch notifications to assignee, reporter, and watchers
      const recipientIds = new Set<string>();
      if (task.assigneeId && task.assigneeId !== userId) {
        recipientIds.add(task.assigneeId);
      }
      if (task.reporterId && task.reporterId !== userId) {
        recipientIds.add(task.reporterId);
      }
      if (task.watchers) {
        for (const w of task.watchers) {
          if (w.userId !== userId) {
            recipientIds.add(w.userId);
          }
        }
      }

      if (recipientIds.size > 0) {
        const notifType = target === TaskStatus.DONE
          ? NotificationType.TASK_COMPLETED
          : current === TaskStatus.DONE
          ? NotificationType.TASK_REOPENED
          : NotificationType.TASK_STATUS_CHANGED;

        const title = target === TaskStatus.DONE
          ? 'Task Completed'
          : current === TaskStatus.DONE
          ? 'Task Reopened'
          : 'Task Status Updated';

        const message = target === TaskStatus.DONE
          ? `Task [${task.project.projectCode}-${task.taskNumber}] "${task.title}" was marked as completed.`
          : current === TaskStatus.DONE
          ? `Task [${task.project.projectCode}-${task.taskNumber}] "${task.title}" was reopened to ${target}.`
          : `Task [${task.project.projectCode}-${task.taskNumber}] status changed from ${current} to ${target}`;

        const notifications = Array.from(recipientIds).map((recId) => ({
          type: notifType,
          title,
          message,
          userId: recId,
          actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
          triggeredById: userId,
          projectId: task.projectId,
          taskId: task.id,
          organizationId,
          metadata: {
            projectCode: task.project.projectCode,
            taskNumber: task.taskNumber,
            status: target,
          },
        }));

        await this.notificationService.createNotificationsBulk(notifications);
      }

      if (target === TaskStatus.DONE) {
        await this.notifySuccessorsOnPredecessorDone(
          organizationId,
          userId,
          task.id,
          task.taskNumber,
          task.title,
          task.projectId,
          task.project.projectCode,
        );
      }

      return updatedTask;
    }

    return task;
  }

  async archiveTask(organizationId: string, userId: string, taskId: string) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'TASK_ARCHIVED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'Task',
        entityId: taskId,
        action: 'TASK_ARCHIVED',
        projectId: task.projectId,
        taskId: task.id,
        newValue: JSON.stringify(updatedTask),
      },
    });

    return updatedTask;
  }

  async deleteTask(organizationId: string, userId: string, taskId: string) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot delete tasks in an archived project',
      );
    }

    const descendantIds = await this.getAllDescendantTaskIds(taskId);
    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        // 1. Soft delete the task
        await tx.task.update({
          where: { id: taskId },
          data: { deletedAt: now },
        });

        // 2. Cascade soft delete all descendant subtasks recursively
        if (descendantIds.length > 0) {
          await tx.task.updateMany({
            where: { id: { in: descendantIds }, deletedAt: null },
            data: { deletedAt: now },
          });
        }

        // 2b. Clean up dependencies associated with deleted task and subtasks
        const allTargetIds = [taskId, ...descendantIds];
        await tx.taskDependency.deleteMany({
          where: {
            OR: [
              { predecessorId: { in: allTargetIds } },
              { successorId: { in: allTargetIds } },
            ],
          },
        });

        // 3. Log TaskActivity
        await tx.taskActivity.create({
          data: {
            taskId,
            userId,
            action: 'TASK_DELETED',
            oldValue: JSON.stringify({ id: taskId, title: task.title }),
          },
        });

        // 4. Log ProjectActivity
        await tx.projectActivity.create({
          data: {
            projectId: task.projectId,
            userId,
            organizationId,
            action: 'TASK_DELETED',
            oldValue: JSON.stringify({
              id: taskId,
              title: task.title,
              taskNumber: task.taskNumber,
            }),
          },
        });

        // 5. Log AuditLog
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            entityType: 'Task',
            entityId: taskId,
            action: 'TASK_DELETED',
            projectId: task.projectId,
            taskId: task.id,
            newValue: JSON.stringify({ id: taskId, title: task.title }),
          },
        });
      },
      { timeout: 15000 },
    );

    return { success: true, message: 'Task deleted successfully', id: taskId };
  }

  async cloneTask(organizationId: string, userId: string, taskId: string) {
    const sourceTask = await this.getTaskById(organizationId, userId, taskId);

    if (sourceTask.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot clone tasks in an archived project',
      );
    }

    const cloned = await this.createTask(organizationId, userId, {
      title: `${sourceTask.title} (Copy)`,
      description: sourceTask.description || undefined,
      projectId: sourceTask.projectId,
      status: TaskStatus.TODO,
      priority: sourceTask.priority,
      type: sourceTask.type,
      progress: 0,
      billingType: sourceTask.billingType,
      estimatedHours: sourceTask.estimatedHours || undefined,
      startDate: sourceTask.startDate ? sourceTask.startDate.toISOString() : undefined,
      dueDate: sourceTask.dueDate ? sourceTask.dueDate.toISOString() : undefined,
      assigneeId: sourceTask.assigneeId || undefined,
      milestoneId: sourceTask.milestoneId || undefined,
      taskListId: sourceTask.taskListId || undefined,
      tags: sourceTask.tags || undefined,
      customFields: sourceTask.customFields || undefined,
    });

    // Copy attachments if any
    if (sourceTask.attachments && sourceTask.attachments.length > 0) {
      for (const att of sourceTask.attachments) {
        await this.prisma.taskAttachment.create({
          data: {
            taskId: cloned.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            uploadedById: userId,
            organizationId,
          },
        });
      }
    }

    return cloned;
  }

  async createComment(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: CreateCommentDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
        organizationId,
      },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'COMMENT_ADDED',
        newValue: comment.content,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskComment',
        entityId: comment.id,
        action: 'TASK_COMMENT_ADDED',
        projectId: task.projectId,
        taskId: task.id,
        newValue: JSON.stringify(comment),
      },
    });

    // Parse @mentions
    const mentionMatches = dto.content.match(/@\[([^\]]+)\]\(([^)]+)\)|@([a-zA-Z0-9_.-]+)/g) || [];
    const mentionedUserIds = new Set<string>();

    for (const match of mentionMatches) {
      if (match.startsWith('@[') && match.includes('](')) {
        const idMatch = match.match(/@\[([^\]]+)\]\(([^)]+)\)/);
        if (idMatch && idMatch[2]) {
          const mentionedId = idMatch[2];
          if (mentionedId !== userId) {
            mentionedUserIds.add(mentionedId);
          }
        }
      } else {
        const handle = match.substring(1).toLowerCase();
        const matchedUsers = await this.prisma.user.findMany({
          where: {
            organizationId,
            deletedAt: null,
            OR: [
              { email: { startsWith: handle } },
              { firstName: { equals: handle } },
              { id: handle },
            ],
          },
          select: { id: true },
        });
        matchedUsers.forEach((u) => {
          if (u.id !== userId) mentionedUserIds.add(u.id);
        });
      }
    }

    const notifyUserIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== userId && !mentionedUserIds.has(task.assigneeId)) {
      notifyUserIds.add(task.assigneeId);
    }
    if (task.reporterId && task.reporterId !== userId && !mentionedUserIds.has(task.reporterId)) {
      notifyUserIds.add(task.reporterId);
    }
    if (task.watchers) {
      for (const watcher of task.watchers) {
        if (watcher.userId !== userId && !mentionedUserIds.has(watcher.userId)) {
          notifyUserIds.add(watcher.userId);
        }
      }
    }

    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const commenterName = commenter
      ? `${commenter.firstName} ${commenter.lastName || ''}`.trim()
      : 'Someone';
    const cleanContent =
      comment.content.length > 50
        ? `${comment.content.substring(0, 50)}...`
        : comment.content;

    // 1. Dispatch mention notifications
    if (mentionedUserIds.size > 0) {
      const mentionNotifs = Array.from(mentionedUserIds).map((mUserId) => ({
        type: NotificationType.TASK_MENTION,
        title: 'Mentioned in Task Comment',
        message: `${commenterName} mentioned you on task [${task.project.projectCode}-${task.taskNumber}]: "${cleanContent}"`,
        userId: mUserId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
          commentId: comment.id,
        },
      }));
      await this.notificationService.createNotificationsBulk(mentionNotifs);
    }

    // 2. Dispatch regular comment notifications
    if (notifyUserIds.size > 0) {
      const notifications = Array.from(notifyUserIds).map((recipientId) => ({
        type: NotificationType.TASK_COMMENT,
        title: 'New Comment on Task',
        message: `${commenterName} commented on task [${task.project.projectCode}-${task.taskNumber}]: "${cleanContent}"`,
        userId: recipientId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
        },
      }));

      await this.notificationService.createNotificationsBulk(notifications);
    }

    return comment;
  }

  async getAttachments(
    organizationId: string,
    userId: string,
    taskId: string,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId, organizationId },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const documents = await this.prisma.projectDocument.findMany({
      where: { taskId, organizationId, deletedAt: null },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      taskId: task.id,
      taskNumber: task.taskNumber,
      projectId: task.projectId,
      attachments,
      documents,
      totalCount: attachments.length + documents.length,
    };
  }

  async createAttachment(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: CreateAttachmentMetadataDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    if (task.project.settings && task.project.settings.allowFileUploads === false) {
      throw new ForbiddenException(
        'Document uploads are disabled for this project',
      );
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (dto.fileSize && dto.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the 50MB limit');
    }

    if (!dto.fileName || !dto.fileUrl) {
      throw new BadRequestException('File name and file URL are required');
    }

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize || 0,
        uploadedById: userId,
        organizationId,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'ATTACHMENT_UPLOADED',
        newValue: attachment.fileName,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        action: 'TASK_ATTACHMENT_UPLOADED',
        projectId: task.projectId,
        taskId: task.id,
        newValue: JSON.stringify(attachment),
      },
    });

    // Notify task watchers and assignee
    const notifyUserIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== userId) {
      notifyUserIds.add(task.assigneeId);
    }
    if (task.watchers) {
      task.watchers.forEach((w) => {
        if (w.userId !== userId) notifyUserIds.add(w.userId);
      });
    }

    if (notifyUserIds.size > 0) {
      const uploader = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const uploaderName = uploader
        ? `${uploader.firstName} ${uploader.lastName || ''}`.trim()
        : 'Someone';

      const notifications = Array.from(notifyUserIds).map((recipientId) => ({
        type: NotificationType.TASK_ATTACHMENT,
        title: 'New Attachment on Task',
        message: `${uploaderName} attached "${attachment.fileName}" to task [${task.project.projectCode}-${task.taskNumber}]`,
        userId: recipientId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
          attachmentId: attachment.id,
        },
      }));

      await this.notificationService.createNotificationsBulk(notifications);
    }

    return attachment;
  }

  async createAttachmentsBulk(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: BulkCreateAttachmentMetadataDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    if (task.project.settings && task.project.settings.allowFileUploads === false) {
      throw new ForbiddenException(
        'Document uploads are disabled for this project',
      );
    }

    if (!dto.attachments || dto.attachments.length === 0) {
      throw new BadRequestException('At least one attachment must be provided');
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    for (const item of dto.attachments) {
      if (item.fileSize && item.fileSize > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${item.fileName}" exceeds the 50MB limit`,
        );
      }
      if (!item.fileName || !item.fileUrl) {
        throw new BadRequestException('File name and file URL are required for all attachments');
      }
    }

    const createdAttachments: any[] = [];
    for (const item of dto.attachments) {
      const attachment = await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize || 0,
          uploadedById: userId,
          organizationId,
        },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      await this.prisma.taskActivity.create({
        data: {
          taskId,
          userId,
          action: 'ATTACHMENT_UPLOADED',
          newValue: attachment.fileName,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TaskAttachment',
          entityId: attachment.id,
          action: 'TASK_ATTACHMENT_UPLOADED',
          projectId: task.projectId,
          taskId: task.id,
          newValue: JSON.stringify(attachment),
        },
      });

      createdAttachments.push(attachment);
    }

    // Notify task watchers and assignee
    const notifyUserIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== userId) {
      notifyUserIds.add(task.assigneeId);
    }
    if (task.watchers) {
      task.watchers.forEach((w) => {
        if (w.userId !== userId) notifyUserIds.add(w.userId);
      });
    }

    if (notifyUserIds.size > 0) {
      const uploader = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const uploaderName = uploader
        ? `${uploader.firstName} ${uploader.lastName || ''}`.trim()
        : 'Someone';

      const fileCountStr = createdAttachments.length === 1 ? createdAttachments[0].fileName : `${createdAttachments.length} files`;
      const notifications = Array.from(notifyUserIds).map((recipientId) => ({
        type: NotificationType.TASK_ATTACHMENT,
        title: 'New Attachments on Task',
        message: `${uploaderName} attached ${fileCountStr} to task [${task.project.projectCode}-${task.taskNumber}]`,
        userId: recipientId,
        actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
        triggeredById: userId,
        projectId: task.projectId,
        taskId: task.id,
        organizationId,
        metadata: {
          projectCode: task.project.projectCode,
          taskNumber: task.taskNumber,
          count: createdAttachments.length,
        },
      }));

      await this.notificationService.createNotificationsBulk(notifications);
    }

    return createdAttachments;
  }

  async updateAttachment(
    organizationId: string,
    userId: string,
    taskId: string,
    attachmentId: string,
    dto: UpdateAttachmentMetadataDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId, organizationId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const updated = await this.prisma.taskAttachment.update({
      where: { id: attachmentId },
      data: { fileName: dto.fileName },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'ATTACHMENT_RENAMED',
        oldValue: attachment.fileName,
        newValue: updated.fileName,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        action: 'TASK_ATTACHMENT_RENAMED',
        projectId: task.projectId,
        taskId: task.id,
        oldValue: attachment.fileName,
        newValue: updated.fileName,
      },
    });

    return updated;
  }

  async deleteAttachment(
    organizationId: string,
    userId: string,
    taskId: string,
    attachmentId: string,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId, organizationId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'ATTACHMENT_DELETED',
        oldValue: attachment.fileName,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        action: 'TASK_ATTACHMENT_DELETED',
        projectId: task.projectId,
        taskId: task.id,
        oldValue: JSON.stringify(attachment),
      },
    });

    return {
      success: true,
      message: 'Attachment deleted successfully',
      id: attachmentId,
    };
  }

  async linkDocumentToTask(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: LinkDocumentToTaskDto,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const doc = await this.prisma.projectDocument.findFirst({
      where: {
        id: dto.documentId,
        projectId: task.projectId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new NotFoundException(
        'Project document not found in this project',
      );
    }

    const updated = await this.prisma.projectDocument.update({
      where: { id: dto.documentId },
      data: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        folder: { select: { id: true, name: true } },
        versions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'DOCUMENT_LINKED',
        newValue: doc.name,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'ProjectDocument',
        entityId: doc.id,
        action: 'PROJECT_DOCUMENT_LINKED_TO_TASK',
        projectId: task.projectId,
        taskId: task.id,
        newValue: doc.name,
      },
    });

    return updated;
  }

  async unlinkDocumentFromTask(
    organizationId: string,
    userId: string,
    taskId: string,
    documentId: string,
  ) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify tasks in an archived project',
      );
    }

    const doc = await this.prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        taskId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!doc) {
      throw new NotFoundException(
        'Linked project document not found on this task',
      );
    }

    await this.prisma.projectDocument.update({
      where: { id: documentId },
      data: { taskId: null },
    });

    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action: 'DOCUMENT_UNLINKED',
        oldValue: doc.name,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'ProjectDocument',
        entityId: doc.id,
        action: 'PROJECT_DOCUMENT_UNLINKED_FROM_TASK',
        projectId: task.projectId,
        taskId: task.id,
        oldValue: doc.name,
      },
    });

    return {
      success: true,
      message: 'Document unlinked from task successfully',
      id: documentId,
    };
  }

  async toggleWatcher(organizationId: string, userId: string, taskId: string) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    const existingWatcher = await this.prisma.taskWatcher.findFirst({
      where: { taskId, userId },
    });

    if (existingWatcher) {
      await this.prisma.taskWatcher.delete({
        where: { id: existingWatcher.id },
      });
      return { watched: false };
    } else {
      const watcher = await this.prisma.taskWatcher.create({
        data: { taskId, userId },
      });

      return { watched: true };
    }
  }

  async getAssignedTasks(organizationId: string, userId: string) {
    return this.prisma.task.findMany({
      where: {
        organizationId,
        assigneeId: userId,
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getKanbanBoard(
    organizationId: string,
    userId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Enforce private project visibility checks
    if (project.visibility === 'PRIVATE') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const isClient = await isClientUser(this.prisma, userId, projectId);

    const taskListWhere: any = { projectId, organizationId, deletedAt: null };
    const taskWhere: any = { projectId, deletedAt: null };

    if (isClient) {
      taskListWhere.flag = 'EXTERNAL';
      taskWhere.OR = [
        { taskList: { flag: 'EXTERNAL' } },
        { taskListId: null, milestone: { flag: 'EXTERNAL' } },
      ];
    }

    const taskLists = await this.prisma.taskList.findMany({
      where: taskListWhere,
      orderBy: { position: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        labels: {
          include: { label: true },
        },
        taskList: {
          select: { id: true, name: true, flag: true, status: true },
        },
        milestone: {
          select: { id: true, title: true },
        },
        subtasks: {
          where: { deletedAt: null },
          select: { id: true, status: true },
        },
        _count: {
          select: { subtasks: { where: { deletedAt: null } } },
        },
      },
      orderBy: { position: 'asc' },
    });

    const byTaskList: Record<string, any[]> = {};
    for (const tl of taskLists) {
      byTaskList[tl.id] = tasks.filter((t) => t.taskListId === tl.id);
    }
    byTaskList['unassigned'] = tasks.filter((t) => !t.taskListId);

    const byPriority = {
      critical: tasks.filter((t) => t.priority === TaskPriority.CRITICAL),
      high: tasks.filter((t) => t.priority === TaskPriority.HIGH),
      medium: tasks.filter((t) => t.priority === TaskPriority.MEDIUM),
      low: tasks.filter((t) => t.priority === TaskPriority.LOW),
    };

    return {
      todo: tasks.filter((t) => t.status === TaskStatus.TODO),
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
      review: tasks.filter((t) => t.status === TaskStatus.REVIEW),
      done: tasks.filter((t) => t.status === TaskStatus.DONE),
      blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED),
      byTaskList,
      byPriority,
      taskLists,
      totalCount: tasks.length,
    };
  }

  async getSubtasks(
    organizationId: string,
    userId: string,
    parentTaskId: string,
  ) {
    await this.getTaskById(organizationId, userId, parentTaskId);
    return this.prisma.task.findMany({
      where: { parentTaskId, deletedAt: null },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subtasks: {
          where: { deletedAt: null },
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        _count: {
          select: { subtasks: { where: { deletedAt: null } } },
        },
      },
      orderBy: { position: 'asc' },
    });
  }

  async createSubtask(
    organizationId: string,
    userId: string,
    parentTaskId: string,
    dto: CreateTaskDto,
  ) {
    const parent = await this.getTaskById(organizationId, userId, parentTaskId);
    return this.createTask(organizationId, userId, {
      ...dto,
      projectId: parent.projectId,
      parentTaskId,
      taskListId: dto.taskListId || parent.taskListId || undefined,
      milestoneId: dto.milestoneId || parent.milestoneId || undefined,
    });
  }

  async reorderTask(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: ReorderTaskDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: {
        watchers: true,
        project: {
          include: {
            members: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot reorder tasks in an archived project',
      );
    }

    if (task.project.visibility === 'PRIVATE') {
      const isMember = task.project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const current = task.status;
    const targetStatus = dto.status || current;

    // Progress synchronization for board drag and drop
    let effectiveProgress = task.progress;
    if (dto.status && current !== targetStatus) {
      if (targetStatus === TaskStatus.DONE) {
        effectiveProgress = 100;
      } else if (targetStatus === TaskStatus.TODO) {
        effectiveProgress = 0;
      } else if (current === TaskStatus.DONE) {
        effectiveProgress = task.progress === 100 ? 50 : task.progress;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Get other tasks in the target column
      const targetColumnTasks = await tx.task.findMany({
        where: {
          projectId: task.projectId,
          status: targetStatus,
          deletedAt: null,
          NOT: { id: task.id },
        },
        orderBy: { position: 'asc' },
      });

      // 2. Insert current task at target position
      const targetIndex = Math.max(
        0,
        Math.min(dto.position, targetColumnTasks.length),
      );
      const taskIdList = targetColumnTasks.map((t) => t.id);
      taskIdList.splice(targetIndex, 0, task.id);

      // 3. Re-index target column
      for (let i = 0; i < taskIdList.length; i++) {
        const id = taskIdList[i];
        if (id === task.id) {
          const updateData: any = {
            position: i,
            status: targetStatus,
            progress: effectiveProgress,
          };
          if (dto.taskListId !== undefined) {
            updateData.taskListId = dto.taskListId || null;
          }
          if (dto.priority !== undefined) {
            updateData.priority = dto.priority;
          }
          if (dto.assigneeId !== undefined) {
            updateData.assigneeId = dto.assigneeId || null;
          }

          await tx.task.update({
            where: { id },
            data: updateData,
          });
        } else {
          const existing = targetColumnTasks.find((t) => t.id === id);
          if (existing && existing.position !== i) {
            await tx.task.update({
              where: { id },
              data: { position: i },
            });
          }
        }
      }

      // 4. Re-index source column if column changed
      if (dto.status && current !== targetStatus) {
        const sourceColumnTasks = await tx.task.findMany({
          where: {
            projectId: task.projectId,
            status: current,
            deletedAt: null,
            NOT: { id: task.id },
          },
          orderBy: { position: 'asc' },
        });

        for (let i = 0; i < sourceColumnTasks.length; i++) {
          if (sourceColumnTasks[i].position !== i) {
            await tx.task.update({
              where: { id: sourceColumnTasks[i].id },
              data: { position: i },
            });
          }
        }

        // 5. Track activity and audit log
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId,
            action: 'STATUS_CHANGED',
            oldValue: current,
            newValue: targetStatus,
          },
        });

        if (effectiveProgress !== task.progress) {
          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              userId,
              action: 'PROGRESS_CHANGED',
              oldValue: `${task.progress}%`,
              newValue: `${effectiveProgress}%`,
            },
          });
        }

        if (task.milestoneId) {
          await this.autoTransitionMilestone(
            tx,
            task.milestoneId,
            targetStatus,
            userId,
            organizationId,
          );
        }

        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            entityType: 'Task',
            entityId: task.id,
            action: 'TASK_STATUS_CHANGED',
            projectId: task.projectId,
            taskId: task.id,
            oldValue: current,
            newValue: targetStatus,
          },
        });
      }
    });

    // Send notifications if status changed
    if (dto.status && current !== targetStatus) {
      const recipientIds = new Set<string>();
      if (task.assigneeId && task.assigneeId !== userId) {
        recipientIds.add(task.assigneeId);
      }
      if (task.watchers) {
        for (const w of task.watchers) {
          if (w.userId !== userId) {
            recipientIds.add(w.userId);
          }
        }
      }

      if (recipientIds.size > 0) {
        const notifications = Array.from(recipientIds).map((recId) => ({
          type: NotificationType.SYSTEM,
          title: 'Task Status Updated',
          message: `Task [${task.project.projectCode}-${task.taskNumber}] status changed from ${current} to ${targetStatus}`,
          userId: recId,
          actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
          triggeredById: userId,
          projectId: task.projectId,
          taskId: task.id,
          organizationId,
          metadata: {
            projectCode: task.project.projectCode,
            taskNumber: task.taskNumber,
            status: targetStatus,
          },
        }));

        await this.notificationService.createNotificationsBulk(notifications);
      }
    }

    if (targetStatus === TaskStatus.DONE && current !== TaskStatus.DONE) {
      await this.notifySuccessorsOnPredecessorDone(
        organizationId,
        userId,
        task.id,
        task.taskNumber,
        task.title,
        task.projectId,
        task.project.projectCode,
      );
    }

    const updatedTask = await this.prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        labels: {
          include: { label: true },
        },
      },
    });

    return updatedTask;
  }

  // ─── Task Dependencies & CPM Scheduling Engine ──────────────────────────────

  private parseWorkingDays(workingDaysStr?: string): Set<number> {
    if (!workingDaysStr) {
      return new Set([1, 2, 3, 4, 5]); // default Monday to Friday
    }
    const days = workingDaysStr
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => !isNaN(d));
    return new Set(days.length > 0 ? days : [1, 2, 3, 4, 5]);
  }

  private isWorkingDay(date: Date, workingDaysSet: Set<number>): boolean {
    const jsDay = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const dayNum = jsDay === 0 ? 7 : jsDay;
    return workingDaysSet.has(dayNum) || workingDaysSet.has(jsDay);
  }

  private addWorkingDays(
    startDate: Date,
    daysToAdd: number,
    workingDaysSet: Set<number>,
  ): Date {
    const result = new Date(startDate.getTime());
    result.setHours(0, 0, 0, 0);

    if (daysToAdd === 0) {
      while (!this.isWorkingDay(result, workingDaysSet)) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    }

    const step = daysToAdd > 0 ? 1 : -1;
    let remaining = Math.abs(daysToAdd);

    while (remaining > 0) {
      result.setDate(result.getDate() + step);
      if (this.isWorkingDay(result, workingDaysSet)) {
        remaining--;
      }
    }
    return result;
  }

  private calculateDurationInDays(start: Date, due: Date): number {
    const diffMs = due.getTime() - start.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  private async validateCircularDependency(
    projectId: string,
    predecessorId: string,
    successorId: string,
    excludeDependencyId?: string,
  ): Promise<void> {
    if (predecessorId === successorId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    // Get all project dependencies
    const allDependencies = await this.prisma.taskDependency.findMany({
      where: {
        projectId,
        ...(excludeDependencyId ? { NOT: { id: excludeDependencyId } } : {}),
      },
      select: {
        predecessorId: true,
        successorId: true,
      },
    });

    // Build adjacency graph: predecessor -> successors
    const adj = new Map<string, string[]>();
    for (const dep of allDependencies) {
      if (!adj.has(dep.predecessorId)) {
        adj.set(dep.predecessorId, []);
      }
      adj.get(dep.predecessorId)!.push(dep.successorId);
    }

    // Add hypothetical edge
    if (!adj.has(predecessorId)) {
      adj.set(predecessorId, []);
    }
    adj.get(predecessorId)!.push(successorId);

    // Run DFS from successorId to see if we can reach predecessorId
    const visited = new Set<string>();
    const stack = [successorId];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr === predecessorId) {
        throw new BadRequestException(
          'Circular dependency detected: adding this dependency would create a loop in task scheduling',
        );
      }
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = adj.get(curr) || [];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            stack.push(n);
          }
        }
      }
    }
  }

  async cascadeDependentTaskDates(
    tx: any,
    changedTaskId: string,
    visited: Set<string> = new Set(),
  ) {
    if (visited.has(changedTaskId)) return;
    visited.add(changedTaskId);

    const changedTask = await tx.task.findUnique({
      where: { id: changedTaskId },
      include: {
        project: {
          select: {
            workingDays: true,
            isStrict: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!changedTask) return;

    const workingDaysSet = this.parseWorkingDays(
      changedTask.project?.workingDays,
    );

    const outgoingDeps = await tx.taskDependency.findMany({
      where: { predecessorId: changedTaskId, linkType: 'HARD' },
      include: {
        successor: true,
      },
    });

    for (const dep of outgoingDeps) {
      const successor = dep.successor;
      if (!successor || successor.deletedAt) continue;

      let targetStartDate: Date | null = successor.startDate;
      let targetDueDate: Date | null = successor.dueDate;
      const duration =
        successor.startDate && successor.dueDate
          ? this.calculateDurationInDays(successor.startDate, successor.dueDate)
          : null;

      const pStart = changedTask.startDate;
      const pDue = changedTask.dueDate || changedTask.startDate;

      let datesModified = false;

      switch (dep.type) {
        case DependencyType.FINISH_TO_START: {
          if (pDue) {
            const calculatedStart = this.addWorkingDays(
              pDue,
              dep.lag,
              workingDaysSet,
            );
            if (
              !successor.startDate ||
              successor.startDate.getTime() !== calculatedStart.getTime()
            ) {
              targetStartDate = calculatedStart;
              if (duration !== null) {
                targetDueDate = this.addWorkingDays(
                  targetStartDate,
                  duration,
                  workingDaysSet,
                );
              } else if (
                successor.dueDate &&
                successor.dueDate < targetStartDate
              ) {
                targetDueDate = targetStartDate;
              }
              datesModified = true;
            }
          }
          break;
        }
        case DependencyType.START_TO_START: {
          if (pStart) {
            const calculatedStart = this.addWorkingDays(
              pStart,
              dep.lag,
              workingDaysSet,
            );
            if (
              !successor.startDate ||
              successor.startDate.getTime() !== calculatedStart.getTime()
            ) {
              targetStartDate = calculatedStart;
              if (duration !== null) {
                targetDueDate = this.addWorkingDays(
                  targetStartDate,
                  duration,
                  workingDaysSet,
                );
              }
              datesModified = true;
            }
          }
          break;
        }
        case DependencyType.FINISH_TO_FINISH: {
          if (pDue) {
            const calculatedDue = this.addWorkingDays(
              pDue,
              dep.lag,
              workingDaysSet,
            );
            if (
              !successor.dueDate ||
              successor.dueDate.getTime() !== calculatedDue.getTime()
            ) {
              targetDueDate = calculatedDue;
              if (duration !== null && targetStartDate) {
                targetStartDate = this.addWorkingDays(
                  targetDueDate,
                  -duration,
                  workingDaysSet,
                );
              }
              datesModified = true;
            }
          }
          break;
        }
        case DependencyType.START_TO_FINISH: {
          if (pStart) {
            const calculatedDue = this.addWorkingDays(
              pStart,
              dep.lag,
              workingDaysSet,
            );
            if (
              !successor.dueDate ||
              successor.dueDate.getTime() !== calculatedDue.getTime()
            ) {
              targetDueDate = calculatedDue;
              if (duration !== null && targetStartDate) {
                targetStartDate = this.addWorkingDays(
                  targetDueDate,
                  -duration,
                  workingDaysSet,
                );
              }
              datesModified = true;
            }
          }
          break;
        }
      }

      if (datesModified) {
        if (
          targetStartDate &&
          targetDueDate &&
          targetStartDate > targetDueDate
        ) {
          targetDueDate = targetStartDate;
        }

        await tx.task.update({
          where: { id: successor.id },
          data: {
            startDate: targetStartDate,
            dueDate: targetDueDate,
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: successor.id,
            userId: changedTask.reporterId || successor.reporterId || 'SYSTEM',
            action: 'SCHEDULE_AUTO_ADJUSTED',
            oldValue: JSON.stringify({
              startDate: successor.startDate,
              dueDate: successor.dueDate,
            }),
            newValue: JSON.stringify({
              startDate: targetStartDate,
              dueDate: targetDueDate,
              triggeredByPredecessorId: changedTaskId,
              dependencyType: dep.type,
              lag: dep.lag,
            }),
          },
        });

        // Recursively cascade downstream
        await this.cascadeDependentTaskDates(tx, successor.id, visited);
      }
    }
  }

  private async notifySuccessorsOnPredecessorDone(
    organizationId: string,
    userId: string,
    taskId: string,
    taskNumber: number,
    taskTitle: string,
    projectId: string,
    projectCode: string,
  ) {
    const successorDeps = await this.prisma.taskDependency.findMany({
      where: { predecessorId: taskId },
      include: {
        successor: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            assigneeId: true,
          },
        },
      },
    });

    for (const dep of successorDeps) {
      if (dep.successor.assigneeId && dep.successor.assigneeId !== userId) {
        await this.notificationService.createNotification({
          type: NotificationType.TASK_DEPENDENCY_COMPLETED,
          title: 'Prerequisite Task Completed',
          message: `Prerequisite task [${projectCode}-${taskNumber}: ${taskTitle}] has been completed. You can now proceed with [${projectCode}-${dep.successor.taskNumber}: ${dep.successor.title}].`,
          userId: dep.successor.assigneeId,
          actionUrl: `/projects/${projectId}/tasks/${dep.successor.id}`,
          triggeredById: userId,
          projectId,
          taskId: dep.successor.id,
          organizationId,
          metadata: {
            predecessorTaskNumber: taskNumber,
            predecessorTitle: taskTitle,
            successorTaskNumber: dep.successor.taskNumber,
            successorTitle: dep.successor.title,
          },
        });
      }
    }
  }

  async createDependency(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: CreateTaskDependencyDto,
  ) {
    const predecessorId = dto.predecessorId || taskId;
    const successorId = dto.successorId || taskId;

    if (predecessorId === successorId) {
      throw new BadRequestException(
        'A task cannot have a dependency on itself',
      );
    }

    const [predecessor, successor] = await Promise.all([
      this.prisma.task.findFirst({
        where: { id: predecessorId, organizationId, deletedAt: null },
        include: { project: true },
      }),
      this.prisma.task.findFirst({
        where: { id: successorId, organizationId, deletedAt: null },
        include: { project: true },
      }),
    ]);

    if (!predecessor) {
      throw new NotFoundException('Predecessor task not found');
    }
    if (!successor) {
      throw new NotFoundException('Successor task not found');
    }
    if (predecessor.projectId !== successor.projectId) {
      throw new BadRequestException(
        'Tasks must belong to the same project to establish dependencies',
      );
    }

    const projectId = predecessor.projectId;

    // Validate cycle
    await this.validateCircularDependency(
      projectId,
      predecessorId,
      successorId,
    );

    // Check duplicate
    const existing = await this.prisma.taskDependency.findUnique({
      where: {
        predecessorId_successorId: { predecessorId, successorId },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A dependency already exists between these two tasks',
      );
    }

    const depType = dto.type || DependencyType.FINISH_TO_START;
    const lag = dto.lag !== undefined ? dto.lag : 0;
    const linkType = dto.linkType || DependencyLinkType.HARD;

    const dependency = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskDependency.create({
        data: {
          organizationId,
          projectId,
          predecessorId,
          successorId,
          type: depType,
          lag,
          linkType,
        },
        include: {
          predecessor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              priority: true,
              startDate: true,
              dueDate: true,
            },
          },
          successor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              priority: true,
              startDate: true,
              dueDate: true,
              assigneeId: true,
            },
          },
        },
      });

      // Log activities on both tasks
      await tx.taskActivity.create({
        data: {
          taskId: successorId,
          userId,
          action: 'DEPENDENCY_ADDED',
          newValue: JSON.stringify({
            role: 'SUCCESSOR',
            predecessorId,
            predecessorNumber: predecessor.taskNumber,
            predecessorTitle: predecessor.title,
            type: depType,
            lag,
            linkType,
          }),
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: predecessorId,
          userId,
          action: 'DEPENDENCY_ADDED',
          newValue: JSON.stringify({
            role: 'PREDECESSOR',
            successorId,
            successorNumber: successor.taskNumber,
            successorTitle: successor.title,
            type: depType,
            lag,
            linkType,
          }),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TaskDependency',
          entityId: created.id,
          action: 'DEPENDENCY_CREATED',
          projectId,
          taskId: successorId,
          newValue: JSON.stringify(created),
        },
      });

      // If hard link, cascade date recalculation immediately
      if (linkType === DependencyLinkType.HARD) {
        await this.cascadeDependentTaskDates(tx, predecessorId);
      }

      return created;
    });

    // Notify successor assignee
    if (successor.assigneeId && successor.assigneeId !== userId) {
      await this.notificationService.createNotification({
        type: NotificationType.SYSTEM,
        title: 'Task Dependency Added',
        message: `A dependency was set on task [${predecessor.project.projectCode}-${successor.taskNumber}]: depends on [${predecessor.project.projectCode}-${predecessor.taskNumber}: ${predecessor.title}] (${depType}${lag !== 0 ? ` with lag ${lag}d` : ''}).`,
        userId: successor.assigneeId,
        actionUrl: `/projects/${projectId}/tasks/${successorId}`,
        triggeredById: userId,
        projectId,
        taskId: successorId,
        organizationId,
        metadata: {
          predecessorNumber: predecessor.taskNumber,
          predecessorTitle: predecessor.title,
          successorNumber: successor.taskNumber,
          successorTitle: successor.title,
          type: depType,
          lag,
        },
      });
    }

    return dependency;
  }

  async getTaskDependencies(
    organizationId: string,
    userId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: {
        project: {
          include: {
            members: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.visibility === 'PRIVATE') {
      const isMember = task.project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const [predecessors, successors] = await Promise.all([
      this.prisma.taskDependency.findMany({
        where: { successorId: taskId, organizationId },
        include: {
          predecessor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              priority: true,
              type: true,
              progress: true,
              startDate: true,
              dueDate: true,
              assignee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.taskDependency.findMany({
        where: { predecessorId: taskId, organizationId },
        include: {
          successor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              priority: true,
              type: true,
              progress: true,
              startDate: true,
              dueDate: true,
              assignee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      taskId,
      predecessors,
      successors,
    };
  }

  async getProjectDependencies(
    organizationId: string,
    userId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility === 'PRIVATE') {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    return this.prisma.taskDependency.findMany({
      where: { projectId, organizationId },
      include: {
        predecessor: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            startDate: true,
            dueDate: true,
            progress: true,
          },
        },
        successor: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            startDate: true,
            dueDate: true,
            progress: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateDependency(
    organizationId: string,
    userId: string,
    dependencyId: string,
    dto: UpdateTaskDependencyDto,
  ) {
    const dependency = await this.prisma.taskDependency.findFirst({
      where: { id: dependencyId, organizationId },
      include: { predecessor: true, successor: true },
    });

    if (!dependency) {
      throw new NotFoundException('Task dependency not found');
    }

    const oldSnapshot = {
      type: dependency.type,
      lag: dependency.lag,
      linkType: dependency.linkType,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.taskDependency.update({
        where: { id: dependencyId },
        data: {
          type: dto.type !== undefined ? dto.type : dependency.type,
          lag: dto.lag !== undefined ? dto.lag : dependency.lag,
          linkType:
            dto.linkType !== undefined ? dto.linkType : dependency.linkType,
        },
        include: {
          predecessor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              startDate: true,
              dueDate: true,
            },
          },
          successor: {
            select: {
              id: true,
              taskNumber: true,
              title: true,
              status: true,
              startDate: true,
              dueDate: true,
            },
          },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: dependency.successorId,
          userId,
          action: 'DEPENDENCY_UPDATED',
          oldValue: JSON.stringify(oldSnapshot),
          newValue: JSON.stringify(res),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TaskDependency',
          entityId: dependencyId,
          action: 'DEPENDENCY_UPDATED',
          projectId: dependency.projectId,
          taskId: dependency.successorId,
          oldValue: JSON.stringify(oldSnapshot),
          newValue: JSON.stringify(res),
        },
      });

      if (res.linkType === 'HARD') {
        await this.cascadeDependentTaskDates(tx, dependency.predecessorId);
      }

      return res;
    });

    return updated;
  }

  async deleteDependency(
    organizationId: string,
    userId: string,
    dependencyId: string,
  ) {
    const dependency = await this.prisma.taskDependency.findFirst({
      where: { id: dependencyId, organizationId },
      include: {
        predecessor: { select: { id: true, taskNumber: true, title: true } },
        successor: { select: { id: true, taskNumber: true, title: true } },
      },
    });

    if (!dependency) {
      throw new NotFoundException('Task dependency not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.taskDependency.delete({
        where: { id: dependencyId },
      });

      await tx.taskActivity.create({
        data: {
          taskId: dependency.successorId,
          userId,
          action: 'DEPENDENCY_REMOVED',
          oldValue: JSON.stringify({
            predecessorNumber: dependency.predecessor.taskNumber,
            predecessorTitle: dependency.predecessor.title,
            type: dependency.type,
            lag: dependency.lag,
          }),
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: dependency.predecessorId,
          userId,
          action: 'DEPENDENCY_REMOVED',
          oldValue: JSON.stringify({
            successorNumber: dependency.successor.taskNumber,
            successorTitle: dependency.successor.title,
            type: dependency.type,
            lag: dependency.lag,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TaskDependency',
          entityId: dependencyId,
          action: 'DEPENDENCY_DELETED',
          projectId: dependency.projectId,
          taskId: dependency.successorId,
          oldValue: JSON.stringify(dependency),
        },
      });
    });

    return {
      message: 'Task dependency removed successfully',
      id: dependencyId,
    };
  }
}
