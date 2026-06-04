import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { LogManualTimeDto } from './dto/log-manual-time.dto';
import { StartTimerDto } from './dto/start-timer.dto';
import { StopTimerDto } from './dto/stop-timer.dto';
import { SubmitTimesheetDto } from './dto/submit-timesheet.dto';
import { ApproveTimesheetDto } from './dto/approve-timesheet.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Time Tracking')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class TimeTrackingController {
  constructor(private timeTrackingService: TimeTrackingService) {}

  @Get('timesheets')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get all timesheets' })
  @ApiResponse({ status: 200, description: 'Timesheets retrieved successfully.' })
  getTimesheets(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
  ) {
    return this.timeTrackingService.getTimesheets(organizationId, userId, permissions);
  }

  @Post('time-entries')
  @Permissions('LOG_TIME_ENTRY')
  @ApiOperation({ summary: 'Log work hours manually' })
  @ApiResponse({ status: 201, description: 'Time logged successfully.' })
  logManual(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: LogManualTimeDto,
  ) {
    return this.timeTrackingService.logManualTime(organizationId, userId, dto);
  }

  @Post('time-entries/timer/start')
  @Permissions('LOG_TIME_ENTRY')
  @ApiOperation({ summary: 'Start a work timer' })
  @ApiResponse({ status: 201, description: 'Timer started successfully.' })
  startTimer(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: StartTimerDto,
  ) {
    return this.timeTrackingService.startTimer(organizationId, userId, dto);
  }

  @Post('time-entries/timer/stop')
  @Permissions('LOG_TIME_ENTRY')
  @ApiOperation({ summary: 'Stop the active work timer' })
  @ApiResponse({ status: 200, description: 'Timer stopped and hours logged successfully.' })
  stopTimer(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: StopTimerDto,
  ) {
    return this.timeTrackingService.stopTimer(organizationId, userId, dto);
  }

  @Get('time-entries/active')
  @Permissions('LOG_TIME_ENTRY')
  @ApiOperation({ summary: 'Get current running timer' })
  @ApiResponse({ status: 200, description: 'Active timer retrieved.' })
  getActive(@GetCurrentUserId() userId: string) {
    return this.timeTrackingService.getActiveTimer(userId);
  }

  @Get('time-entries/me')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get all time logs for the current user' })
  @ApiResponse({ status: 200, description: 'Time logs retrieved successfully.' })
  getMyLogs(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.timeTrackingService.getUserTimeEntries(organizationId, userId);
  }

  @Post('time-entries/:id/archive')
  @Permissions('ARCHIVE_TIME_ENTRY')
  @ApiOperation({ summary: 'Archive a time log' })
  @ApiResponse({ status: 200, description: 'Time log archived successfully.' })
  archive(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.timeTrackingService.archiveTimeEntry(organizationId, userId, id);
  }

  @Get('projects/:projectId/time-entries')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get all time logs for a project' })
  @ApiResponse({ status: 200, description: 'Time logs retrieved successfully.' })
  getProjectLogs(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.timeTrackingService.getProjectTimeEntries(organizationId, userId, projectId);
  }

  @Get('tasks/:taskId/time-entries')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get all time logs for a task' })
  @ApiResponse({ status: 200, description: 'Time logs retrieved successfully.' })
  getTaskLogs(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.timeTrackingService.getTaskTimeEntries(organizationId, userId, taskId);
  }

  @Post('timesheets/submit')
  @Permissions('SUBMIT_TIMESHEET')
  @ApiOperation({ summary: 'Submit weekly or monthly timesheet' })
  @ApiResponse({ status: 201, description: 'Timesheet submitted successfully.' })
  submit(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: SubmitTimesheetDto,
  ) {
    return this.timeTrackingService.submitTimesheet(organizationId, userId, dto);
  }

  @Patch('timesheets/:id/approve')
  @Permissions('APPROVE_TIMESHEET')
  @ApiOperation({ summary: 'Approve or reject a timesheet' })
  @ApiResponse({ status: 200, description: 'Timesheet decision saved successfully.' })
  approve(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') timesheetId: string,
    @Body() dto: ApproveTimesheetDto,
  ) {
    return this.timeTrackingService.approveTimesheet(organizationId, userId, timesheetId, dto);
  }
}
