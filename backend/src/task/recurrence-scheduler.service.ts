import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { RecurringTaskService } from './recurring-task.service';

@Injectable()
export class RecurrenceSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RecurrenceSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

  constructor(private recurringTaskService: RecurringTaskService) {}

  onModuleInit() {
    this.logger.log('Starting PMS Recurrence Scheduler engine...');
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
      this.logger.log('Recurrence Scheduler engine stopped.');
    }
  }

  private async runCheckSafe() {
    try {
      const result = await this.recurringTaskService.processDueRecurrences(100);
      if (result.processed > 0) {
        this.logger.log(
          `Recurrence check: processed ${result.processed}, generated ${result.generated}, errors ${result.errors}`,
        );
      }
    } catch (err) {
      this.logger.error(`Error in recurrence scheduler check: ${err.message}`);
    }
  }
}
