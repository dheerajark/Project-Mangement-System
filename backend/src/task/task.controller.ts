import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  CreateAttachmentMetadataDto,
  BulkCreateAttachmentMetadataDto,
  UpdateAttachmentMetadataDto,
  LinkDocumentToTaskDto,
} from './dto/create-attachment-metadata.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';
import {
  CreateTaskDependencyDto,
  UpdateTaskDependencyDto,
} from './dto/task-dependency.dto';
import { BulkTaskActionDto } from './dto/bulk-task-action.dto';
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
import { TaskStatus, TaskPriority, TaskType } from '@prisma/client';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Get('tasks')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all tasks across projects with filtering' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully.' })
  getAllTasks(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('type') type?: TaskType,
    @Query('search') search?: string,
  ) {
    return this.taskService.getAllTasks(organizationId, userId, permissions, {
      projectId,
      assigneeId,
      status,
      priority,
      type,
      search,
    });
  }

  @Post('tasks/bulk')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Perform bulk action on multiple tasks' })
  @ApiResponse({ status: 200, description: 'Bulk task action completed successfully.' })
  bulkAction(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('permissions') permissions: string[],
    @Body() dto: BulkTaskActionDto,
  ) {
    return this.taskService.bulkTaskAction(
      organizationId,
      userId,
      permissions,
      dto,
    );
  }

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
  @ApiResponse({
    status: 200,
    description: 'Tasks list retrieved successfully.',
  })
  findAllForProject(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.taskService.getTasksForProject(
      organizationId,
      userId,
      projectId,
    );
  }

  @Get('tasks/assigned')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all tasks assigned to the logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'Assigned tasks list retrieved successfully.',
  })
  findAssigned(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
  ) {
    return this.taskService.getAssignedTasks(organizationId, userId);
  }

  @Get('tasks/:id')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get task details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Task details retrieved successfully.',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Task status updated successfully.',
  })
  updateStatus(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateTaskStatus(
      organizationId,
      userId,
      taskId,
      dto,
    );
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

  @Delete('tasks/:id')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Delete a task and its subtasks' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully.' })
  delete(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.deleteTask(organizationId, userId, taskId);
  }

  @Post('tasks/:id/clone')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Duplicate/Clone an existing task' })
  @ApiResponse({ status: 201, description: 'Task cloned successfully.' })
  clone(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.cloneTask(organizationId, userId, taskId);
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

  @Get('tasks/:id/attachments')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all attachments and linked documents for a task' })
  @ApiResponse({
    status: 200,
    description: 'Attachments retrieved successfully.',
  })
  getAttachments(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.getAttachments(organizationId, userId, taskId);
  }

  @Post('tasks/:id/attachments')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Upload single attachment metadata to a task' })
  @ApiResponse({
    status: 201,
    description: 'Attachment registered successfully.',
  })
  addAttachment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateAttachmentMetadataDto,
  ) {
    return this.taskService.createAttachment(
      organizationId,
      userId,
      taskId,
      dto,
    );
  }

  @Post('tasks/:id/attachments/bulk')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Upload multiple attachments to a task in bulk' })
  @ApiResponse({
    status: 201,
    description: 'Attachments registered successfully in bulk.',
  })
  addAttachmentsBulk(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: BulkCreateAttachmentMetadataDto,
  ) {
    return this.taskService.createAttachmentsBulk(
      organizationId,
      userId,
      taskId,
      dto,
    );
  }

  @Patch('tasks/:id/attachments/:attachmentId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Rename/update an attachment on a task' })
  @ApiResponse({
    status: 200,
    description: 'Attachment updated successfully.',
  })
  updateAttachment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() dto: UpdateAttachmentMetadataDto,
  ) {
    return this.taskService.updateAttachment(
      organizationId,
      userId,
      taskId,
      attachmentId,
      dto,
    );
  }

  @Delete('tasks/:id/attachments/:attachmentId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Delete an attachment from a task' })
  @ApiResponse({
    status: 200,
    description: 'Attachment deleted successfully.',
  })
  deleteAttachment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.taskService.deleteAttachment(
      organizationId,
      userId,
      taskId,
      attachmentId,
    );
  }

  @Post('tasks/:id/attachments/link-document')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Link an existing project document to a task' })
  @ApiResponse({
    status: 200,
    description: 'Project document linked to task successfully.',
  })
  linkDocument(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: LinkDocumentToTaskDto,
  ) {
    return this.taskService.linkDocumentToTask(
      organizationId,
      userId,
      taskId,
      dto,
    );
  }

  @Delete('tasks/:id/attachments/unlink-document/:documentId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Unlink a project document from a task' })
  @ApiResponse({
    status: 200,
    description: 'Project document unlinked from task successfully.',
  })
  unlinkDocument(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.taskService.unlinkDocumentFromTask(
      organizationId,
      userId,
      taskId,
      documentId,
    );
  }

  @Post('tasks/:id/watchers')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Toggle watching status for a task' })
  @ApiResponse({
    status: 200,
    description: 'Watcher state toggled successfully.',
  })
  toggleWatcher(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.toggleWatcher(organizationId, userId, taskId);
  }

  @Get('tasks/:id/subtasks')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all subtasks for a task' })
  @ApiResponse({ status: 200, description: 'Subtasks retrieved successfully.' })
  getSubtasks(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.getSubtasks(organizationId, userId, taskId);
  }

  @Post('tasks/:id/subtasks')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Create a subtask for a parent task' })
  @ApiResponse({ status: 201, description: 'Subtask created successfully.' })
  createSubtask(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.createSubtask(organizationId, userId, taskId, dto);
  }
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get Kanban Board columns for a project' })
  @ApiResponse({
    status: 200,
    description: 'Kanban board retrieved successfully.',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Task position and/or status updated successfully.',
  })
  reorder(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: ReorderTaskDto,
  ) {
    return this.taskService.reorderTask(organizationId, userId, taskId, dto);
  }

  // ─── Task Dependencies Endpoints ──────────────────────────────────────────

  @Post('tasks/:id/dependencies')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Create a dependency for a task' })
  @ApiResponse({
    status: 201,
    description: 'Task dependency created successfully.',
  })
  createDependency(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateTaskDependencyDto,
  ) {
    return this.taskService.createDependency(
      organizationId,
      userId,
      taskId,
      dto,
    );
  }

  @Get('tasks/:id/dependencies')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all dependencies for a task' })
  @ApiResponse({
    status: 200,
    description: 'Task dependencies retrieved successfully.',
  })
  getDependencies(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.getTaskDependencies(organizationId, userId, taskId);
  }

  @Get('projects/:projectId/dependencies')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all dependencies for a project' })
  @ApiResponse({
    status: 200,
    description: 'Project dependencies retrieved successfully.',
  })
  getProjectDependencies(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.taskService.getProjectDependencies(
      organizationId,
      userId,
      projectId,
    );
  }

  @Patch('tasks/dependencies/:dependencyId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update a task dependency' })
  @ApiResponse({
    status: 200,
    description: 'Task dependency updated successfully.',
  })
  updateDependency(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('dependencyId') dependencyId: string,
    @Body() dto: UpdateTaskDependencyDto,
  ) {
    return this.taskService.updateDependency(
      organizationId,
      userId,
      dependencyId,
      dto,
    );
  }

  @Delete('tasks/dependencies/:dependencyId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Delete a task dependency' })
  @ApiResponse({
    status: 200,
    description: 'Task dependency deleted successfully.',
  })
  deleteDependency(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('dependencyId') dependencyId: string,
  ) {
    return this.taskService.deleteDependency(
      organizationId,
      userId,
      dependencyId,
    );
  }
}
