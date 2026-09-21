import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority, TaskType, TaskBillingType } from '@prisma/client';

export class UpdateTaskDto {
  @ApiProperty({
    example: 'Updated title',
    description: 'The title of the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'The description of the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'IN_PROGRESS',
    enum: TaskStatus,
    description: 'The status of the task',
    required: false,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    example: 'HIGH',
    enum: TaskPriority,
    description: 'The priority of the task',
    required: false,
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({
    example: 'BUG',
    enum: TaskType,
    description: 'The type of the task',
    required: false,
  })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({
    example: 75,
    description: 'Progress percentage completion (0-100)',
    required: false,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiProperty({
    example: 'BILLABLE',
    enum: TaskBillingType,
    description: 'Task billing type',
    required: false,
  })
  @IsEnum(TaskBillingType)
  @IsOptional()
  billingType?: TaskBillingType;

  @ApiProperty({
    example: 'frontend, urgent',
    description: 'Comma separated tags',
    required: false,
  })
  @IsString()
  @IsOptional()
  tags?: string | null;

  @ApiProperty({
    example: '{"environment":"staging"}',
    description: 'JSON serialized custom fields',
    required: false,
  })
  @IsString()
  @IsOptional()
  customFields?: string | null;

  @ApiProperty({
    example: 8,
    description: 'Estimated hours to complete',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({
    example: '2026-06-10T00:00:00.000Z',
    description: 'Start date of the task. Pass null to clear.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string | null;

  @ApiProperty({
    example: '2026-06-20T00:00:00.000Z',
    description: 'Due date of the task',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({
    example: 'user-uuid-here',
    description: 'The ID of the user assigned to the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @ApiProperty({
    example: 'milestone-uuid-here',
    description:
      'The ID of the milestone associated with the task. Pass null to unlink.',
    required: false,
  })
  @IsString()
  @IsOptional()
  milestoneId?: string | null;

  @ApiProperty({
    example: 'task-list-uuid-here',
    description: 'The ID of the task list. Pass null to unlink.',
    required: false,
  })
  @IsString()
  @IsOptional()
  taskListId?: string | null;

  @ApiProperty({
    example: 'parent-task-uuid-here',
    description: 'The ID of parent task if subtask. Pass null to unlink.',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentTaskId?: string | null;
}
