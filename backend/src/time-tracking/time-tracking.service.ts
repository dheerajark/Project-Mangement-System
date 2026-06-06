import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogManualTimeDto } from './dto/log-manual-time.dto';
import { StartTimerDto } from './dto/start-timer.dto';
import { StopTimerDto } from './dto/stop-timer.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { ApproveTimesheetDto } from './dto/approve-timesheet.dto';
import { NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TimeTrackingService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async logManualTime(organizationId: string, userId: string, dto: LogManualTimeDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId, deletedAt: null },
      include: { settings: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.settings || !project.settings.allowTimeTracking) {
      throw new ForbiddenException('Time tracking is disabled for this project');
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        hours: dto.hours,
        loggedAt: new Date(dto.loggedAt),
        description: dto.description || null,
        billable: dto.billable ?? true,
        source: 'MANUAL',
        projectId: dto.projectId,
        taskId: dto.taskId || null,
        userId,
        organizationId,
      },
    });

    if (dto.taskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: dto.taskId,
          userId,
          action: 'TIME_LOGGED',
          newValue: JSON.stringify({ hours: dto.hours, description: dto.description }),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TimeEntry',
        entityId: entry.id,
        action: 'TIME_LOGGED',
        projectId: dto.projectId,
        taskId: dto.taskId || null,
        newValue: JSON.stringify(entry),
      },
    });

    return entry;
  }

  async startTimer(organizationId: string, userId: string, dto: StartTimerDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId, deletedAt: null },
      include: { settings: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.settings || !project.settings.allowTimeTracking) {
      throw new ForbiddenException('Time tracking is disabled for this project');
    }

    // Active Timer Protection
    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: { userId, isTimerRunning: true, deletedAt: null },
    });

    if (activeTimer) {
      const now = new Date();
      const startedAt = activeTimer.timerStartedAt || activeTimer.createdAt;
      const durationMs = now.getTime() - startedAt.getTime();
      const durationHours = Math.max(0.01, parseFloat((durationMs / (1000 * 60 * 60)).toFixed(3)));

      await this.prisma.timeEntry.update({
        where: { id: activeTimer.id },
        data: {
          isTimerRunning: false,
          hours: durationHours,
          loggedAt: now,
        },
      });

      if (activeTimer.taskId) {
        await this.prisma.taskActivity.create({
          data: {
            taskId: activeTimer.taskId,
            userId,
            action: 'TIMER_STOPPED',
            newValue: JSON.stringify({ hours: durationHours, description: activeTimer.description }),
          },
        });
        await this.prisma.taskActivity.create({
          data: {
            taskId: activeTimer.taskId,
            userId,
            action: 'TIME_LOGGED',
            newValue: JSON.stringify({ hours: durationHours, description: activeTimer.description }),
          },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'TimeEntry',
          entityId: activeTimer.id,
          action: 'TIME_LOGGED',
          projectId: activeTimer.projectId,
          taskId: activeTimer.taskId || null,
          newValue: JSON.stringify({ hours: durationHours }),
        },
      });
    }

    const newTimer = await this.prisma.timeEntry.create({
      data: {
        hours: 0,
        loggedAt: new Date(),
        isTimerRunning: true,
        timerStartedAt: new Date(),
        source: 'TIMER',
        projectId: dto.projectId,
        taskId: dto.taskId || null,
        userId,
        organizationId,
      },
    });

    if (dto.taskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: dto.taskId,
          userId,
          action: 'TIMER_STARTED',
        },
      });
    }

    return newTimer;
  }

  async stopTimer(organizationId: string, userId: string, dto: StopTimerDto) {
    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: { userId, isTimerRunning: true, deletedAt: null },
    });

    if (!activeTimer) {
      throw new NotFoundException('No active timer found');
    }

    const now = new Date();
    const startedAt = activeTimer.timerStartedAt || activeTimer.createdAt;
    const durationMs = now.getTime() - startedAt.getTime();
    const durationHours = Math.max(0.01, parseFloat((durationMs / (1000 * 60 * 60)).toFixed(3)));

    const entry = await this.prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        isTimerRunning: false,
        hours: durationHours,
        loggedAt: now,
        description: dto.description || activeTimer.description,
      },
    });

    if (entry.taskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: entry.taskId,
          userId,
          action: 'TIMER_STOPPED',
          newValue: JSON.stringify({ hours: durationHours, description: entry.description }),
        },
      });
      await this.prisma.taskActivity.create({
        data: {
          taskId: entry.taskId,
          userId,
          action: 'TIME_LOGGED',
          newValue: JSON.stringify({ hours: durationHours, description: entry.description }),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TimeEntry',
        entityId: entry.id,
        action: 'TIME_LOGGED',
        projectId: entry.projectId,
        taskId: entry.taskId || null,
        newValue: JSON.stringify(entry),
      },
    });

    return entry;
  }

  async getActiveTimer(userId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { userId, isTimerRunning: true, deletedAt: null },
      include: {
        task: {
          select: { id: true, title: true, taskNumber: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
    });
  }

  async archiveTimeEntry(organizationId: string, userId: string, timeEntryId: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: timeEntryId, organizationId, deletedAt: null },
      include: { timesheet: true },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }

    if (entry.timesheet && (entry.timesheet.status === 'SUBMITTED' || entry.timesheet.status === 'APPROVED')) {
      throw new ForbiddenException('Cannot archive time entry linked to a submitted or approved timesheet');
    }

    const archived = await this.prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: { deletedAt: new Date() },
    });

    if (entry.taskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: entry.taskId,
          userId,
          action: 'TIME_ARCHIVED',
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'TimeEntry',
        entityId: entry.id,
        action: 'TIME_ARCHIVED',
        projectId: entry.projectId,
        taskId: entry.taskId || null,
        newValue: JSON.stringify(archived),
      },
    });

    return archived;
  }

  async getProjectTimeEntries(organizationId: string, userId: string, projectId: string) {
    return this.prisma.timeEntry.findMany({
      where: { projectId, organizationId, isTimerRunning: false, deletedAt: null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        task: {
          select: { id: true, title: true, taskNumber: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async getUserTimeEntries(organizationId: string, userId: string) {
    return this.prisma.timeEntry.findMany({
      where: { userId, organizationId, isTimerRunning: false, deletedAt: null },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async getTaskTimeEntries(organizationId: string, userId: string, taskId: string) {
    return this.prisma.timeEntry.findMany({
      where: { taskId, organizationId, isTimerRunning: false, deletedAt: null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { loggedAt: 'desc' },
    });
  }

  async submitTimesheet(organizationId: string, userId: string, dto: SubmitTimesheetDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    const existingTimesheet = await this.prisma.timesheet.findFirst({
      where: {
        userId,
        organizationId,
        startDate: start,
        endDate: end,
        deletedAt: null,
      },
    });

    if (existingTimesheet && (existingTimesheet.status === 'APPROVED' || existingTimesheet.status === 'SUBMITTED')) {
      throw new ForbiddenException('A timesheet is already submitted or approved for this period');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const timeEntries = await tx.timeEntry.findMany({
        where: {
          userId,
          organizationId,
          loggedAt: { gte: start, lte: end },
          isTimerRunning: false,
          deletedAt: null,
          OR: [
            { timesheetId: null },
            ...(existingTimesheet ? [{ timesheetId: existingTimesheet.id }] : []),
          ],
        },
      });

      let timesheetId = existingTimesheet?.id;
      if (!timesheetId) {
        const ts = await tx.timesheet.create({
          data: {
            userId,
            organizationId,
            startDate: start,
            endDate: end,
            status: 'SUBMITTED',
          },
        });
        timesheetId = ts.id;
      } else {
        await tx.timesheet.update({
          where: { id: timesheetId },
          data: { status: 'SUBMITTED', approvalComment: null },
        });
      }

      await tx.timeEntry.updateMany({
        where: { id: { in: timeEntries.map((e) => e.id) } },
        data: { timesheetId },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          entityType: 'Timesheet',
          entityId: timesheetId,
          action: 'TIMESHEET_SUBMITTED',
          newValue: JSON.stringify({ timesheetId, entriesCount: timeEntries.length }),
        },
      });

      return tx.timesheet.findUnique({
        where: { id: timesheetId },
        include: { timeEntries: true },
      });
    });

    const managers = await this.prisma.user.findMany({
      where: {
        organizationId,
        deletedAt: null,
        userRoles: {
          some: {
            role: {
              name: { in: ['Admin', 'Project Manager'] },
            },
          },
        },
      },
      select: { id: true },
    });

    const notifyUserIds = new Set(managers.map((m) => m.id));
    notifyUserIds.delete(userId);

    if (notifyUserIds.size > 0) {
      const submitter = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const submitterName = submitter ? `${submitter.firstName} ${submitter.lastName}`.trim() : 'A member';
      const formattedStart = start.toISOString().split('T')[0];
      const formattedEnd = end.toISOString().split('T')[0];

      const notifications = Array.from(notifyUserIds).map((recipientId) => ({
        type: NotificationType.TIMESHEET_SUBMITTED,
        title: 'Timesheet Submitted',
        message: `${submitterName} submitted a timesheet for period ${formattedStart} to ${formattedEnd}`,
        userId: recipientId,
        actionUrl: `/settings`,
        triggeredById: userId,
        organizationId,
        metadata: {
          startDate: formattedStart,
          endDate: formattedEnd,
          submitterName,
        },
      }));

      await this.notificationService.createNotificationsBulk(notifications);
    }

    return result;
  }

  async approveTimesheet(organizationId: string, userId: string, timesheetId: string, dto: ApproveTimesheetDto) {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id: timesheetId, organizationId, deletedAt: null },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    if (timesheet.status !== 'SUBMITTED') {
      throw new ForbiddenException('Only submitted timesheets can be approved or rejected');
    }

    const updated = await this.prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvalComment: dto.approvalComment || null,
        approvedById: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: 'Timesheet',
        entityId: timesheetId,
        action: dto.action === 'APPROVE' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED',
        newValue: JSON.stringify(updated),
      },
    });

    if (timesheet.userId !== userId) {
      const formattedStart = timesheet.startDate.toISOString().split('T')[0];
      const formattedEnd = timesheet.endDate.toISOString().split('T')[0];
      const isApproved = updated.status === 'APPROVED';

      await this.notificationService.createNotification({
        type: isApproved ? NotificationType.TIMESHEET_APPROVED : NotificationType.TIMESHEET_REJECTED,
        title: isApproved ? 'Timesheet Approved' : 'Timesheet Rejected',
        message: `Your timesheet for period ${formattedStart} to ${formattedEnd} has been ${updated.status.toLowerCase()}${updated.approvalComment ? `: "${updated.approvalComment}"` : ''}`,
        userId: timesheet.userId,
        actionUrl: `/settings`,
        triggeredById: userId,
        organizationId,
        metadata: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: updated.status,
          approvalComment: updated.approvalComment,
        },
      });
    }

    return updated;
  }

  async getTimesheets(organizationId: string, userId: string, userPermissions: string[]) {
    const canApprove = userPermissions.includes('APPROVE_TIMESHEET');
    const whereClause: any = {
      organizationId,
      deletedAt: null,
    };

    if (!canApprove) {
      whereClause.userId = userId;
    }

    return this.prisma.timesheet.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        timeEntries: {
          where: { deletedAt: null },
          include: {
            task: {
              select: { id: true, title: true, taskNumber: true },
            },
            project: {
              select: { id: true, name: true, projectCode: true },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
