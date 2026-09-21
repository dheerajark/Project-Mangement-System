import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { GetCurrentUser } from '../auth/decorators/get-current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('projects/:projectId/reports/summary')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get project report summary analytics' })
  @ApiResponse({
    status: 200,
    description: 'Project report summary retrieved successfully.',
  })
  async getProjectSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.reportService.getProjectReportSummary(
      orgId,
      projectId,
      userId,
      range,
      startDate,
      endDate,
      status,
      assigneeId,
    );
  }

  @Get('projects/:projectId/reports/export')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Export project metrics to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file exported successfully.' })
  async exportProject(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const csv = await this.reportService.exportProjectReport(
      orgId,
      projectId,
      userId,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-report-${projectId}.csv"`,
    );
    return csv;
  }

  @Get('projects/:projectId/reports/tasks')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get basic task report summary and detailed task analytics' })
  @ApiResponse({
    status: 200,
    description: 'Task report summary retrieved successfully.',
  })
  async getTaskSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('taskListId') taskListId?: string,
    @Query('upcomingDays') upcomingDays?: number,
  ) {
    return this.reportService.getTaskReportSummary(orgId, projectId, userId, {
      range,
      startDate,
      endDate,
      status,
      priority,
      assigneeId,
      milestoneId,
      taskListId,
      upcomingDays,
    });
  }

  @Get('projects/:projectId/reports/tasks/export')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Export task report to CSV' })
  @ApiResponse({ status: 200, description: 'Task report CSV file exported successfully.' })
  async exportTaskReport(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: any,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('milestoneId') milestoneId?: string,
    @Query('taskListId') taskListId?: string,
  ) {
    const csv = await this.reportService.exportTaskReport(
      orgId,
      projectId,
      userId,
      {
        range,
        startDate,
        endDate,
        status,
        priority,
        assigneeId,
        milestoneId,
        taskListId,
      },
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="task-report-${projectId}.csv"`,
    );
    return csv;
  }

  @Get('dashboard/reports/summary')
  @ApiOperation({ summary: 'Get global user dashboard report summary' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard report summary retrieved successfully.',
  })
  async getDashboardSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getDashboardReportSummary(
      orgId,
      userId,
      range,
      startDate,
      endDate,
    );
  }

  @Get('reports/timesheets')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Get global timesheet report summary and analytics' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet report summary retrieved successfully.',
  })
  async getTimesheetSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Query('projectId') projectId?: string,
    @Query('userId') filterUserId?: string,
    @Query('taskId') taskId?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billable') billable?: string,
    @Query('status') status?: string,
  ) {
    const billableBool =
      billable === 'true' ? true : billable === 'false' ? false : undefined;

    return this.reportService.getTimesheetReportSummary(
      orgId,
      userId,
      permissions || [],
      {
        projectId,
        userId: filterUserId,
        taskId,
        range,
        startDate,
        endDate,
        billable: billableBool,
        status,
      },
    );
  }

  @Get('reports/timesheets/export')
  @Permissions('VIEW_TIME_ENTRY')
  @ApiOperation({ summary: 'Export global timesheet report to CSV' })
  @ApiResponse({
    status: 200,
    description: 'Timesheet report CSV exported successfully.',
  })
  async exportTimesheetSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Res({ passthrough: true }) res: any,
    @Query('projectId') projectId?: string,
    @Query('userId') filterUserId?: string,
    @Query('taskId') taskId?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billable') billable?: string,
    @Query('status') status?: string,
  ) {
    const billableBool =
      billable === 'true' ? true : billable === 'false' ? false : undefined;

    const csv = await this.reportService.exportTimesheetReport(
      orgId,
      userId,
      permissions || [],
      {
        projectId,
        userId: filterUserId,
        taskId,
        range,
        startDate,
        endDate,
        billable: billableBool,
        status,
      },
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timesheet-report.csv"`,
    );
    return csv;
  }

  @Get('projects/:projectId/reports/timesheets')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get project-specific timesheet report summary' })
  @ApiResponse({
    status: 200,
    description: 'Project timesheet report retrieved successfully.',
  })
  async getProjectTimesheetSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Param('projectId') projectId: string,
    @Query('userId') filterUserId?: string,
    @Query('taskId') taskId?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billable') billable?: string,
    @Query('status') status?: string,
  ) {
    const billableBool =
      billable === 'true' ? true : billable === 'false' ? false : undefined;

    return this.reportService.getTimesheetReportSummary(
      orgId,
      userId,
      permissions || [],
      {
        projectId,
        userId: filterUserId,
        taskId,
        range,
        startDate,
        endDate,
        billable: billableBool,
        status,
      },
    );
  }

  @Get('projects/:projectId/reports/timesheets/export')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Export project-specific timesheet report to CSV' })
  @ApiResponse({
    status: 200,
    description: 'Project timesheet report CSV exported successfully.',
  })
  async exportProjectTimesheetSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: any,
    @Query('userId') filterUserId?: string,
    @Query('taskId') taskId?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('billable') billable?: string,
    @Query('status') status?: string,
  ) {
    const billableBool =
      billable === 'true' ? true : billable === 'false' ? false : undefined;

    const csv = await this.reportService.exportTimesheetReport(
      orgId,
      userId,
      permissions || [],
      {
        projectId,
        userId: filterUserId,
        taskId,
        range,
        startDate,
        endDate,
        billable: billableBool,
        status,
      },
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-timesheet-report-${projectId}.csv"`,
    );
    return csv;
  }
}
