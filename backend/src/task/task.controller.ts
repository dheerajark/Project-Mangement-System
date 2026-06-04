import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateAttachmentMetadataDto } from './dto/create-attachment-metadata.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { GetCurrentUserId } from '../auth/decorators/get-current-user-id.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post('tasks')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully.' })
  create(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.createTask(organizationId, userId, dto);
  }

  @Get('projects/:projectId/tasks')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all tasks for a project' })
  @ApiResponse({ status: 200, description: 'Tasks list retrieved successfully.' })
  findAllForProject(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.taskService.getTasksForProject(organizationId, userId, projectId);
  }

  @Get('tasks/assigned')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all tasks assigned to the logged-in user' })
  @ApiResponse({ status: 200, description: 'Assigned tasks list retrieved successfully.' })
  findAssigned(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.taskService.getAssignedTasks(organizationId, userId);
  }

  @Get('tasks/:id')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get task details by ID' })
  @ApiResponse({ status: 200, description: 'Task details retrieved successfully.' })
  findOne(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.getTaskById(organizationId, userId, taskId);
  }

  @Patch('tasks/:id')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update task properties' })
  @ApiResponse({ status: 200, description: 'Task updated successfully.' })
  update(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(organizationId, userId, taskId, dto);
  }

  @Patch('tasks/:id/status')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update task status only' })
  @ApiResponse({ status: 200, description: 'Task status updated successfully.' })
  updateStatus(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateTaskStatus(organizationId, userId, taskId, dto);
  }

  @Post('tasks/:id/archive')
  @Permissions('ARCHIVE_TASK')
  @ApiOperation({ summary: 'Archive a task' })
  @ApiResponse({ status: 200, description: 'Task archived successfully.' })
  archive(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.archiveTask(organizationId, userId, taskId);
  }

  @Post('tasks/:id/comments')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiResponse({ status: 201, description: 'Comment added successfully.' })
  addComment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.taskService.createComment(organizationId, userId, taskId, dto);
  }

  @Post('tasks/:id/attachments')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Upload attachment metadata to a task' })
  @ApiResponse({ status: 201, description: 'Attachment registered successfully.' })
  addAttachment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateAttachmentMetadataDto,
  ) {
    return this.taskService.createAttachment(organizationId, userId, taskId, dto);
  }

  @Post('tasks/:id/watchers')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Toggle watching status for a task' })
  @ApiResponse({ status: 200, description: 'Watcher state toggled successfully.' })
  toggleWatcher(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.toggleWatcher(organizationId, userId, taskId);
  }

  @Get('projects/:projectId/board')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get Kanban Board columns for a project' })
  @ApiResponse({ status: 200, description: 'Kanban board retrieved successfully.' })
  getBoard(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.taskService.getKanbanBoard(organizationId, userId, projectId);
  }

  @Patch('tasks/:id/reorder')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Reorder a task position' })
  @ApiResponse({ status: 200, description: 'Task position and/or status updated successfully.' })
  reorder(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: ReorderTaskDto,
  ) {
    return this.taskService.reorderTask(organizationId, userId, taskId, dto);
  }
}
