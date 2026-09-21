import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { AddWidgetDto } from './dto/add-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { ShareDashboardDto } from './dto/share-dashboard.dto';

@ApiTags('Custom Dashboards')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('dashboards')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'List custom dashboards accessible to current user' })
  @ApiResponse({
    status: 200,
    description: 'List of accessible custom dashboards.',
  })
  async listDashboards(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Query('projectId') projectId?: string,
    @Query('visibility') visibility?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: 'my' | 'project' | 'shared' | 'all',
  ) {
    return this.dashboardService.listDashboards(orgId, userId, {
      projectId,
      visibility,
      search,
      scope,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new custom dashboard' })
  @ApiResponse({
    status: 201,
    description: 'Custom dashboard created successfully.',
  })
  async createDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateDashboardDto,
  ) {
    return this.dashboardService.createDashboard(orgId, userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dashboard details, widgets, and permissions by ID' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard details retrieved successfully.',
  })
  async getDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
  ) {
    return this.dashboardService.getDashboardById(orgId, dashboardId, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update dashboard details' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard updated successfully.',
  })
  async updateDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    return this.dashboardService.updateDashboard(
      orgId,
      dashboardId,
      userId,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom dashboard configuration' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard deleted safely.',
  })
  async deleteDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
  ) {
    return this.dashboardService.deleteDashboard(orgId, dashboardId, userId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate / Clone custom dashboard' })
  @ApiResponse({
    status: 201,
    description: 'Dashboard duplicated successfully.',
  })
  async duplicateDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
  ) {
    return this.dashboardService.duplicateDashboard(orgId, dashboardId, userId);
  }

  @Get(':id/data')
  @ApiOperation({ summary: 'Get aggregated live data for all dashboard widgets' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated widget metrics and tables.',
  })
  async getDashboardData(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Query('dateRange') dateRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
  ) {
    return this.dashboardService.getDashboardData(orgId, dashboardId, userId, {
      dateRange,
      startDate,
      endDate,
      projectId,
      assigneeId,
      status,
    });
  }

  @Post(':id/widgets')
  @ApiOperation({ summary: 'Add a new widget to dashboard' })
  @ApiResponse({
    status: 201,
    description: 'Widget added successfully.',
  })
  async addWidget(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Body() dto: AddWidgetDto,
  ) {
    return this.dashboardService.addWidget(orgId, dashboardId, userId, dto);
  }

  @Patch(':id/widgets/:widgetId')
  @ApiOperation({ summary: 'Update widget configuration and dimensions' })
  @ApiResponse({
    status: 200,
    description: 'Widget updated successfully.',
  })
  async updateWidget(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.dashboardService.updateWidget(
      orgId,
      dashboardId,
      widgetId,
      userId,
      dto,
    );
  }

  @Delete(':id/widgets/:widgetId')
  @ApiOperation({ summary: 'Remove a widget from dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Widget removed successfully.',
  })
  async deleteWidget(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
  ) {
    return this.dashboardService.deleteWidget(
      orgId,
      dashboardId,
      widgetId,
      userId,
    );
  }

  @Put(':id/layout')
  @ApiOperation({ summary: 'Update batch layout order and column widths' })
  @ApiResponse({
    status: 200,
    description: 'Layout updated successfully.',
  })
  async updateLayout(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Body() dto: UpdateLayoutDto,
  ) {
    return this.dashboardService.updateLayout(orgId, dashboardId, userId, dto);
  }

  @Post(':id/shares')
  @ApiOperation({ summary: 'Share dashboard with specific user' })
  @ApiResponse({
    status: 201,
    description: 'Dashboard shared successfully.',
  })
  async shareDashboard(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Body() dto: ShareDashboardDto,
  ) {
    return this.dashboardService.shareDashboard(orgId, dashboardId, userId, dto);
  }

  @Delete(':id/shares/:userId')
  @ApiOperation({ summary: 'Remove dashboard sharing for a user' })
  @ApiResponse({
    status: 200,
    description: 'Share removed successfully.',
  })
  async removeShare(
    @TenantId() orgId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') dashboardId: string,
    @Param('userId') shareUserId: string,
  ) {
    return this.dashboardService.removeShare(
      orgId,
      dashboardId,
      shareUserId,
      userId,
    );
  }
}
