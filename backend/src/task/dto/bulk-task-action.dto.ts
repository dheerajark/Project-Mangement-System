import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

export enum BulkTaskActionType {
  UPDATE_STATUS = 'UPDATE_STATUS',
  UPDATE_PRIORITY = 'UPDATE_PRIORITY',
  UPDATE_ASSIGNEE = 'UPDATE_ASSIGNEE',
  UPDATE_DATES = 'UPDATE_DATES',
  MOVE_TASK_LIST = 'MOVE_TASK_LIST',
  MOVE_MILESTONE = 'MOVE_MILESTONE',
  MARK_COMPLETED = 'MARK_COMPLETED',
  DELETE = 'DELETE',
}

export class BulkTaskActionDto {
  @ApiProperty({
    description: 'List of task IDs to perform the bulk action on',
    example: ['task-id-1', 'task-id-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  taskIds: string[];

  @ApiProperty({
    description: 'Bulk action to execute',
    enum: BulkTaskActionType,
    example: BulkTaskActionType.UPDATE_STATUS,
  })
  @IsEnum(BulkTaskActionType)
  @IsNotEmpty()
  action: BulkTaskActionType;

  @ApiPropertyOptional({
    description: 'New status when action is UPDATE_STATUS',
    enum: TaskStatus,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'New priority when action is UPDATE_PRIORITY',
    enum: TaskPriority,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'New assignee user ID when action is UPDATE_ASSIGNEE (null to unassign)',
  })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    description: 'Target Task List ID when action is MOVE_TASK_LIST (null for general)',
  })
  @IsOptional()
  @IsString()
  taskListId?: string | null;

  @ApiPropertyOptional({
    description: 'Target Milestone ID when action is MOVE_MILESTONE (null to unassign)',
  })
  @IsOptional()
  @IsString()
  milestoneId?: string | null;

  @ApiPropertyOptional({
    description: 'New start date in ISO format when action is UPDATE_DATES',
  })
  @IsOptional()
  @IsString()
  startDate?: string | null;

  @ApiPropertyOptional({
    description: 'New due date in ISO format when action is UPDATE_DATES',
  })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'Days to shift existing dates by (+N or -N days) when action is UPDATE_DATES',
  })
  @IsOptional()
  @IsNumber()
  shiftDays?: number;

  @ApiPropertyOptional({
    description: 'Task progress percentage (0-100)',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;
}
