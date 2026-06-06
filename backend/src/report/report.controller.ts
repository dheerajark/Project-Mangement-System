import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('projects/:projectId/reports/summary')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get project report summary analytics' })
  @ApiResponse({ status: 200, description: 'Project report summary retrieved successfully.' })
  async getProjectSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getProjectReportSummary(orgId, projectId, userId, range, startDate, endDate);
  }

  @Get('projects/:projectId/reports/export')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Export project metrics to CSV' })
  @ApiResponse({ status: 200, description: 'CSV file exported successfully.' })
  async exportProject(
    @TenantId() orgId: string,
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const csv = await this.reportService.exportProjectReport(orgId, projectId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="project-report-${projectId}.csv"`);
    return csv;
  }

  @Get('dashboard/reports/summary')
  @ApiOperation({ summary: 'Get global user dashboard report summary' })
  @ApiResponse({ status: 200, description: 'Dashboard report summary retrieved successfully.' })
  async getDashboardSummary(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getDashboardReportSummary(orgId, userId, range, startDate, endDate);
  }
}
