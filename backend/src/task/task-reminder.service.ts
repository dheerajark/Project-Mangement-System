import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  CreateTaskReminderDto,
  UpdateTaskReminderDto,
} from './dto/task-reminder.dto';
import {
  ReminderType,
  ReminderRecipientType,
  ReminderStatus,
  TaskStatus,
  NotificationType,
} from '@prisma/client';
import { isClientUser } from '../common/utils/client-detection.util';

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // ─── 1. Reminder Timestamp Calculation Engine ───────────────────────────────

  calculateRemindAt(
    taskDueDate: Date | null,
    type: ReminderType,
    offsetMinutes?: number,
    timeOfDay?: string,
    customDate?: Date | string,
  ): Date {
    if (type === ReminderType.CUSTOM_DATE) {
      if (!customDate) {
        throw new BadRequestException(
          'Custom date and time is required for CUSTOM_DATE reminders',
        );
      }
      const parsed = new Date(customDate);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid custom date format');
      }
      return parsed;
    }

    if (!taskDueDate) {
      throw new BadRequestException(
        'Task must have a due date to configure due-date reminders',
      );
    }

    const due = new Date(taskDueDate);

    if (type === ReminderType.BEFORE_DUE) {
      const minutes = offsetMinutes != null && offsetMinutes > 0 ? offsetMinutes : 1440; // Default 1 day
      return new Date(due.getTime() - minutes * 60 * 1000);
    }

    if (type === ReminderType.ON_DUE) {
      const onDueDate = new Date(due.getTime());
      if (timeOfDay) {
        const [hoursStr, minsStr] = timeOfDay.split(':');
        const hours = parseInt(hoursStr, 10);
        const mins = parseInt(minsStr, 10);
        if (!isNaN(hours) && !isNaN(mins)) {
          onDueDate.setHours(hours, mins, 0, 0);
        }
      }
      return onDueDate;
    }

    if (type === ReminderType.AFTER_DUE) {
      const minutes = offsetMinutes != null && offsetMinutes > 0 ? offsetMinutes : 1440; // Default 1 day
      return new Date(due.getTime() + minutes * 60 * 1000);
    }

    return due;
  }

  // ─── 2. CRUD Operations ───────────────────────────────────────────────────

  async createReminder(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: CreateTaskReminderDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot configure reminders in an archived project',
      );
    }

    if (dto.recipientType === ReminderRecipientType.CUSTOM_USER && !dto.recipientId) {
      throw new BadRequestException(
        'recipientId is required when recipientType is CUSTOM_USER',
      );
    }

    const remindAt = this.calculateRemindAt(
      task.dueDate,
      dto.type,
      dto.offsetMinutes,
      dto.timeOfDay,
      dto.customDate,
    );

    const reminder = await this.prisma.taskReminder.create({
      data: {
        taskId,
        organizationId,
        type: dto.type,
        offsetMinutes: dto.offsetMinutes ?? (dto.type === ReminderType.BEFORE_DUE || dto.type === ReminderType.AFTER_DUE ? 1440 : null),
        timeOfDay: dto.timeOfDay ?? (dto.type === ReminderType.ON_DUE ? '09:00' : null),
        customDate: dto.customDate ? new Date(dto.customDate) : null,
        remindAt,
        recipientType: dto.recipientType || ReminderRecipientType.ASSIGNEE,
        recipientId: dto.recipientId || null,
        repeatDailyIfOverdue: dto.repeatDailyIfOverdue ?? false,
        status: ReminderStatus.PENDING,
        createdById: userId,
      },
      include: {
        recipient: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return reminder;
  }

  async getTaskReminders(
    organizationId: string,
    userId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskReminder.findMany({
      where: { taskId, organizationId, deletedAt: null },
      include: {
        recipient: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { remindAt: 'asc' },
    });
  }

  async updateReminder(
    organizationId: string,
    userId: string,
    taskId: string,
    reminderId: string,
    dto: UpdateTaskReminderDto,
  ) {
    const reminder = await this.prisma.taskReminder.findFirst({
      where: { id: reminderId, taskId, organizationId, deletedAt: null },
      include: { task: true },
    });

    if (!reminder) {
      throw new NotFoundException('Task reminder not found');
    }

    const type = dto.type || reminder.type;
    const offsetMinutes = dto.offsetMinutes !== undefined ? dto.offsetMinutes : reminder.offsetMinutes;
    const timeOfDay = dto.timeOfDay !== undefined ? dto.timeOfDay : reminder.timeOfDay;
    const customDate = dto.customDate ? new Date(dto.customDate) : reminder.customDate;

    let remindAt = reminder.remindAt;
    if (
      dto.type ||
      dto.offsetMinutes !== undefined ||
      dto.timeOfDay !== undefined ||
      dto.customDate !== undefined
    ) {
      remindAt = this.calculateRemindAt(
        reminder.task.dueDate,
        type,
        offsetMinutes ?? undefined,
        timeOfDay ?? undefined,
        customDate ?? undefined,
      );
    }

    return this.prisma.taskReminder.update({
      where: { id: reminderId },
      data: {
        type,
        offsetMinutes,
        timeOfDay,
        customDate,
        remindAt,
        recipientType: dto.recipientType !== undefined ? dto.recipientType : reminder.recipientType,
        recipientId: dto.recipientId !== undefined ? dto.recipientId : reminder.recipientId,
        repeatDailyIfOverdue: dto.repeatDailyIfOverdue !== undefined ? dto.repeatDailyIfOverdue : reminder.repeatDailyIfOverdue,
        status: dto.status !== undefined ? dto.status : reminder.status,
      },
      include: {
        recipient: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async deleteReminder(
    organizationId: string,
    userId: string,
    taskId: string,
    reminderId: string,
  ) {
    const reminder = await this.prisma.taskReminder.findFirst({
      where: { id: reminderId, taskId, organizationId, deletedAt: null },
    });

    if (!reminder) {
      throw new NotFoundException('Task reminder not found');
    }

    return this.prisma.taskReminder.update({
      where: { id: reminderId },
      data: {
        deletedAt: new Date(),
        status: ReminderStatus.CANCELLED,
      },
    });
  }

  // ─── 3. Task Lifecycle Hooks & Dynamic Rescheduling ─────────────────────────

  /**
   * Reschedules all active relative reminders when a task's due date changes.
   */
  async rescheduleTaskReminders(taskId: string, newDueDate: Date | null) {
    const reminders = await this.prisma.taskReminder.findMany({
      where: {
        taskId,
        deletedAt: null,
        status: ReminderStatus.PENDING,
        type: { not: ReminderType.CUSTOM_DATE },
      },
    });

    if (reminders.length === 0) return;

    for (const reminder of reminders) {
      if (!newDueDate) {
        await this.prisma.taskReminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.CANCELLED },
        });
      } else {
        const recalculated = this.calculateRemindAt(
          newDueDate,
          reminder.type,
          reminder.offsetMinutes ?? undefined,
          reminder.timeOfDay ?? undefined,
          reminder.customDate ?? undefined,
        );
        await this.prisma.taskReminder.update({
          where: { id: reminder.id },
          data: { remindAt: recalculated },
        });
      }
    }
  }

  /**
   * Auto-dismisses pending reminders when task is completed.
   */
  async dismissTaskRemindersOnDone(taskId: string) {
    return this.prisma.taskReminder.updateMany({
      where: {
        taskId,
        deletedAt: null,
        status: ReminderStatus.PENDING,
      },
      data: {
        status: ReminderStatus.DISMISSED,
      },
    });
  }

  // ─── 4. Background Scheduled Processing Engine ──────────────────────────────

  /**
   * Processes all due reminders (remindAt <= now). Called every 60 seconds by scheduler.
   */
  async processDueReminders(batchSize: number = 100) {
    const now = new Date();
    const dueReminders = await this.prisma.taskReminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        deletedAt: null,
        remindAt: { lte: now },
        task: { deletedAt: null },
      },
      include: {
        task: {
          include: {
            project: true,
            assignee: true,
            reporter: true,
            watchers: true,
          },
        },
      },
      take: batchSize,
    });

    const results = {
      processed: 0,
      dispatched: 0,
      dismissed: 0,
      errors: 0,
    };

    for (const reminder of dueReminders) {
      results.processed++;
      try {
        const task = reminder.task;

        // If task is completed or archived, auto-dismiss reminder
        if (task.status === TaskStatus.DONE || task.project.status === 'ARCHIVED') {
          await this.prisma.taskReminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.DISMISSED },
          });
          results.dismissed++;
          continue;
        }

        // Determine notification recipients
        const recipientUserIds = new Set<string>();
        switch (reminder.recipientType) {
          case ReminderRecipientType.ASSIGNEE:
            if (task.assigneeId) recipientUserIds.add(task.assigneeId);
            break;
          case ReminderRecipientType.REPORTER:
            if (task.reporterId) recipientUserIds.add(task.reporterId);
            break;
          case ReminderRecipientType.WATCHERS:
            task.watchers.forEach((w) => recipientUserIds.add(w.userId));
            break;
          case ReminderRecipientType.CUSTOM_USER:
            if (reminder.recipientId) recipientUserIds.add(reminder.recipientId);
            break;
          case ReminderRecipientType.ALL_STAKEHOLDERS:
            if (task.assigneeId) recipientUserIds.add(task.assigneeId);
            if (task.reporterId) recipientUserIds.add(task.reporterId);
            task.watchers.forEach((w) => recipientUserIds.add(w.userId));
            break;
        }

        // Exclude deleted/null recipients
        const validRecipients = Array.from(recipientUserIds).filter(Boolean);

        if (validRecipients.length > 0) {
          const isOverdue =
            reminder.type === ReminderType.AFTER_DUE ||
            (task.dueDate && new Date(task.dueDate).getTime() < now.getTime());

          const notificationType = isOverdue
            ? NotificationType.TASK_REMINDER_OVERDUE
            : NotificationType.TASK_REMINDER_DUE;

          const title = isOverdue
            ? `Task Overdue Reminder: [${task.project.projectCode}-${task.taskNumber}]`
            : `Task Due Reminder: [${task.project.projectCode}-${task.taskNumber}]`;

          const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
          const message = isOverdue
            ? `Task [${task.project.projectCode}-${task.taskNumber}] "${task.title}" is overdue (Due: ${dueStr}).`
            : `Task [${task.project.projectCode}-${task.taskNumber}] "${task.title}" is due soon (Due: ${dueStr}).`;

          const notifications = validRecipients.map((recId) => ({
            type: notificationType,
            title,
            message,
            userId: recId,
            actionUrl: `/projects/${task.projectId}/tasks/${task.id}`,
            triggeredById: reminder.createdById || undefined,
            projectId: task.projectId,
            taskId: task.id,
            organizationId: reminder.organizationId,
            metadata: {
              projectCode: task.project.projectCode,
              taskNumber: task.taskNumber,
              reminderId: reminder.id,
              dueDate: task.dueDate,
              isOverdue,
            },
          }));

          await this.notificationService.createNotificationsBulk(notifications);
          results.dispatched += notifications.length;
        }

        // Handle daily overdue recurrence or mark completed
        if (reminder.repeatDailyIfOverdue) {
          const nextRemindAt = new Date(reminder.remindAt.getTime() + 24 * 60 * 60 * 1000);
          await this.prisma.taskReminder.update({
            where: { id: reminder.id },
            data: {
              remindAt: nextRemindAt,
              lastSentAt: now,
              status: ReminderStatus.PENDING,
            },
          });
        } else {
          await this.prisma.taskReminder.update({
            where: { id: reminder.id },
            data: {
              lastSentAt: now,
              status: ReminderStatus.SENT,
            },
          });
        }
      } catch (err) {
        results.errors++;
        this.logger.error(
          `Error processing task reminder ${reminder.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    return results;
  }
}
