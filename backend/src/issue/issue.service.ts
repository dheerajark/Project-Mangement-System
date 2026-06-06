import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateIssueCommentDto } from './dto/create-issue-comment.dto';
import { IssueStatus, NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

const ISSUE_INCLUDE = {
  assignee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  reporter: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  task: {
    select: { id: true, title: true, taskNumber: true },
  },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  activities: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  project: {
    select: { id: true, name: true, projectCode: true },
  },
};

@Injectable()
export class IssueService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async createIssue(
    orgId: string,
    userId: string,
    projectId: string,
    dto: CreateIssueDto,
  ) {
    const issue = await this.prisma.$transaction(async (tx) => {
      // Verify project belongs to org
      const project = await tx.project.findFirst({
        where: { id: projectId, organizationId: orgId, deletedAt: null },
      });
      if (!project) throw new NotFoundException('Project not found');

      // Atomically increment nextIssueNumber
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { nextIssueNumber: { increment: 1 } },
        select: { nextIssueNumber: true },
      });
      const issueNumber = updated.nextIssueNumber - 1;

      const issue = await tx.issue.create({
        data: {
          title: dto.title,
          description: dto.description,
          issueNumber,
          type: dto.type,
          priority: dto.priority,
          severity: dto.severity,
          environment: dto.environment,
          reproductionSteps: dto.reproductionSteps,
          projectId,
          organizationId: orgId,
          reporterId: userId,
          assigneeId: dto.assigneeId,
          taskId: dto.taskId,
        },
        include: ISSUE_INCLUDE,
      });

      await tx.issueActivity.create({
        data: {
          issueId: issue.id,
          userId,
          action: 'ISSUE_CREATED',
          newValue: JSON.stringify({
            title: issue.title,
            issueNumber: issue.issueNumber,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          entityType: 'Issue',
          entityId: issue.id,
          action: 'CREATE',
          newValue: JSON.stringify({ title: issue.title }),
          projectId,
        },
      });

      return issue;
    });

    if (issue.assigneeId && issue.assigneeId !== userId) {
      await this.notificationService.createNotification({
        type: NotificationType.ISSUE_ASSIGNMENT,
        title: 'New Issue Assigned',
        message: `You have been assigned issue [${issue.project.projectCode}-ISSUE-${issue.issueNumber}]: ${issue.title}`,
        userId: issue.assigneeId,
        actionUrl: `/projects/${issue.projectId}/issues/${issue.id}`,
        triggeredById: userId,
        projectId: issue.projectId,
        issueId: issue.id,
        organizationId: orgId,
        metadata: {
          projectCode: issue.project.projectCode,
          issueNumber: issue.issueNumber,
        },
      });
    }

    return issue;
  }

  async getProjectIssues(
    orgId: string,
    projectId: string,
    filters?: {
      status?: IssueStatus;
      severity?: string;
      assigneeId?: string;
      type?: string;
    },
  ) {
    const where: any = {
      projectId,
      organizationId: orgId,
      deletedAt: null,
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.type) where.type = filters.type;

    return this.prisma.issue.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        task: {
          select: { id: true, title: true, taskNumber: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getIssueById(orgId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId, deletedAt: null },
      include: ISSUE_INCLUDE,
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async updateIssue(
    orgId: string,
    userId: string,
    issueId: string,
    dto: UpdateIssueDto,
  ) {
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Issue not found');

    return this.prisma.$transaction(async (tx) => {
      const activities: Array<{
        issueId: string;
        userId: string;
        action: string;
        oldValue?: string;
        newValue?: string;
      }> = [];

      // Track status change
      if (dto.status && dto.status !== existing.status) {
        activities.push({
          issueId,
          userId,
          action: 'STATUS_CHANGED',
          oldValue: existing.status,
          newValue: dto.status,
        });
      }

      // Track priority change
      if (dto.priority && dto.priority !== existing.priority) {
        activities.push({
          issueId,
          userId,
          action: 'PRIORITY_CHANGED',
          oldValue: existing.priority,
          newValue: dto.priority,
        });
      }

      // Track severity change
      if (dto.severity && dto.severity !== existing.severity) {
        activities.push({
          issueId,
          userId,
          action: 'SEVERITY_CHANGED',
          oldValue: existing.severity,
          newValue: dto.severity,
        });
      }

      // Track assignee change
      if (dto.assigneeId !== undefined && dto.assigneeId !== existing.assigneeId) {
        activities.push({
          issueId,
          userId,
          action: 'ASSIGNEE_CHANGED',
          oldValue: existing.assigneeId ?? undefined,
          newValue: dto.assigneeId ?? undefined,
        });
      }

      // Track type change
      if (dto.type && dto.type !== existing.type) {
        activities.push({
          issueId,
          userId,
          action: 'TYPE_CHANGED',
          oldValue: existing.type,
          newValue: dto.type,
        });
      }

      // Determine resolvedAt timestamp
      let resolvedAt = existing.resolvedAt;
      if (
        dto.status === 'RESOLVED' ||
        dto.status === 'CLOSED'
      ) {
        resolvedAt = resolvedAt ?? new Date();
      } else if (dto.status === 'REOPENED') {
        resolvedAt = null;
      }

      const issue = await tx.issue.update({
        where: { id: issueId },
        data: {
          ...(dto.title && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.type && { type: dto.type }),
          ...(dto.status && { status: dto.status }),
          ...(dto.priority && { priority: dto.priority }),
          ...(dto.severity && { severity: dto.severity }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.taskId !== undefined && { taskId: dto.taskId }),
          ...(dto.environment !== undefined && { environment: dto.environment }),
          ...(dto.reproductionSteps !== undefined && {
            reproductionSteps: dto.reproductionSteps,
          }),
          ...(dto.resolutionNotes !== undefined && {
            resolutionNotes: dto.resolutionNotes,
          }),
          resolvedAt,
        },
        include: ISSUE_INCLUDE,
      });

      if (activities.length > 0) {
        await tx.issueActivity.createMany({ data: activities });
      }

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          entityType: 'Issue',
          entityId: issueId,
          action: 'UPDATE',
          oldValue: JSON.stringify({ status: existing.status }),
          newValue: JSON.stringify({ status: issue.status }),
          projectId: existing.projectId,
        },
      });

      return issue;
    });
  }

  async archiveIssue(orgId: string, userId: string, issueId: string) {
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Issue not found');

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.update({
        where: { id: issueId },
        data: { deletedAt: new Date() },
      });

      await tx.issueActivity.create({
        data: {
          issueId,
          userId,
          action: 'ISSUE_ARCHIVED',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          entityType: 'Issue',
          entityId: issueId,
          action: 'ARCHIVE',
          projectId: existing.projectId,
        },
      });

      return issue;
    });
  }

  async addComment(
    orgId: string,
    userId: string,
    issueId: string,
    dto: CreateIssueCommentDto,
  ) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId, deletedAt: null },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const comment = await this.prisma.$transaction(async (tx) => {
      const createdComment = await tx.issueComment.create({
        data: {
          issueId,
          userId,
          content: dto.content,
          organizationId: orgId,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      await tx.issueActivity.create({
        data: {
          issueId,
          userId,
          action: 'COMMENT_ADDED',
          newValue: JSON.stringify({ commentId: createdComment.id }),
        },
      });

      return createdComment;
    });

    const notifyUserIds = new Set<string>();
    if (issue!.assigneeId && issue!.assigneeId !== userId) {
      notifyUserIds.add(issue!.assigneeId);
    }
    if (issue!.reporterId && issue!.reporterId !== userId) {
      notifyUserIds.add(issue!.reporterId);
    }

    if (notifyUserIds.size > 0) {
      const [project, commenter] = await Promise.all([
        this.prisma.project.findUnique({
          where: { id: issue!.projectId },
          select: { projectCode: true },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        }),
      ]);
      const commenterName = commenter ? `${commenter.firstName || ''} ${commenter.lastName || ''}`.trim() : 'Someone';
      const cleanContent = comment.content.length > 50 ? `${comment.content.substring(0, 50)}...` : comment.content;
      const projectCode = project ? project.projectCode : 'PROJ';

      const notifications = Array.from(notifyUserIds).map((recipientId) => ({
        type: NotificationType.ISSUE_COMMENT,
        title: 'New Comment on Issue',
        message: `${commenterName} commented on issue [${projectCode}-ISSUE-${issue!.issueNumber}]: "${cleanContent}"`,
        userId: recipientId,
        actionUrl: `/projects/${issue!.projectId}/issues/${issue!.id}`,
        triggeredById: userId,
        projectId: issue!.projectId,
        issueId: issue!.id,
        organizationId: orgId,
        metadata: {
          projectCode,
          issueNumber: issue!.issueNumber,
        },
      }));
      await this.notificationService.createNotificationsBulk(notifications);
    }

    return comment;
  }

  async getAssignedIssues(orgId: string, userId: string) {
    return this.prisma.issue.findMany({
      where: {
        organizationId: orgId,
        assigneeId: userId,
        deletedAt: null,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] },
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIssueStats(orgId: string, projectId: string) {
    const [open, resolved, critical, high, total] = await Promise.all([
      this.prisma.issue.count({
        where: {
          projectId,
          organizationId: orgId,
          deletedAt: null,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] },
        },
      }),
      this.prisma.issue.count({
        where: {
          projectId,
          organizationId: orgId,
          deletedAt: null,
          status: { in: ['RESOLVED', 'CLOSED'] },
        },
      }),
      this.prisma.issue.count({
        where: {
          projectId,
          organizationId: orgId,
          deletedAt: null,
          severity: 'CRITICAL',
        },
      }),
      this.prisma.issue.count({
        where: {
          projectId,
          organizationId: orgId,
          deletedAt: null,
          severity: 'HIGH',
        },
      }),
      this.prisma.issue.count({
        where: { projectId, organizationId: orgId, deletedAt: null },
      }),
    ]);

    return { open, resolved, critical, high, total };
  }
}
