import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('projects')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Post()
  @Permissions('CREATE_PROJECT')
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully.' })
  create(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.createProject(organizationId, userId, dto);
  }

  @Get()
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get all accessible projects' })
  @ApiResponse({ status: 200, description: 'List of projects retrieved successfully.' })
  findAll(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.projectService.getProjects(organizationId, userId);
  }

  @Get(':id')
  @Permissions('VIEW_PROJECT')
  @ApiOperation({ summary: 'Get project details by ID' })
  @ApiResponse({ status: 200, description: 'Project details retrieved successfully.' })
  findOne(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectService.getProjectById(organizationId, userId, projectId);
  }

  @Patch(':id')
  @Permissions('EDIT_PROJECT')
  @ApiOperation({ summary: 'Update project details' })
  @ApiResponse({ status: 200, description: 'Project details updated successfully.' })
  update(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(organizationId, userId, projectId, dto);
  }

  @Post(':id/archive')
  @Permissions('ARCHIVE_PROJECT')
  @ApiOperation({ summary: 'Archive a project' })
  @ApiResponse({ status: 200, description: 'Project archived successfully.' })
  archive(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectService.archiveProject(organizationId, userId, projectId);
  }

  @Post(':id/members')
  @Permissions('EDIT_PROJECT')
  @ApiOperation({ summary: 'Add member to project' })
  @ApiResponse({ status: 201, description: 'Member added successfully.' })
  addMember(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectService.addProjectMember(organizationId, userId, projectId, dto);
  }

  @Delete(':id/members/:memberUserId')
  @Permissions('EDIT_PROJECT')
  @ApiOperation({ summary: 'Remove member from project' })
  @ApiResponse({ status: 200, description: 'Member removed successfully.' })
  removeMember(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.projectService.removeProjectMember(organizationId, userId, projectId, memberUserId);
  }

  @Patch(':id/settings')
  @Permissions('EDIT_PROJECT')
  @ApiOperation({ summary: 'Update project settings' })
  @ApiResponse({ status: 200, description: 'Project settings updated successfully.' })
  updateSettings(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectSettingsDto,
  ) {
    return this.projectService.updateProjectSettings(organizationId, userId, projectId, dto);
  }
}
