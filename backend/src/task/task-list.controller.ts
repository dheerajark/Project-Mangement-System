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
import { TaskListService } from './task-list.service';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { CreateTaskListCommentDto } from './dto/create-task-list-comment.dto';
import { UpdateTaskListCommentDto } from './dto/update-task-list-comment.dto';
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

@ApiTags('Task Lists')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class TaskListController {
  constructor(private taskListService: TaskListService) {}

  @Get('projects/:projectId/task-lists')
  @Permissions('VIEW_TASK')
  @ApiOperation({
    summary: 'Get all task lists for a project with completion stats',
  })
  @ApiResponse({
    status: 200,
    description: 'Task lists retrieved successfully.',
  })
  findAllForProject(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.taskListService.getTaskListsForProject(
      organizationId,
      userId,
      projectId,
    );
  }

  @Post('projects/:projectId/task-lists')
  @Permissions('CREATE_TASK')
  @ApiOperation({ summary: 'Create a new task list for a project' })
  @ApiResponse({ status: 201, description: 'Task list created successfully.' })
  create(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskListDto,
  ) {
    return this.taskListService.createTaskList(
      organizationId,
      userId,
      projectId,
      dto,
    );
  }

  @Get('task-lists/:id')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get task list details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Task list details retrieved successfully.',
  })
  findOne(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.taskListService.getTaskListById(organizationId, userId, id);
  }

  @Patch('task-lists/:id')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update a task list' })
  @ApiResponse({ status: 200, description: 'Task list updated successfully.' })
  update(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskListDto,
  ) {
    return this.taskListService.updateTaskList(organizationId, userId, id, dto);
  }

  @Delete('task-lists/:id')
  @Permissions('ARCHIVE_TASK')
  @ApiOperation({ summary: 'Delete a task list' })
  @ApiResponse({ status: 200, description: 'Task list deleted successfully.' })
  remove(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
    @Query('unassignTasks') unassignTasks?: string,
  ) {
    const shouldUnassign = unassignTasks !== 'false';
    return this.taskListService.deleteTaskList(
      organizationId,
      userId,
      id,
      shouldUnassign,
    );
  }

  @Patch('projects/:projectId/task-lists/reorder')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Reorder task lists in a project' })
  @ApiResponse({
    status: 200,
    description: 'Task lists reordered successfully.',
  })
  reorder(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('projectId') projectId: string,
    @Body('listIds') listIds: string[],
  ) {
    return this.taskListService.reorderTaskLists(
      organizationId,
      userId,
      projectId,
      listIds || [],
    );
  }

  // Task List Comments
  @Post('task-lists/:id/comments')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Add a comment to a task list' })
  @ApiResponse({ status: 201, description: 'Comment added successfully.' })
  addComment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskListId: string,
    @Body() dto: CreateTaskListCommentDto,
  ) {
    return this.taskListService.createTaskListComment(
      organizationId,
      userId,
      taskListId,
      dto,
    );
  }

  @Get('task-lists/:id/comments')
  @Permissions('VIEW_TASK')
  @ApiOperation({ summary: 'Get all comments for a task list' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully.' })
  getComments(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') taskListId: string,
  ) {
    return this.taskListService.getTaskListComments(
      organizationId,
      userId,
      taskListId,
    );
  }

  @Patch('task-lists/comments/:commentId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Update a task list comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully.' })
  updateComment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskListCommentDto,
  ) {
    return this.taskListService.updateTaskListComment(
      organizationId,
      userId,
      commentId,
      dto,
    );
  }

  @Delete('task-lists/comments/:commentId')
  @Permissions('EDIT_TASK')
  @ApiOperation({ summary: 'Delete a task list comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully.' })
  deleteComment(
    @TenantId() organizationId: string,
    @GetCurrentUserId() userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.taskListService.deleteTaskListComment(
      organizationId,
      userId,
      commentId,
    );
  }
}
