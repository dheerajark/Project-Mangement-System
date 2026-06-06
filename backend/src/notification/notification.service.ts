import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationType } from '@prisma/client';
import { EventEmitter } from 'events';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    @Inject('NOTIFICATION_EVENT_EMITTER') private eventEmitter: EventEmitter,
  ) {}

  private isNotificationEnabled(type: NotificationType, pref: any): boolean {
    if (!pref) return true; // Default to true if preferences are not configured yet
    switch (type) {
      case NotificationType.TASK_ASSIGNMENT:
        return pref.taskAssignment;
      case NotificationType.TASK_COMMENT:
        return pref.taskComment;
      case NotificationType.ISSUE_ASSIGNMENT:
        return pref.issueAssignment;
      case NotificationType.ISSUE_COMMENT:
        return pref.issueComment;
      case NotificationType.ISSUE_RESOLVED:
        return pref.issueAssignment; // Map issue resolution to issue settings
      case NotificationType.MILESTONE_UPDATE:
        return pref.milestoneUpdate;
      case NotificationType.TIMESHEET_SUBMITTED:
        return pref.timesheetSubmitted;
      case NotificationType.TIMESHEET_APPROVED:
        return pref.timesheetApproved;
      case NotificationType.TIMESHEET_REJECTED:
        return pref.timesheetRejected;
      case NotificationType.SYSTEM:
        return true;
      default:
        return true;
    }
  }

  async createNotification(dto: CreateNotificationDto) {
    // 1. Fetch user preference
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: dto.userId },
    });

    // 2. Check if enabled
    if (!this.isNotificationEnabled(dto.type, pref)) {
      return null;
    }

    // 3. Save to DB
    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionUrl: dto.actionUrl,
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        userId: dto.userId,
        triggeredById: dto.triggeredById,
        projectId: dto.projectId,
        taskId: dto.taskId,
        issueId: dto.issueId,
        organizationId: dto.organizationId,
      },
      include: {
        triggeredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // 4. Emit event for decoupled real-time delivery
    this.eventEmitter.emit('notification.created', notification);

    return notification;
  }

  async createNotificationsBulk(dtos: CreateNotificationDto[]) {
    if (dtos.length === 0) return [];

    const userIds = Array.from(new Set(dtos.map((d) => d.userId)));
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });

    const prefMap = new Map(preferences.map((p) => [p.userId, p]));

    // Filter by user preferences
    const enabledDtos = dtos.filter((dto) => {
      const pref = prefMap.get(dto.userId);
      return this.isNotificationEnabled(dto.type, pref);
    });

    if (enabledDtos.length === 0) return [];

    // Create in a single Prisma transaction to maintain consistency
    // and retrieve the complete records (with generated IDs) for socket emission
    const createdNotifications = await this.prisma.$transaction(
      enabledDtos.map((dto) =>
        this.prisma.notification.create({
          data: {
            type: dto.type,
            title: dto.title,
            message: dto.message,
            actionUrl: dto.actionUrl,
            metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
            userId: dto.userId,
            triggeredById: dto.triggeredById,
            projectId: dto.projectId,
            taskId: dto.taskId,
            issueId: dto.issueId,
            organizationId: dto.organizationId,
          },
          include: {
            triggeredBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
      ),
    );

    // Emit event for each created notification
    for (const notification of createdNotifications) {
      this.eventEmitter.emit('notification.created', notification);
    }

    return createdNotifications;
  }

  async getUserNotifications(userId: string, orgId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        triggeredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAsRead(notificationId: string, userId: string, orgId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string, orgId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId: orgId,
        isRead: false,
        deletedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async archiveNotification(notificationId: string, userId: string, orgId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        organizationId: orgId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async getPreferences(userId: string, orgId: string) {
    let preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      preference = await this.prisma.notificationPreference.create({
        data: {
          userId,
        },
      });
    }

    return preference;
  }

  async updatePreferences(userId: string, orgId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: {
        userId,
        ...dto,
      },
    });
  }
}
