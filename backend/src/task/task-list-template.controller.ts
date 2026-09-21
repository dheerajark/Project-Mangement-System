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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApplyTaskListTemplateDto } from './dto/apply-task-list-template.dto';
import { UpdateTaskListTemplateDto } from './dto/update-task-list-template.dto';
import { TaskListTemplateService } from './task-list-template.service';

@ApiTags('Task List Templates')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class TaskListTemplateController {
  constructor(private service: TaskListTemplateService) {}

  @Get('task-list-templates')
  @Permissions('VIEW_TASK')
  findAll(@TenantId() organizationId: string) {
    return this.service.findAll(organizationId);
  }

  @Post('task-lists/:id/templates')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Create a reusable template from a task list' })
  createFromTaskList(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.service.createFromTaskList(organizationId, userId, id);
  }

  @Patch('task-list-templates/:id')
  @Permissions('EDIT_TASK')
  update(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskListTemplateDto,
  ) {
    return this.service.update(organizationId, userId, id, dto);
  }

  @Post('task-list-templates/:id/duplicate')
  @Permissions('CREATE_TASK')
  duplicate(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.service.duplicate(organizationId, userId, id);
  }

  @Delete('task-list-templates/:id')
  @Permissions('ARCHIVE_TASK')
  remove(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(organizationId, userId, id);
  }

  @Post('projects/:projectId/task-list-templates/:templateId/apply')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Apply a task list template to a project' })
  apply(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Param('templateId') templateId: string,
    @Body() dto: ApplyTaskListTemplateDto,
  ) {
    return this.service.apply(
      organizationId,
      userId,
      projectId,
      templateId,
      dto,
    );
  }
}
