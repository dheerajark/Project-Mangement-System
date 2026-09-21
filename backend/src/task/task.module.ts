import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TaskListService } from './task-list.service';
import { TaskListController } from './task-list.controller';
import { TaskListTemplateController } from './task-list-template.controller';
import { TaskListTemplateService } from './task-list-template.service';
import { RecurringTaskService } from './recurring-task.service';
import { RecurringTaskController } from './recurring-task.controller';
import { RecurrenceSchedulerService } from './recurrence-scheduler.service';
import { TaskReminderService } from './task-reminder.service';
import { TaskReminderController } from './task-reminder.controller';
import { TaskReminderSchedulerService } from './task-reminder-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';

@Module({
  imports: [PrismaModule, AuditModule, NotificationModule, CustomFieldModule],
  controllers: [
    TaskController,
    TaskListController,
    TaskListTemplateController,
    RecurringTaskController,
    TaskReminderController,
  ],
  providers: [
    TaskService,
    TaskListService,
    TaskListTemplateService,
    RecurringTaskService,
    RecurrenceSchedulerService,
    TaskReminderService,
    TaskReminderSchedulerService,
  ],
  exports: [TaskService, TaskListService, RecurringTaskService, TaskReminderService],
})
export class TaskModule {}
