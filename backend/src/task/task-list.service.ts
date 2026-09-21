import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { CreateTaskListCommentDto } from './dto/create-task-list-comment.dto';
import { UpdateTaskListCommentDto } from './dto/update-task-list-comment.dto';
import { TaskListFlag, TaskListStatus, NotificationType } from '@prisma/client';
import { isClientUser } from '../common/utils/client-detection.util';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TaskListService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async getTaskListsForProject(
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

    const isClient = await isClientUser(this.prisma, userId, projectId);

    const whereClause: any = {
      projectId,
      organizationId,
      deletedAt: null,
    };

    if (isClient) {
      whereClause.flag = TaskListFlag.EXTERNAL;
    }

    const taskLists = await this.prisma.taskList.findMany({
      where: whereClause,
      include: {
        milestone: {
          select: { id: true, title: true, status: true, flag: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            parentTaskId: true,
          },
        },
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    return taskLists.map((tl) => {
      const rootTasks = tl.tasks.filter((t) => !t.parentTaskId);
      const totalTasks = tl.tasks.length;
      const completedTasks = tl.tasks.filter((t) => t.status === 'DONE').length;
      const progress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...tl,
        totalTasks,
        completedTasks,
        progress,
      };
    });
  }

  async getTaskListById(organizationId: string, userId: string, id: string) {
    const taskList = await this.prisma.taskList.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        project: true,
        milestone: true,
        tasks: {
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
      },
    });

    if (!taskList) {
      throw new NotFoundException('Task list not found');
    }

    const isClient = await isClientUser(
      this.prisma,
      userId,
      taskList.projectId,
    );
    if (isClient && taskList.flag === TaskListFlag.INTERNAL) {
      throw new ForbiddenException('Access denied: Internal task list');
    }

    return taskList;
  }

  async createTaskList(
    organizationId: string,
    userId: string,
    projectId: string,
    dto: CreateTaskListDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      include: { members: { where: { deletedAt: null } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify task lists in an archived project',
      );
    }

    const isClient = await isClientUser(this.prisma, userId, projectId);
    if (isClient) {
      throw new ForbiddenException('Client users cannot create task lists');
    }

    let effectiveFlag = dto.flag || TaskListFlag.INTERNAL;
    if (dto.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId, deletedAt: null },
      });
      if (!milestone) {
        throw new NotFoundException(
          'Specified milestone was not found in this project',
        );
      }
      // In Zoho Projects, milestone flag dictates task list flag
      effectiveFlag =
        milestone.flag === 'EXTERNAL'
          ? TaskListFlag.EXTERNAL
          : TaskListFlag.INTERNAL;
    }

    const currentCount = await this.prisma.taskList.count({
      where: { projectId, deletedAt: null },
    });
    const position = dto.position !== undefined ? dto.position : currentCount;

    const taskList = await this.prisma.taskList.create({
      data: {
        name: dto.name,
        description: dto.description,
        flag: effectiveFlag,
        status: dto.status || TaskListStatus.ACTIVE,
        position,
        projectId,
        organizationId,
        milestoneId: dto.milestoneId || null,
      },
      include: {
        milestone: {
          select: { id: true, title: true, status: true, flag: true },
        },
      },
    });

    // Log Activity
    await this.prisma.projectActivity.create({
      data: {
        projectId,
        organizationId,
        userId,
        action: 'TASK_LIST_CREATED',
        newValue: JSON.stringify({ id: taskList.id, name: taskList.name }),
      },
    });

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskList',
        entityId: taskList.id,
        action: 'TASK_LIST_CREATED',
        projectId,
        newValue: JSON.stringify(taskList),
      },
    });

    return taskList;
  }

  async updateTaskList(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateTaskListDto,
  ) {
    const existing = await this.prisma.taskList.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { project: true },
    });

    if (!existing) {
      throw new NotFoundException('Task list not found');
    }

    if (existing.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify task lists in an archived project',
      );
    }

    const isClient = await isClientUser(
      this.prisma,
      userId,
      existing.projectId,
    );
    if (isClient) {
      throw new ForbiddenException('Client users cannot modify task lists');
    }

    const isMovingProject = !!(
      dto.targetProjectId && dto.targetProjectId !== existing.projectId
    );
    let targetProject: any = null;

    if (isMovingProject) {
      targetProject = await this.prisma.project.findFirst({
        where: { id: dto.targetProjectId, organizationId, deletedAt: null },
        include: { members: { where: { deletedAt: null } } },
      });
      if (!targetProject) {
        throw new NotFoundException('Target project not found');
      }
      if (targetProject.status === 'ARCHIVED') {
        throw new ForbiddenException(
          'Cannot move task list to an archived project',
        );
      }
      const isClientTarget = await isClientUser(
        this.prisma,
        userId,
        dto.targetProjectId,
      );
      if (isClientTarget) {
        throw new ForbiddenException(
          'Client users cannot move task lists into target project',
        );
      }
    }

    let targetMilestone: any = null;
    if (!isMovingProject && dto.milestoneId) {
      targetMilestone = await this.prisma.milestone.findFirst({
        where: {
          id: dto.milestoneId,
          projectId: existing.projectId,
          deletedAt: null,
        },
      });
      if (!targetMilestone) {
        throw new NotFoundException(
          'Specified milestone was not found in this project',
        );
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.flag !== undefined) updateData.flag = dto.flag;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.position !== undefined) updateData.position = dto.position;

    if (isMovingProject) {
      updateData.projectId = dto.targetProjectId;
      updateData.milestoneId = null;
      const targetCount = await this.prisma.taskList.count({
        where: { projectId: dto.targetProjectId, deletedAt: null },
      });
      updateData.position = targetCount;
    } else {
      if (dto.milestoneId !== undefined)
        updateData.milestoneId = dto.milestoneId;
      // Inherit milestone flag when tied to a milestone
      if (targetMilestone) {
        updateData.flag =
          targetMilestone.flag === 'EXTERNAL'
            ? TaskListFlag.EXTERNAL
            : TaskListFlag.INTERNAL;
      }
    }

    const milestoneChanged =
      !isMovingProject &&
      dto.milestoneId !== undefined &&
      dto.milestoneId !== existing.milestoneId;
    const targetMilestoneId = dto.milestoneId || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const taskList = await tx.taskList.update({
        where: { id },
        data: updateData,
        include: {
          milestone: {
            select: { id: true, title: true, status: true, flag: true },
          },
        },
      });

      if (isMovingProject) {
        // Move all active tasks to target project
        const tasksInList = await tx.task.findMany({
          where: { taskListId: id, deletedAt: null },
          select: { id: true, assigneeId: true },
        });

        const targetMemberIds = new Set(
          targetProject.members.map((m: any) => m.userId),
        );
        let nextNum = targetProject.nextTaskNumber;

        for (const t of tasksInList) {
          const keepAssignee =
            t.assigneeId && targetMemberIds.has(t.assigneeId)
              ? t.assigneeId
              : null;
          await tx.task.update({
            where: { id: t.id },
            data: {
              projectId: dto.targetProjectId!,
              milestoneId: null,
              taskNumber: nextNum++,
              assigneeId: keepAssignee,
            },
          });
        }

        await tx.project.update({
          where: { id: dto.targetProjectId! },
          data: { nextTaskNumber: nextNum },
        });

        // Project activities for both projects
        await tx.projectActivity.create({
          data: {
            projectId: existing.projectId,
            organizationId,
            userId,
            action: 'TASK_LIST_MOVED_PROJECT',
            oldValue: JSON.stringify({
              projectId: existing.projectId,
              name: existing.name,
            }),
            newValue: JSON.stringify({
              targetProjectId: dto.targetProjectId,
              taskListId: id,
            }),
          },
        });

        await tx.projectActivity.create({
          data: {
            projectId: dto.targetProjectId!,
            organizationId,
            userId,
            action: 'TASK_LIST_MOVED_PROJECT',
            oldValue: JSON.stringify({ sourceProjectId: existing.projectId }),
            newValue: JSON.stringify({
              projectId: dto.targetProjectId,
              taskListId: id,
              name: existing.name,
            }),
          },
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            entityType: 'TaskList',
            entityId: id,
            action: 'TASK_LIST_MOVED_PROJECT',
            projectId: dto.targetProjectId!,
            oldValue: JSON.stringify(existing),
            newValue: JSON.stringify(taskList),
          },
        });
      }

      // If completing the task list, handle remaining open tasks according to user selection
      if (dto.status === TaskListStatus.COMPLETED) {
        if (dto.resolveOpenTasks === 'MARK_DONE') {
          await tx.task.updateMany({
            where: { taskListId: id, status: { not: 'DONE' }, deletedAt: null },
            data: { status: 'DONE' },
          });
        } else if (dto.resolveOpenTasks === 'MOVE') {
          if (dto.targetTaskListId) {
            const targetList = await tx.taskList.findFirst({
              where: {
                id: dto.targetTaskListId,
                projectId: existing.projectId,
                deletedAt: null,
              },
            });
            if (!targetList) {
              throw new NotFoundException(
                'Target task list for moving open tasks was not found',
              );
            }
          }
          await tx.task.updateMany({
            where: { taskListId: id, status: { not: 'DONE' }, deletedAt: null },
            data: { taskListId: dto.targetTaskListId || null },
          });
        } else if (dto.resolveOpenTasks === 'DELETE') {
          await tx.task.updateMany({
            where: { taskListId: id, status: { not: 'DONE' }, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        }
      }

      // If milestone association was changed, cascade to all active tasks in this task list
      if (milestoneChanged) {
        await tx.task.updateMany({
          where: { taskListId: id, deletedAt: null },
          data: { milestoneId: targetMilestoneId },
        });

        // Log ProjectActivity for moving task list between milestones
        await tx.projectActivity.create({
          data: {
            projectId: existing.projectId,
            organizationId,
            userId,
            milestoneId: targetMilestoneId,
            action: targetMilestoneId
              ? 'TASK_LIST_MOVED_MILESTONE'
              : 'TASK_LIST_DISSOCIATED_MILESTONE',
            oldValue: JSON.stringify({ milestoneId: existing.milestoneId }),
            newValue: JSON.stringify({
              milestoneId: targetMilestoneId,
              taskListId: id,
            }),
          },
        });
      }

      const isStatusChanged =
        dto.status !== undefined && dto.status !== existing.status;
      let action = 'TASK_LIST_UPDATED';
      if (milestoneChanged) {
        action = 'TASK_LIST_MOVED_MILESTONE';
      } else if (isStatusChanged) {
        action =
          dto.status === TaskListStatus.COMPLETED
            ? 'TASK_LIST_COMPLETED'
            : 'TASK_LIST_REOPENED';
      }

      // Log General / Status Project Activity
      await tx.projectActivity.create({
        data: {
          projectId: existing.projectId,
          organizationId,
          userId,
          action,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(taskList),
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TaskList',
          entityId: id,
          action,
          projectId: existing.projectId,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(taskList),
        },
      });

      return taskList;
    });

    return updated;
  }

  async deleteTaskList(
    organizationId: string,
    userId: string,
    id: string,
    unassignTasks: boolean = true,
  ) {
    const existing = await this.prisma.taskList.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { project: true },
    });

    if (!existing) {
      throw new NotFoundException('Task list not found');
    }

    if (existing.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify task lists in an archived project',
      );
    }

    const isClient = await isClientUser(
      this.prisma,
      userId,
      existing.projectId,
    );
    if (isClient) {
      throw new ForbiddenException('Client users cannot delete task lists');
    }

    if (unassignTasks) {
      // Reassign tasks to general / unassigned (taskListId: null)
      await this.prisma.task.updateMany({
        where: { taskListId: id },
        data: { taskListId: null },
      });
    } else {
      // Soft-delete tasks in this task list
      await this.prisma.task.updateMany({
        where: { taskListId: id },
        data: { deletedAt: new Date() },
      });
    }

    const updated = await this.prisma.taskList.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.projectActivity.create({
      data: {
        projectId: existing.projectId,
        organizationId,
        userId,
        action: 'TASK_LIST_DELETED',
        oldValue: JSON.stringify({ id, name: existing.name }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskList',
        entityId: id,
        action: 'TASK_LIST_DELETED',
        projectId: existing.projectId,
        oldValue: JSON.stringify(existing),
      },
    });

    return { message: 'Task list deleted successfully', id };
  }

  async reorderTaskLists(
    organizationId: string,
    userId: string,
    projectId: string,
    listIds: string[],
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot reorder in an archived project');
    }

    await this.prisma.$transaction(
      listIds.map((id, index) =>
        this.prisma.taskList.updateMany({
          where: { id, projectId, organizationId },
          data: { position: index },
        }),
      ),
    );

    return { success: true };
  }

  private async getTaskListWithAccess(
    organizationId: string,
    userId: string,
    taskListId: string,
    readOnly: boolean = false,
  ) {
    const taskList = await this.prisma.taskList.findFirst({
      where: { id: taskListId, organizationId, deletedAt: null },
      include: {
        project: {
          include: {
            members: { where: { deletedAt: null } },
            settings: true,
          },
        },
        milestone: true,
      },
    });

    if (!taskList) {
      throw new NotFoundException('Task list not found');
    }

    if (!readOnly && taskList.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot modify task lists in an archived project',
      );
    }

    if (taskList.project.visibility === 'PRIVATE') {
      const isMember = taskList.project.members.some(
        (m) => m.userId === userId,
      );
      if (!isMember) {
        throw new ForbiddenException(
          'You do not have access to this private project',
        );
      }
    }

    const isClient = await isClientUser(
      this.prisma,
      userId,
      taskList.projectId,
    );
    if (isClient && taskList.flag === TaskListFlag.INTERNAL) {
      throw new ForbiddenException('Access denied: Internal task list');
    }

    return taskList;
  }

  async createTaskListComment(
    organizationId: string,
    userId: string,
    taskListId: string,
    dto: CreateTaskListCommentDto,
  ) {
    const taskList = await this.getTaskListWithAccess(
      organizationId,
      userId,
      taskListId,
      false,
    );

    const attachmentsJson = dto.attachments && dto.attachments.length > 0
      ? JSON.stringify(dto.attachments)
      : null;

    const comment = await this.prisma.taskListComment.create({
      data: {
        taskListId,
        userId,
        content: dto.content,
        attachments: attachmentsJson,
        organizationId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Log ProjectActivity
    await this.prisma.projectActivity.create({
      data: {
        projectId: taskList.projectId,
        organizationId,
        userId,
        action: 'TASK_LIST_COMMENT_ADDED',
        newValue: JSON.stringify({
          commentId: comment.id,
          content: comment.content,
          taskListName: taskList.name,
        }),
      },
    });

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskListComment',
        entityId: comment.id,
        action: 'TASK_LIST_COMMENT_ADDED',
        projectId: taskList.projectId,
        newValue: JSON.stringify(comment),
      },
    });

    // Handle mentions and send notifications
    if (dto.mentionedUserIds && dto.mentionedUserIds.length > 0) {
      await this.sendMentionNotifications(
        organizationId,
        userId,
        taskList,
        comment,
        dto.mentionedUserIds,
      );
    }

    // Send notification to project members (excluding the commenter)
    await this.sendCommentNotifications(
      organizationId,
      userId,
      taskList,
      comment,
    );

    return comment;
  }

  async getTaskListComments(
    organizationId: string,
    userId: string,
    taskListId: string,
  ) {
    const taskList = await this.getTaskListWithAccess(
      organizationId,
      userId,
      taskListId,
      true,
    );

    const comments = await this.prisma.taskListComment.findMany({
      where: { taskListId, organizationId, deletedAt: null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async updateTaskListComment(
    organizationId: string,
    userId: string,
    commentId: string,
    dto: UpdateTaskListCommentDto,
  ) {
    const comment = await this.prisma.taskListComment.findFirst({
      where: { id: commentId, organizationId, deletedAt: null },
      include: { taskList: { include: { project: true } } },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.taskList.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify comments in an archived project');
    }

    // Check if user owns the comment
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const oldContent = comment.content;
    const updatedComment = await this.prisma.taskListComment.update({
      where: { id: commentId },
      data: { content: dto.content },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Log ProjectActivity
    await this.prisma.projectActivity.create({
      data: {
        projectId: comment.taskList.projectId,
        organizationId,
        userId,
        action: 'TASK_LIST_COMMENT_UPDATED',
        oldValue: oldContent,
        newValue: dto.content,
      },
    });

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskListComment',
        entityId: commentId,
        action: 'TASK_LIST_COMMENT_UPDATED',
        projectId: comment.taskList.projectId,
        oldValue: oldContent,
        newValue: dto.content,
      },
    });

    return updatedComment;
  }

  async deleteTaskListComment(
    organizationId: string,
    userId: string,
    commentId: string,
  ) {
    const comment = await this.prisma.taskListComment.findFirst({
      where: { id: commentId, organizationId, deletedAt: null },
      include: {
        taskList: {
          include: {
            project: {
              include: {
                members: { where: { deletedAt: null, userId } },
              },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.taskList.project.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot modify comments in an archived project');
    }

    // Allow owner or Project Manager / Admin to delete
    const isOwner = comment.userId === userId;
    const userRole = comment.taskList.project.members[0]?.role;
    const isManager = userRole === 'MANAGER';
    
    // Check if user is org admin
    const userAdminRole = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: 'Admin' } },
    });

    if (!isOwner && !isManager && !userAdminRole) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.taskListComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    // Log ProjectActivity
    await this.prisma.projectActivity.create({
      data: {
        projectId: comment.taskList.projectId,
        organizationId,
        userId,
        action: 'TASK_LIST_COMMENT_DELETED',
        oldValue: JSON.stringify({ commentId, content: comment.content }),
      },
    });

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TaskListComment',
        entityId: commentId,
        action: 'TASK_LIST_COMMENT_DELETED',
        projectId: comment.taskList.projectId,
        oldValue: JSON.stringify(comment),
      },
    });

    return { message: 'Comment deleted successfully', id: commentId };
  }

  private async sendCommentNotifications(
    organizationId: string,
    userId: string,
    taskList: any,
    comment: any,
  ) {
    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const commenterName = commenter
      ? `${commenter.firstName} ${commenter.lastName}`.trim()
      : 'Someone';
    const cleanContent =
      comment.content.length > 50
        ? `${comment.content.substring(0, 50)}...`
        : comment.content;

    // Notify project members who have taskListComment notifications enabled
    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: taskList.projectId,
        deletedAt: null,
        userId: { not: userId },
      },
      include: { user: { include: { notificationPreference: true } } },
    });

    const notifications = members
      .filter((m) => m.user.notificationPreference?.taskListComment !== false)
      .map((member) => ({
        type: NotificationType.TASK_LIST_COMMENT,
        title: 'New Comment on Task List',
        message: `${commenterName} commented on task list "${taskList.name}": "${cleanContent}"`,
        userId: member.userId,
        actionUrl: `/projects/${taskList.projectId}?tab=tasks&taskListId=${taskList.id}`,
        triggeredById: userId,
        projectId: taskList.projectId,
        taskListId: taskList.id,
        organizationId,
        metadata: {
          taskListId: taskList.id,
          taskListName: taskList.name,
        },
      }));

    if (notifications.length > 0) {
      await this.notificationService.createNotificationsBulk(notifications);
    }
  }

  private async sendMentionNotifications(
    organizationId: string,
    userId: string,
    taskList: any,
    comment: any,
    mentionedUserIds: string[],
  ) {
    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const commenterName = commenter
      ? `${commenter.firstName} ${commenter.lastName}`.trim()
      : 'Someone';

    const uniqueMentionedIds = [
      ...new Set(mentionedUserIds.filter((id) => id !== userId)),
    ];

    if (uniqueMentionedIds.length === 0) return;

    const mentionedUsers = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueMentionedIds },
        organizationId,
        deletedAt: null,
      },
      include: { notificationPreference: true },
    });

    const notifications = mentionedUsers
      .filter((u) => u.notificationPreference?.taskListComment !== false)
      .map((mentionedUser) => ({
        type: NotificationType.TASK_LIST_COMMENT,
        title: 'You were mentioned in a Task List comment',
        message: `${commenterName} mentioned you in task list "${taskList.name}"`,
        userId: mentionedUser.id,
        actionUrl: `/projects/${taskList.projectId}?tab=tasks&taskListId=${taskList.id}`,
        triggeredById: userId,
        projectId: taskList.projectId,
        taskListId: taskList.id,
        organizationId,
        metadata: {
          taskListId: taskList.id,
          taskListName: taskList.name,
          mention: true,
        },
      }));

    if (notifications.length > 0) {
      await this.notificationService.createNotificationsBulk(notifications);
    }
  }
}
