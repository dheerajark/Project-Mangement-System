import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { TaskReminderService } from './task-reminder.service';

@Injectable()
export class TaskReminderSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TaskReminderSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

  constructor(private taskReminderService: TaskReminderService) {}

  onModuleInit() {
    this.logger.log('Starting PMS Task Reminder Scheduler engine...');
    // Initial check on startup
    this.runCheckSafe();

    // Periodic interval
    this.timer = setInterval(() => {
      this.runCheckSafe();
    }, this.CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Task Reminder Scheduler engine stopped.');
    }
  }

  private async runCheckSafe() {
    try {
      const result = await this.taskReminderService.processDueReminders(100);
      if (result.processed > 0) {
        this.logger.log(
          `Task Reminder check: processed ${result.processed}, dispatched ${result.dispatched}, dismissed ${result.dismissed}, errors ${result.errors}`,
        );
      }
    } catch (err) {
      this.logger.error(`Error in task reminder scheduler check: ${err.message}`);
    }
  }
}
