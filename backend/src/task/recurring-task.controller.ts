import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RecurringTaskService } from './recurring-task.service';
import {
  CreateTaskRecurrenceDto,
  UpdateTaskRecurrenceDto,
  RecurrenceSchedulePreviewDto,
} from './dto/task-recurrence.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Recurring Tasks')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class RecurringTaskController {
  constructor(private recurringTaskService: RecurringTaskService) {}

  @Post(['tasks/:id/recurrence', 'projects/:projectId/tasks/:id/recurrence'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Configure recurrence schedule on an existing task' })
  @ApiResponse({
    status: 201,
    description: 'Recurrence configured successfully.',
  })
  configureRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateTaskRecurrenceDto,
  ) {
    return this.recurringTaskService.configureRecurrence(
      organizationId,
      userId,
      taskId,
      dto,
    );
  }

  @Get(['tasks/:id/recurrence', 'projects/:projectId/tasks/:id/recurrence'])
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get recurrence settings and occurrences history for a task' })
  @ApiResponse({
    status: 200,
    description: 'Task recurrence details retrieved.',
  })
  getRecurrenceForTask(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.recurringTaskService.getRecurrenceByTaskId(
      organizationId,
      userId,
      taskId,
    );
  }

  @Get('recurrence/:id')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get recurrence series details by recurrence ID' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series details retrieved.',
  })
  getRecurrenceById(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.getRecurrenceById(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Patch(['recurrence/:id', 'tasks/:id/recurrence'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update recurring series settings' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series updated successfully.',
  })
  updateRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
    @Body() dto: UpdateTaskRecurrenceDto,
  ) {
    return this.recurringTaskService.updateRecurrence(
      organizationId,
      userId,
      recurrenceId,
      dto,
    );
  }

  @Post(['recurrence/:id/pause', 'tasks/:id/recurrence/pause'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Pause a recurring task series' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series paused successfully.',
  })
  pauseRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.pauseRecurrence(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Post(['recurrence/:id/resume', 'tasks/:id/recurrence/resume'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Resume a paused recurring task series' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series resumed successfully.',
  })
  resumeRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.resumeRecurrence(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Post(['recurrence/:id/stop', 'tasks/:id/recurrence/stop'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Permanently stop a recurring task series' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series stopped successfully.',
  })
  stopRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.stopRecurrence(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Delete(['recurrence/:id', 'tasks/:id/recurrence'])
  @Permissions('ARCHIVE_TASK')
  @ApiOperation({ summary: 'Delete a recurring series' })
  @ApiResponse({
    status: 200,
    description: 'Recurrence series deleted successfully.',
  })
  deleteRecurrence(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.deleteRecurrence(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Post(['recurrence/:id/generate-next', 'tasks/:id/recurrence/generate-next'])
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Manually trigger next occurrence generation immediately' })
  @ApiResponse({
    status: 201,
    description: 'Next task occurrence generated successfully.',
  })
  generateNextNow(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') recurrenceId: string,
  ) {
    return this.recurringTaskService.generateNextOccurrenceNow(
      organizationId,
      userId,
      recurrenceId,
    );
  }

  @Post('recurrence/process-due')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Process all due recurrences across the system' })
  @ApiResponse({
    status: 200,
    description: 'Due recurrences processed.',
  })
  processDue() {
    return this.recurringTaskService.processDueRecurrences();
  }

  @Post('recurrence/preview-schedule')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Preview upcoming recurrence occurrence dates' })
  @ApiResponse({
    status: 200,
    description: 'Preview dates generated.',
  })
  previewSchedule(@Body() dto: RecurrenceSchedulePreviewDto) {
    return this.recurringTaskService.previewRecurrenceSchedule(dto);
  }
}
