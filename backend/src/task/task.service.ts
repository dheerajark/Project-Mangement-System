import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateAttachmentMetadataDto } from './dto/create-attachment-metadata.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { TaskStatus, TaskPriority, TaskType, NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async autoTransitionMilestone(tx: any, milestoneId: string, taskStatus: TaskStatus, userId: string, organizationId: string) {
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

  async createTask(organizationId: string, userId: string, dto: CreateTaskDto) {
    // 1. Verify project exists, belongs to tenant, and is active
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot add tasks to an archived project');
    }

    // 2. Project membership and cross-tenant validation for assignee
    if (dto.assigneeId) {
      const assigneeUser = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });

      if (!assigneeUser || assigneeUser.organizationId !== organizationId) {
        throw new ForbiddenException('Assignee must belong to the same organization');
      }

      const isProjectMember = project.members.some((m) => m.userId === dto.assigneeId);
      if (!isProjectMember) {
        throw new ForbiddenException('Assignee must be a project member');
      }
    }

    // Verify milestone exists in this project and is active
    if (dto.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId: dto.projectId, deletedAt: null },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone not found in this project');
      }
    }

    // 3. Sequential generation and creation inside single transaction
    const task = await this.prisma.$transaction(async (tx) => {
      const proj = await tx.project.findUnique({
        where: { id: dto.projectId },
      });

      if (!proj) {
        throw new NotFoundException('Project not found');
      }

      const taskNumber = proj.nextTaskNumber;

      // Increment project sequence counter
      await tx.project.update({
        where: { id: dto.projectId },
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
          estimatedHours: dto.estimatedHours,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          projectId: dto.projectId,
          organizationId,
          assigneeId: dto.assigneeId,
          reporterId: userId,
          milestoneId: dto.milestoneId,
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
        const ms = await tx.milestone.findUnique({ where: { id: dto.milestoneId } });
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId,
            action: 'TASK_LINKED_TO_MILESTONE',
            newValue: JSON.stringify({ milestoneId: dto.milestoneId, title: ms?.title }),
          },
        });

        // Trigger auto transition
        await this.autoTransitionMilestone(tx, dto.milestoneId, task.status, userId, organizationId);
      }

      // Log detailed Audit Entry
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Task',
          entityId: task.id,
          action: 'TASK_CREATED',
          projectId: dto.projectId,
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

    return task;
  }

  async getTasksForProject(organizationId: string, userId: string, projectId: string) {
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
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    return this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
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
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        watchers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        activities: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        labels: {
          include: { label: true },
        },
        milestone: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.visibility === 'PRIVATE') {
      const isMember = task.project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    return task;
  }

  async updateTask(organizationId: string, userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify tasks in an archived project');
    }

    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (dto.assigneeId) {
        const assigneeUser = await this.prisma.user.findUnique({
          where: { id: dto.assigneeId },
        });

        if (!assigneeUser || assigneeUser.organizationId !== organizationId) {
          throw new ForbiddenException('Assignee must belong to the same organization');
        }

        const isProjectMember = task.project.members.some((m) => m.userId === dto.assigneeId);
        if (!isProjectMember) {
          throw new ForbiddenException('Assignee must be a project member');
        }
      }
    }

    if (dto.milestoneId !== undefined && dto.milestoneId !== task.milestoneId) {
      if (dto.milestoneId) {
        const milestone = await this.prisma.milestone.findFirst({
          where: { id: dto.milestoneId, projectId: task.projectId, deletedAt: null },
        });
        if (!milestone) {
          throw new NotFoundException('Milestone not found in this project');
        }
      }
    }

    const oldTaskSnapshot = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      milestoneId: task.milestoneId,
    };

    // Determine fine-grained updates for Activity log
    const activitiesToCreate: any[] = [];
    if (dto.status && dto.status !== task.status) {
      activitiesToCreate.push({ taskId, userId, action: 'STATUS_CHANGED', oldValue: task.status, newValue: dto.status });
    }
    if (dto.priority && dto.priority !== task.priority) {
      activitiesToCreate.push({ taskId, userId, action: 'PRIORITY_CHANGED', oldValue: task.priority, newValue: dto.priority });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      activitiesToCreate.push({ taskId, userId, action: 'ASSIGNEE_CHANGED', oldValue: task.assigneeId, newValue: dto.assigneeId });
    }

    if (dto.milestoneId !== undefined && dto.milestoneId !== task.milestoneId) {
      if (task.milestoneId) {
        const ms = await this.prisma.milestone.findUnique({ where: { id: task.milestoneId } });
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'TASK_UNLINKED_FROM_MILESTONE',
          oldValue: JSON.stringify({ milestoneId: task.milestoneId, title: ms?.title }),
          newValue: null,
        });
      }
      if (dto.milestoneId) {
        const ms = await this.prisma.milestone.findUnique({ where: { id: dto.milestoneId } });
        activitiesToCreate.push({
          taskId,
          userId,
          action: 'TASK_LINKED_TO_MILESTONE',
          oldValue: null,
          newValue: JSON.stringify({ milestoneId: dto.milestoneId, title: ms?.title }),
        });
      }
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          type: dto.type,
          estimatedHours: dto.estimatedHours,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          assigneeId: dto.assigneeId,
          milestoneId: dto.milestoneId,
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

      // Trigger auto transition for milestone
      const finalStatus = dto.status || task.status;
      const finalMilestoneId = dto.milestoneId !== undefined ? dto.milestoneId : task.milestoneId;
      if (finalMilestoneId) {
        await this.autoTransitionMilestone(tx, finalMilestoneId, finalStatus, userId, organizationId);
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

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId && dto.assigneeId !== userId) {
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

    return updatedTask;
  }

  async updateTaskStatus(organizationId: string, userId: string, taskId: string, dto: UpdateTaskStatusDto) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify tasks in an archived project');
    }

    const current = task.status;
    const target = dto.status;

    if (current !== target) {
      // Validate allowed transitions
      const isValidTransition =
        (current === TaskStatus.TODO && target === TaskStatus.IN_PROGRESS) ||
        (current === TaskStatus.IN_PROGRESS && target === TaskStatus.REVIEW) ||
        (current === TaskStatus.REVIEW && target === TaskStatus.DONE) ||
        (target === TaskStatus.BLOCKED);

      if (!isValidTransition) {
        throw new ForbiddenException(`Invalid task status transition from ${current} to ${target}`);
      }

      const updatedTask = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id: taskId },
          data: { status: target },
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

        if (updated.milestoneId) {
          await this.autoTransitionMilestone(tx, updated.milestoneId, target, userId, organizationId);
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

      return updatedTask;
    }

    return task;
  }

  async archiveTask(organizationId: string, userId: string, taskId: string) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify tasks in an archived project');
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

  async createComment(organizationId: string, userId: string, taskId: string, dto: CreateCommentDto) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify tasks in an archived project');
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

    const notifyUserIds = new Set<string>();
    if (task.assigneeId && task.assigneeId !== userId) {
      notifyUserIds.add(task.assigneeId);
    }
    if (task.reporterId && task.reporterId !== userId) {
      notifyUserIds.add(task.reporterId);
    }
    if (task.watchers) {
      for (const watcher of task.watchers) {
        if (watcher.userId !== userId) {
          notifyUserIds.add(watcher.userId);
        }
      }
    }

    if (notifyUserIds.size > 0) {
      const commenter = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const commenterName = commenter ? `${commenter.firstName} ${commenter.lastName}`.trim() : 'Someone';
      const cleanContent = comment.content.length > 50 ? `${comment.content.substring(0, 50)}...` : comment.content;

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

  async createAttachment(organizationId: string, userId: string, taskId: string, dto: CreateAttachmentMetadataDto) {
    const task = await this.getTaskById(organizationId, userId, taskId);

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify tasks in an archived project');
    }

    if (!task.project.settings?.allowFileUploads) {
      throw new ForbiddenException('Document uploads are disabled for this project');
    }

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        uploadedById: userId,
        organizationId,
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

    return attachment;
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

  async getKanbanBoard(organizationId: string, userId: string, projectId: string) {
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
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
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
      orderBy: { position: 'asc' },
    });

    return {
      todo: tasks.filter((t) => t.status === TaskStatus.TODO),
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
      review: tasks.filter((t) => t.status === TaskStatus.REVIEW),
      done: tasks.filter((t) => t.status === TaskStatus.DONE),
      blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED),
    };
  }

  async reorderTask(organizationId: string, userId: string, taskId: string, dto: ReorderTaskDto) {
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

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot reorder tasks in an archived project');
    }

    if (task.project.visibility === 'PRIVATE') {
      const isMember = task.project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('You do not have access to this private project');
      }
    }

    const current = task.status;
    const targetStatus = dto.status || current;

    // State Transition Check
    if (dto.status && current !== targetStatus) {
      const isValidTransition =
        (current === TaskStatus.TODO && targetStatus === TaskStatus.IN_PROGRESS) ||
        (current === TaskStatus.IN_PROGRESS && targetStatus === TaskStatus.REVIEW) ||
        (current === TaskStatus.REVIEW && targetStatus === TaskStatus.DONE) ||
        (targetStatus === TaskStatus.BLOCKED);

      if (!isValidTransition) {
        throw new ForbiddenException(`Invalid task status transition from ${current} to ${targetStatus}`);
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
      const targetIndex = Math.max(0, Math.min(dto.position, targetColumnTasks.length));
      const taskIdList = targetColumnTasks.map((t) => t.id);
      taskIdList.splice(targetIndex, 0, task.id);

      // 3. Re-index target column
      for (let i = 0; i < taskIdList.length; i++) {
        const id = taskIdList[i];
        if (id === task.id) {
          await tx.task.update({
            where: { id },
            data: {
              position: i,
              status: targetStatus,
            },
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
            action: 'TASK_STATUS_CHANGED',
            oldValue: current,
            newValue: targetStatus,
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
            oldValue: current,
            newValue: targetStatus,
          },
        });
      }
    });

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
}
