import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MilestoneService } from './milestone.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Milestones')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class MilestoneController {
  constructor(private milestoneService: MilestoneService) {}

  @Post('projects/:projectId/milestones')
  @Permissions('CREATE_MILESTONE')
  @ApiOperation({ summary: 'Create a new milestone for a project' })
  @ApiResponse({ status: 201, description: 'Milestone created successfully.' })
  create(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestoneService.createMilestone(organizationId, userId, projectId, dto);
  }

  @Get('projects/:projectId/milestones')
  @Permissions('VIEW_MILESTONE')
  @ApiOperation({ summary: 'Get all active milestones of a project' })
  @ApiResponse({ status: 200, description: 'List of milestones retrieved successfully.' })
  findAll(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.milestoneService.getProjectMilestones(organizationId, userId, projectId);
  }

  @Get('milestones/:id')
  @Permissions('VIEW_MILESTONE')
  @ApiOperation({ summary: 'Get milestone details by ID' })
  @ApiResponse({ status: 200, description: 'Milestone details retrieved successfully.' })
  findOne(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') milestoneId: string,
  ) {
    return this.milestoneService.getMilestoneById(organizationId, userId, milestoneId);
  }

  @Patch('milestones/:id')
  @Permissions('EDIT_MILESTONE')
  @ApiOperation({ summary: 'Update milestone details' })
  @ApiResponse({ status: 200, description: 'Milestone details updated successfully.' })
  update(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestoneService.updateMilestone(organizationId, userId, milestoneId, dto);
  }

  @Post('milestones/:id/archive')
  @Permissions('ARCHIVE_MILESTONE')
  @ApiOperation({ summary: 'Archive a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone archived successfully.' })
  archive(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') milestoneId: string,
  ) {
    return this.milestoneService.archiveMilestone(organizationId, userId, milestoneId);
  }
}
