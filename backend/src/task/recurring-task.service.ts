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
  CreateTaskRecurrenceDto,
  UpdateTaskRecurrenceDto,
  RecurrenceSchedulePreviewDto,
} from './dto/task-recurrence.dto';
import {
  RecurrenceFrequency,
  RecurrenceEndType,
  RecurrenceNonWorkingDayAction,
  RecurrenceStatus,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskBillingType,
  NotificationType,
  ReminderType,
  ReminderStatus,
} from '@prisma/client';

@Injectable()
export class RecurringTaskService {
  private readonly logger = new Logger(RecurringTaskService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // ─── 1. Working Days & Date Adjustment Engine ──────────────────────────────

  parseWorkingDays(workingDaysStr?: string): Set<number> {
    if (!workingDaysStr) {
      return new Set([1, 2, 3, 4, 5]); // Default Monday to Friday
    }
    const days = workingDaysStr
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => !isNaN(d));
    return new Set(days.length > 0 ? days : [1, 2, 3, 4, 5]);
  }

  isWorkingDay(date: Date, workingDaysSet: Set<number>): boolean {
    const jsDay = date.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1 = Mon ... 7 = Sun
    return workingDaysSet.has(isoDay) || workingDaysSet.has(jsDay);
  }

  adjustForNonWorkingDays(
    date: Date,
    action: RecurrenceNonWorkingDayAction,
    workingDaysSet: Set<number>,
  ): Date {
    const result = new Date(date.getTime());
    if (action === RecurrenceNonWorkingDayAction.EXACT_DATE) {
      return result;
    }

    if (action === RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY) {
      let attempts = 0;
      while (!this.isWorkingDay(result, workingDaysSet) && attempts < 14) {
        result.setDate(result.getDate() + 1);
        attempts++;
      }
      return result;
    }

    if (action === RecurrenceNonWorkingDayAction.PREVIOUS_WORKING_DAY) {
      let attempts = 0;
      while (!this.isWorkingDay(result, workingDaysSet) && attempts < 14) {
        result.setDate(result.getDate() - 1);
        attempts++;
      }
      return result;
    }

    return result;
  }

  // ─── 2. Recurrence Next Run Date Calculator ────────────────────────────────

  parseDaysOfWeek(daysStr?: string): number[] {
    if (!daysStr) return [];
    return daysStr
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 7)
      .map((n) => (n === 0 ? 7 : n)) // Normalize Sunday to 7 (ISO 1=Mon..7=Sun)
      .sort((a, b) => a - b);
  }

  /**
   * Calculates the Nth occurrence of a weekday in a given month/year.
   * nth: 1=1st, 2=2nd, 3=3rd, 4=4th, -1=last
   * targetWeekday: 1=Mon ... 7=Sun
   */
  calculateRelativeWeekday(
    year: number,
    month: number, // 0-indexed (0=Jan..11=Dec)
    nth: number,
    targetWeekday: number,
    hours: number = 0,
    minutes: number = 0,
    seconds: number = 0,
    ms: number = 0,
  ): Date {
    const jsTarget = targetWeekday === 7 ? 0 : targetWeekday;

    if (nth === -1) {
      // Last occurrence in month
      const lastDayOfMonth = new Date(
        Date.UTC(year, month + 1, 0, hours, minutes, seconds, ms),
      );
      let day = lastDayOfMonth.getUTCDate();
      while (day > 0) {
        const candidate = new Date(
          Date.UTC(year, month, day, hours, minutes, seconds, ms),
        );
        if (candidate.getUTCDay() === jsTarget) {
          return candidate;
        }
        day--;
      }
      return lastDayOfMonth;
    }

    // 1st, 2nd, 3rd, 4th
    let count = 0;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const candidate = new Date(
        Date.UTC(year, month, day, hours, minutes, seconds, ms),
      );
      if (candidate.getUTCDay() === jsTarget) {
        count++;
        if (count === nth) {
          return candidate;
        }
      }
    }

    // Fallback if 4th/5th doesn't exist
    return new Date(
      Date.UTC(year, month, daysInMonth, hours, minutes, seconds, ms),
    );
  }

  /**
   * Calculates the next occurrence date strictly after fromDate.
   */
  calculateNextOccurrenceDate(
    recurrence: {
      frequency: RecurrenceFrequency;
      interval?: number;
      daysOfWeek?: string | null;
      dayOfMonth?: number | null;
      weekOfMonth?: number | null;
      relativeDayOfWeek?: number | null;
      monthOfYear?: number | null;
      nonWorkingDayAction?: RecurrenceNonWorkingDayAction;
      startDate: Date;
      endType?: RecurrenceEndType;
      endDate?: Date | null;
      maxOccurrences?: number | null;
      occurrencesCount?: number;
    },
    fromDate: Date,
    workingDaysSet?: Set<number>,
  ): Date | null {
    const interval = Math.max(1, recurrence.interval || 1);

    // End condition check: max occurrences
    if (
      recurrence.endType === RecurrenceEndType.AFTER_OCCURRENCES &&
      recurrence.maxOccurrences != null &&
      (recurrence.occurrencesCount ?? 0) >= recurrence.maxOccurrences
    ) {
      return null;
    }

    const start = new Date(recurrence.startDate.getTime());
    let candidate: Date | null = null;

    // If fromDate is before startDate, the first candidate is startDate itself
    if (fromDate.getTime() < start.getTime()) {
      candidate = new Date(start.getTime());
    } else {
      switch (recurrence.frequency) {
        case RecurrenceFrequency.DAILY: {
          candidate = new Date(
            fromDate.getTime() + interval * 24 * 60 * 60 * 1000,
          );
          break;
        }

        case RecurrenceFrequency.WEEKLY: {
          const daysOfWeek = this.parseDaysOfWeek(recurrence.daysOfWeek || '');
          const fromJsDay = fromDate.getUTCDay();
          const fromIsoDay = fromJsDay === 0 ? 7 : fromJsDay;

          if (daysOfWeek.length === 0) {
            // Default: repeat every interval weeks on the same weekday as start date
            candidate = new Date(
              fromDate.getTime() + interval * 7 * 24 * 60 * 60 * 1000,
            );
          } else {
            // Find next day in the current week that is strictly after fromIsoDay
            const nextDayInCurrentWeek = daysOfWeek.find((d) => d > fromIsoDay);

            if (nextDayInCurrentWeek) {
              const daysToAdd = nextDayInCurrentWeek - fromIsoDay;
              candidate = new Date(
                fromDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
              );
            } else {
              // Jump forward by interval weeks and take the first dayOfWeek
              const firstDayOfCycle = daysOfWeek[0];
              const daysUntilEndOfWeek = 7 - fromIsoDay;
              const daysInJumpWeeks = (interval - 1) * 7;
              const daysToAdd =
                daysUntilEndOfWeek + daysInJumpWeeks + firstDayOfCycle;

              candidate = new Date(
                fromDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
              );
            }
          }
          break;
        }

        case RecurrenceFrequency.MONTHLY: {
          const baseYear = fromDate.getUTCFullYear();
          const baseMonth = fromDate.getUTCMonth();
          const targetMonth = baseMonth + interval;
          const hours = fromDate.getUTCHours();
          const minutes = fromDate.getUTCMinutes();
          const seconds = fromDate.getUTCSeconds();
          const ms = fromDate.getUTCMilliseconds();

          if (
            recurrence.weekOfMonth != null &&
            recurrence.relativeDayOfWeek != null
          ) {
            // Relative weekday mode: e.g. 2nd Tuesday
            candidate = this.calculateRelativeWeekday(
              baseYear,
              targetMonth,
              recurrence.weekOfMonth,
              recurrence.relativeDayOfWeek,
              hours,
              minutes,
              seconds,
              ms,
            );
          } else {
            // Specific day of month: e.g. 15th, or -1 for last day
            const targetDay = recurrence.dayOfMonth || start.getUTCDate();
            if (targetDay === -1) {
              const lastDay = new Date(
                Date.UTC(baseYear, targetMonth + 1, 0),
              ).getUTCDate();
              candidate = new Date(
                Date.UTC(baseYear, targetMonth, lastDay, hours, minutes, seconds, ms),
              );
            } else {
              const maxDaysInTargetMonth = new Date(
                Date.UTC(baseYear, targetMonth + 1, 0),
              ).getUTCDate();
              const actualDay = Math.min(targetDay, maxDaysInTargetMonth);
              candidate = new Date(
                Date.UTC(baseYear, targetMonth, actualDay, hours, minutes, seconds, ms),
              );
            }
          }
          break;
        }

        case RecurrenceFrequency.YEARLY: {
          const baseYear = fromDate.getUTCFullYear() + interval;
          const targetMonth =
            recurrence.monthOfYear != null
              ? recurrence.monthOfYear - 1
              : start.getUTCMonth();
          const hours = fromDate.getUTCHours();
          const minutes = fromDate.getUTCMinutes();
          const seconds = fromDate.getUTCSeconds();
          const ms = fromDate.getUTCMilliseconds();

          if (
            recurrence.weekOfMonth != null &&
            recurrence.relativeDayOfWeek != null
          ) {
            candidate = this.calculateRelativeWeekday(
              baseYear,
              targetMonth,
              recurrence.weekOfMonth,
              recurrence.relativeDayOfWeek,
              hours,
              minutes,
              seconds,
              ms,
            );
          } else {
            const targetDay = recurrence.dayOfMonth || start.getUTCDate();
            const maxDays = new Date(
              Date.UTC(baseYear, targetMonth + 1, 0),
            ).getUTCDate();
            const actualDay = Math.min(targetDay, maxDays);
            candidate = new Date(
              Date.UTC(baseYear, targetMonth, actualDay, hours, minutes, seconds, ms),
            );
          }
          break;
        }
      }
    }

    if (!candidate) return null;

    // Adjust for non-working days if requested
    if (workingDaysSet && recurrence.nonWorkingDayAction) {
      candidate = this.adjustForNonWorkingDays(
        candidate,
        recurrence.nonWorkingDayAction,
        workingDaysSet,
      );
    }

    // End condition check: end date cutoff
    if (
      recurrence.endType === RecurrenceEndType.ON_DATE &&
      recurrence.endDate != null
    ) {
      const endLimit = new Date(recurrence.endDate.getTime());
      if (candidate.getTime() > endLimit.getTime()) {
        return null;
      }
    }

    return candidate;
  }

  // ─── 3. Recurrence Configuration & CRUD ────────────────────────────────────

  async configureRecurrence(
    organizationId: string,
    userId: string,
    taskId: string,
    dto: CreateTaskRecurrenceDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: {
        project: true,
        subtasks: { where: { deletedAt: null } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.project.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Cannot configure recurrence in an archived project',
      );
    }

    const startDate = new Date(dto.startDate);
    let endDate: Date | null = null;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
      if (endDate < startDate) {
        throw new BadRequestException('End date cannot be before start date');
      }
      if (
        task.project.isStrict &&
        task.project.endDate &&
        endDate > new Date(task.project.endDate)
      ) {
        throw new BadRequestException(
          'Recurrence end date cannot exceed project end date in a strict project',
        );
      }
    }

    const workingDaysSet = this.parseWorkingDays(task.project.workingDays);
    const nonWorkingDayAction =
      dto.nonWorkingDayAction || RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY;

    // Build template snapshot from original task
    const taskTemplate = JSON.stringify({
      title: task.title,
      description: task.description,
      priority: task.priority,
      type: task.type,
      billingType: task.billingType,
      estimatedHours: task.estimatedHours,
      tags: task.tags,
      customFields: task.customFields,
      assigneeId: task.assigneeId,
      milestoneId: task.milestoneId,
      taskListId: task.taskListId,
      originalDurationDays:
        task.startDate && task.dueDate
          ? Math.max(
              0,
              Math.round(
                (new Date(task.dueDate).getTime() -
                  new Date(task.startDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : null,
    });

    // Calculate initial nextRunDate
    const nextRunDate = this.calculateNextOccurrenceDate(
      {
        frequency: dto.frequency,
        interval: dto.interval,
        daysOfWeek: dto.daysOfWeek,
        dayOfMonth: dto.dayOfMonth,
        weekOfMonth: dto.weekOfMonth,
        relativeDayOfWeek: dto.relativeDayOfWeek,
        monthOfYear: dto.monthOfYear,
        nonWorkingDayAction,
        startDate,
        endType: dto.endType,
        endDate,
        maxOccurrences: dto.maxOccurrences,
        occurrencesCount: 1, // The original task counts as occurrence #1
      },
      startDate,
      workingDaysSet,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or replace TaskRecurrence record
      const recurrence = await tx.taskRecurrence.create({
        data: {
          organizationId,
          projectId: task.projectId,
          originalTaskId: task.id,
          frequency: dto.frequency,
          interval: dto.interval || 1,
          daysOfWeek: dto.daysOfWeek || null,
          dayOfMonth: dto.dayOfMonth ?? null,
          weekOfMonth: dto.weekOfMonth ?? null,
          relativeDayOfWeek: dto.relativeDayOfWeek ?? null,
          monthOfYear: dto.monthOfYear ?? null,
          nonWorkingDayAction,
          startDate,
          endType: dto.endType || RecurrenceEndType.NEVER,
          endDate,
          maxOccurrences: dto.maxOccurrences ?? null,
          status: RecurrenceStatus.ACTIVE,
          occurrencesCount: 1,
          lastGeneratedDate: new Date(),
          nextRunDate,
          taskTemplate,
          cloneSubtasks: dto.cloneSubtasks ?? true,
          cloneAttachments: dto.cloneAttachments ?? false,
          createdById: userId,
        },
      });

      // 2. Link origin task to recurrence
      await tx.task.update({
        where: { id: task.id },
        data: {
          recurringTaskId: recurrence.id,
          recurrenceIndex: 1,
          isRecurringTemplate: true,
        },
      });

      // 3. Log TaskActivity & AuditLog
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId,
          action: 'TASK_RECURRENCE_CONFIGURED',
          newValue: JSON.stringify({
            recurrenceId: recurrence.id,
            frequency: dto.frequency,
            interval: dto.interval,
            nextRunDate,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          projectId: task.projectId,
          taskId: task.id,
          entityType: 'TaskRecurrence',
          entityId: recurrence.id,
          action: 'TASK_RECURRENCE_CONFIGURED',
          newValue: JSON.stringify(recurrence),
        },
      });

      return recurrence;
    });
  }

  async getRecurrenceByTaskId(
    organizationId: string,
    userId: string,
    taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: {
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

    return task.recurringTask;
  }

  async getRecurrenceById(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, workingDays: true },
        },
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
    });

    if (!recurrence) {
      throw new NotFoundException('Recurring series not found');
    }

    return recurrence;
  }

  async updateRecurrence(
    organizationId: string,
    userId: string,
    recurrenceId: string,
    dto: UpdateTaskRecurrenceDto,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
      include: { project: true },
    });

    if (!recurrence) {
      throw new NotFoundException('Recurring series not found');
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : recurrence.startDate;
    let endDate: Date | null = recurrence.endDate;
    if (dto.endDate !== undefined) {
      endDate = dto.endDate ? new Date(dto.endDate) : null;
      if (endDate && endDate < startDate) {
        throw new BadRequestException('End date cannot be before start date');
      }
    }

    const workingDaysSet = this.parseWorkingDays(
      recurrence.project.workingDays,
    );
    const nonWorkingDayAction =
      dto.nonWorkingDayAction || recurrence.nonWorkingDayAction;

    // Recalculate nextRunDate based on new configuration
    const nextRunDate = this.calculateNextOccurrenceDate(
      {
        frequency: dto.frequency || recurrence.frequency,
        interval: dto.interval ?? recurrence.interval,
        daysOfWeek: dto.daysOfWeek ?? recurrence.daysOfWeek,
        dayOfMonth: dto.dayOfMonth ?? recurrence.dayOfMonth,
        weekOfMonth: dto.weekOfMonth ?? recurrence.weekOfMonth,
        relativeDayOfWeek: dto.relativeDayOfWeek ?? recurrence.relativeDayOfWeek,
        monthOfYear: dto.monthOfYear ?? recurrence.monthOfYear,
        nonWorkingDayAction,
        startDate,
        endType: dto.endType || recurrence.endType,
        endDate,
        maxOccurrences: dto.maxOccurrences ?? recurrence.maxOccurrences,
        occurrencesCount: recurrence.occurrencesCount,
      },
      recurrence.lastGeneratedDate || startDate,
      workingDaysSet,
    );

    const updated = await this.prisma.taskRecurrence.update({
      where: { id: recurrenceId },
      data: {
        frequency: dto.frequency ?? recurrence.frequency,
        interval: dto.interval ?? recurrence.interval,
        daysOfWeek: dto.daysOfWeek ?? recurrence.daysOfWeek,
        dayOfMonth: dto.dayOfMonth ?? recurrence.dayOfMonth,
        weekOfMonth: dto.weekOfMonth ?? recurrence.weekOfMonth,
        relativeDayOfWeek:
          dto.relativeDayOfWeek ?? recurrence.relativeDayOfWeek,
        monthOfYear: dto.monthOfYear ?? recurrence.monthOfYear,
        nonWorkingDayAction,
        startDate,
        endType: dto.endType ?? recurrence.endType,
        endDate,
        maxOccurrences: dto.maxOccurrences ?? recurrence.maxOccurrences,
        cloneSubtasks: dto.cloneSubtasks ?? recurrence.cloneSubtasks,
        cloneAttachments: dto.cloneAttachments ?? recurrence.cloneAttachments,
        status: dto.status ?? recurrence.status,
        nextRunDate: dto.status === RecurrenceStatus.PAUSED ? null : nextRunDate,
      },
    });

    if (recurrence.originalTaskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: recurrence.originalTaskId,
          userId,
          action: 'TASK_RECURRENCE_UPDATED',
          newValue: JSON.stringify(updated),
        },
      });
    }

    return updated;
  }

  async pauseRecurrence(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
    });
    if (!recurrence) throw new NotFoundException('Recurring series not found');

    const updated = await this.prisma.taskRecurrence.update({
      where: { id: recurrenceId },
      data: { status: RecurrenceStatus.PAUSED, nextRunDate: null },
    });

    if (recurrence.originalTaskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: recurrence.originalTaskId,
          userId,
          action: 'TASK_RECURRENCE_PAUSED',
        },
      });
    }

    return updated;
  }

  async resumeRecurrence(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
      include: { project: true },
    });
    if (!recurrence) throw new NotFoundException('Recurring series not found');

    const workingDaysSet = this.parseWorkingDays(
      recurrence.project.workingDays,
    );
    const nextRunDate = this.calculateNextOccurrenceDate(
      recurrence,
      new Date(),
      workingDaysSet,
    );

    const updated = await this.prisma.taskRecurrence.update({
      where: { id: recurrenceId },
      data: {
        status: RecurrenceStatus.ACTIVE,
        nextRunDate,
      },
    });

    if (recurrence.originalTaskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: recurrence.originalTaskId,
          userId,
          action: 'TASK_RECURRENCE_RESUMED',
          newValue: JSON.stringify({ nextRunDate }),
        },
      });
    }

    return updated;
  }

  async stopRecurrence(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
    });
    if (!recurrence) throw new NotFoundException('Recurring series not found');

    const updated = await this.prisma.taskRecurrence.update({
      where: { id: recurrenceId },
      data: { status: RecurrenceStatus.STOPPED, nextRunDate: null },
    });

    if (recurrence.originalTaskId) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: recurrence.originalTaskId,
          userId,
          action: 'TASK_RECURRENCE_STOPPED',
        },
      });
    }

    return updated;
  }

  async deleteRecurrence(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
    });
    if (!recurrence) throw new NotFoundException('Recurring series not found');

    await this.prisma.$transaction(async (tx) => {
      // Soft-delete the recurrence rule
      await tx.taskRecurrence.update({
        where: { id: recurrenceId },
        data: { deletedAt: new Date(), status: RecurrenceStatus.STOPPED },
      });

      // Remove template flag from original task
      if (recurrence.originalTaskId) {
        await tx.task.update({
          where: { id: recurrence.originalTaskId },
          data: { isRecurringTemplate: false },
        });

        await tx.taskActivity.create({
          data: {
            taskId: recurrence.originalTaskId,
            userId,
            action: 'TASK_RECURRENCE_DELETED',
          },
        });
      }
    });

    return { message: 'Recurring series deleted successfully' };
  }

  // ─── 4. Progressive Generation Engine ──────────────────────────────────────

  /**
   * Clones subtasks hierarchy from origin task to newly generated parent task,
   * shifting dates by durationDeltaMs.
   */
  private async cloneSubtasksHierarchy(
    tx: any,
    originParentId: string,
    newParentId: string,
    deltaMs: number,
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    const originSubtasks = await tx.task.findMany({
      where: {
        parentTaskId: originParentId,
        deletedAt: null,
      },
    });

    for (const sub of originSubtasks) {
      // Increment project sequence counter for each subtask
      const proj = await tx.project.findUnique({ where: { id: projectId } });
      const highestTask = await tx.task.findFirst({
        where: { projectId },
        orderBy: { taskNumber: 'desc' },
        select: { taskNumber: true },
      });
      const currentMax = highestTask ? highestTask.taskNumber : 0;
      const subtaskNumber = Math.max(
        proj?.nextTaskNumber || 1,
        currentMax + 1,
      );

      await tx.project.update({
        where: { id: projectId },
        data: { nextTaskNumber: subtaskNumber + 1 },
      });

      const newSubStartDate = sub.startDate
        ? new Date(new Date(sub.startDate).getTime() + deltaMs)
        : null;
      const newSubDueDate = sub.dueDate
        ? new Date(new Date(sub.dueDate).getTime() + deltaMs)
        : null;

      const newSubtask = await tx.task.create({
        data: {
          title: sub.title,
          description: sub.description,
          taskNumber: subtaskNumber,
          status: TaskStatus.TODO,
          priority: sub.priority,
          type: sub.type,
          progress: 0,
          billingType: sub.billingType,
          estimatedHours: sub.estimatedHours,
          startDate: newSubStartDate,
          dueDate: newSubDueDate,
          tags: sub.tags,
          customFields: sub.customFields,
          projectId,
          organizationId,
          assigneeId: sub.assigneeId,
          reporterId: userId,
          parentTaskId: newParentId,
        },
      });

      // Recurse for nested subtasks
      await this.cloneSubtasksHierarchy(
        tx,
        sub.id,
        newSubtask.id,
        deltaMs,
        organizationId,
        projectId,
        userId,
      );
    }
  }

  /**
   * Generates a single occurrence instance safely and transactionally.
   */
  async generateOccurrence(
    recurrenceId: string,
    targetDate?: Date,
    triggerUserId?: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findUnique({
      where: { id: recurrenceId },
      include: {
        project: {
          include: { members: { where: { deletedAt: null } } },
        },
      },
    });

    if (!recurrence || recurrence.deletedAt) {
      throw new NotFoundException('Recurring series not found');
    }

    if (recurrence.status !== RecurrenceStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot generate occurrence for recurring series in state: ${recurrence.status}`,
      );
    }

    const scheduledDate = targetDate || recurrence.nextRunDate || new Date();
    const workingDaysSet = this.parseWorkingDays(
      recurrence.project.workingDays,
    );

    // Idempotency check: check if task already created for next index
    const nextIndex = recurrence.occurrencesCount + 1;
    const existingInstance = await this.prisma.task.findFirst({
      where: {
        recurringTaskId: recurrence.id,
        recurrenceIndex: nextIndex,
        deletedAt: null,
      },
    });

    if (existingInstance) {
      this.logger.warn(
        `Occurrence #${nextIndex} already exists for recurrence ${recurrenceId}. Skipping duplicate creation.`,
      );
      return existingInstance;
    }

    // Parse template
    let templateData: any = {};
    if (recurrence.taskTemplate) {
      try {
        templateData = JSON.parse(recurrence.taskTemplate);
      } catch (e) {
        this.logger.error('Failed to parse taskTemplate JSON', e);
      }
    }

    const durationDays = templateData.originalDurationDays ?? 0;
    const occurrenceStartDate = new Date(scheduledDate.getTime());
    const occurrenceDueDate =
      durationDays > 0
        ? new Date(
            occurrenceStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
          )
        : new Date(occurrenceStartDate.getTime());

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Get next task number
      const proj = await tx.project.findUnique({
        where: { id: recurrence.projectId },
      });
      const highestTask = await tx.task.findFirst({
        where: { projectId: recurrence.projectId },
        orderBy: { taskNumber: 'desc' },
        select: { taskNumber: true },
      });
      const currentMax = highestTask ? highestTask.taskNumber : 0;
      const taskNumber = Math.max(proj?.nextTaskNumber || 1, currentMax + 1);

      await tx.project.update({
        where: { id: recurrence.projectId },
        data: { nextTaskNumber: taskNumber + 1 },
      });

      // 2. Create the generated task
      const newTask = await tx.task.create({
        data: {
          title: templateData.title || 'Recurring Task',
          description: templateData.description,
          taskNumber,
          status: TaskStatus.TODO,
          priority: templateData.priority || TaskPriority.MEDIUM,
          type: templateData.type || TaskType.TASK,
          progress: 0,
          billingType: templateData.billingType || TaskBillingType.BILLABLE,
          estimatedHours: templateData.estimatedHours,
          startDate: occurrenceStartDate,
          dueDate: occurrenceDueDate,
          position: 0,
          tags: templateData.tags,
          customFields: templateData.customFields,
          projectId: recurrence.projectId,
          organizationId: recurrence.organizationId,
          assigneeId: templateData.assigneeId,
          reporterId: triggerUserId || recurrence.createdById,
          milestoneId: templateData.milestoneId,
          taskListId: templateData.taskListId,
          recurringTaskId: recurrence.id,
          recurrenceIndex: nextIndex,
          isRecurringTemplate: false,
        },
      });

      // 3. Clone subtasks if enabled
      if (recurrence.cloneSubtasks && recurrence.originalTaskId) {
        const originalTask = await tx.task.findUnique({
          where: { id: recurrence.originalTaskId },
          select: { startDate: true },
        });
        const origStart = originalTask?.startDate
          ? new Date(originalTask.startDate).getTime()
          : recurrence.startDate.getTime();
        const deltaMs = occurrenceStartDate.getTime() - origStart;

        await this.cloneSubtasksHierarchy(
          tx,
          recurrence.originalTaskId,
          newTask.id,
          deltaMs,
          recurrence.organizationId,
          recurrence.projectId,
          triggerUserId || recurrence.createdById || newTask.id,
        );
      }

      // 3.5. Clone configured task reminders from template task with recalculated remindAt
      if (recurrence.originalTaskId && tx.taskReminder) {
        const originalReminders = await tx.taskReminder.findMany({
          where: { taskId: recurrence.originalTaskId, deletedAt: null },
        });

        for (const rem of originalReminders) {
          let newRemindAt = rem.remindAt;
          if (rem.type !== ReminderType.CUSTOM_DATE && occurrenceDueDate) {
            if (rem.type === ReminderType.BEFORE_DUE) {
              const mins = rem.offsetMinutes || 1440;
              newRemindAt = new Date(occurrenceDueDate.getTime() - mins * 60 * 1000);
            } else if (rem.type === ReminderType.ON_DUE) {
              const onDue = new Date(occurrenceDueDate.getTime());
              if (rem.timeOfDay) {
                const [h, m] = rem.timeOfDay.split(':').map((s: string) => parseInt(s, 10));
                if (!isNaN(h) && !isNaN(m)) onDue.setHours(h, m, 0, 0);
              }
              newRemindAt = onDue;
            } else if (rem.type === ReminderType.AFTER_DUE) {
              const mins = rem.offsetMinutes || 1440;
              newRemindAt = new Date(occurrenceDueDate.getTime() + mins * 60 * 1000);
            }
          }

          await tx.taskReminder.create({
            data: {
              taskId: newTask.id,
              organizationId: recurrence.organizationId,
              type: rem.type,
              offsetMinutes: rem.offsetMinutes,
              timeOfDay: rem.timeOfDay,
              customDate: rem.customDate,
              remindAt: newRemindAt,
              recipientType: rem.recipientType,
              recipientId: rem.recipientId,
              repeatDailyIfOverdue: rem.repeatDailyIfOverdue,
              status: ReminderStatus.PENDING,
              createdById: triggerUserId || recurrence.createdById,
            },
          });
        }
      }

      // 4. Calculate following nextRunDate
      const nextUpcomingDate = this.calculateNextOccurrenceDate(
        {
          frequency: recurrence.frequency,
          interval: recurrence.interval,
          daysOfWeek: recurrence.daysOfWeek,
          dayOfMonth: recurrence.dayOfMonth,
          weekOfMonth: recurrence.weekOfMonth,
          relativeDayOfWeek: recurrence.relativeDayOfWeek,
          monthOfYear: recurrence.monthOfYear,
          nonWorkingDayAction: recurrence.nonWorkingDayAction,
          startDate: recurrence.startDate,
          endType: recurrence.endType,
          endDate: recurrence.endDate,
          maxOccurrences: recurrence.maxOccurrences,
          occurrencesCount: nextIndex,
        },
        occurrenceStartDate,
        workingDaysSet,
      );

      const isCompleted =
        nextUpcomingDate == null ||
        (recurrence.maxOccurrences != null &&
          nextIndex >= recurrence.maxOccurrences);

      // 5. Update TaskRecurrence state
      await tx.taskRecurrence.update({
        where: { id: recurrence.id },
        data: {
          occurrencesCount: nextIndex,
          lastGeneratedDate: new Date(),
          nextRunDate: isCompleted ? null : nextUpcomingDate,
          status: isCompleted
            ? RecurrenceStatus.COMPLETED
            : RecurrenceStatus.ACTIVE,
        },
      });

      // 6. Record TaskActivity
      await tx.taskActivity.create({
        data: {
          taskId: newTask.id,
          userId: triggerUserId || recurrence.createdById || newTask.id,
          action: 'RECURRING_TASK_GENERATED',
          newValue: JSON.stringify({
            recurrenceId: recurrence.id,
            recurrenceIndex: nextIndex,
            scheduledDate: occurrenceStartDate,
          }),
        },
      });

      return newTask;
    });

    // 7. Dispatch Notification to Assignee
    if (result.assigneeId) {
      try {
        await this.notificationService.createNotification({
          type: NotificationType.RECURRING_TASK_GENERATED,
          title: `New Recurring Task Generated: #${result.taskNumber} ${result.title}`,
          message: `Occurrence #${nextIndex} of your recurring task "${result.title}" has been created.`,
          actionUrl: `/projects/${result.projectId}/tasks?taskId=${result.id}`,
          userId: result.assigneeId,
          triggeredById: triggerUserId || recurrence.createdById || undefined,
          projectId: result.projectId,
          taskId: result.id,
          organizationId: recurrence.organizationId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch recurring task notification: ${err.message}`,
        );
      }
    }

    return result;
  }

  async generateNextOccurrenceNow(
    organizationId: string,
    userId: string,
    recurrenceId: string,
  ) {
    const recurrence = await this.prisma.taskRecurrence.findFirst({
      where: { id: recurrenceId, organizationId, deletedAt: null },
    });

    if (!recurrence) {
      throw new NotFoundException('Recurring series not found');
    }

    return this.generateOccurrence(
      recurrence.id,
      recurrence.nextRunDate || new Date(),
      userId,
    );
  }

  /**
   * Process all active recurrence schedules that are due (nextRunDate <= now).
   * Called by background cron scheduler.
   */
  async processDueRecurrences(batchSize: number = 50) {
    const now = new Date();
    const dueRecurrences = await this.prisma.taskRecurrence.findMany({
      where: {
        status: RecurrenceStatus.ACTIVE,
        deletedAt: null,
        nextRunDate: { lte: now },
      },
      take: batchSize,
    });

    const results = {
      processed: 0,
      generated: 0,
      errors: 0,
    };

    for (const rec of dueRecurrences) {
      results.processed++;
      try {
        await this.generateOccurrence(rec.id, rec.nextRunDate || now);
        results.generated++;
      } catch (err) {
        results.errors++;
        this.logger.error(
          `Error processing due recurrence ${rec.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    return results;
  }

  /**
   * Computes upcoming occurrence dates preview for UI interactive feedback.
   */
  previewRecurrenceSchedule(
    dto: RecurrenceSchedulePreviewDto,
    projectWorkingDays?: string,
  ): string[] {
    const count = Math.min(dto.previewCount || 5, 20);
    const startDate = new Date(dto.startDate);
    const workingDaysSet = this.parseWorkingDays(projectWorkingDays);
    const nonWorkingDayAction =
      dto.nonWorkingDayAction || RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY;

    const dates: string[] = [];
    let currentDate = startDate;

    for (let i = 0; i < count; i++) {
      const nextDate = this.calculateNextOccurrenceDate(
        {
          frequency: dto.frequency,
          interval: dto.interval,
          daysOfWeek: dto.daysOfWeek,
          dayOfMonth: dto.dayOfMonth,
          weekOfMonth: dto.weekOfMonth,
          relativeDayOfWeek: dto.relativeDayOfWeek,
          monthOfYear: dto.monthOfYear,
          nonWorkingDayAction,
          startDate,
          endType: dto.endType,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          maxOccurrences: dto.maxOccurrences,
          occurrencesCount: i + 1,
        },
        currentDate,
        workingDaysSet,
      );

      if (!nextDate) break;
      dates.push(nextDate.toISOString());
      currentDate = nextDate;
    }

    return dates;
  }
}
