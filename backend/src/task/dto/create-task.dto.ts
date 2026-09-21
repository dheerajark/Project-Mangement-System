import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority, TaskType, TaskBillingType } from '@prisma/client';
import { CreateTaskRecurrenceDto } from './task-recurrence.dto';

export class CreateTaskDto {
  @ApiProperty({
    example: 'Implement Project Seeding',
    description: 'The title of the task',
  })
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  title: string;

  @ApiProperty({
    example: 'Seeding of initial roles & permissions',
    description: 'The description of the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'TODO',
    enum: TaskStatus,
    description: 'The status of the task',
    required: false,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    example: 'MEDIUM',
    enum: TaskPriority,
    description: 'The priority of the task',
    required: false,
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({
    example: 'TASK',
    enum: TaskType,
    description: 'The type of the task',
    required: false,
  })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({
    example: 0,
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
  tags?: string;

  @ApiProperty({
    example: '{"environment":"staging","release":"v1.2"}',
    description: 'JSON serialized custom fields',
    required: false,
  })
  @IsString()
  @IsOptional()
  customFields?: string;

  @ApiProperty({
    example: 4.5,
    description: 'Estimated hours to complete',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({
    example: '2026-06-10T00:00:00.000Z',
    description: 'Start date of the task',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    example: '2026-06-15T00:00:00.000Z',
    description: 'Due date of the task',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({
    example: 'project-uuid-here',
    description: 'The ID of the project the task belongs to',
    required: false,
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    example: 'user-uuid-here',
    description: 'The ID of the user assigned to the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({
    example: 'milestone-uuid-here',
    description: 'The ID of the milestone associated with the task',
    required: false,
  })
  @IsString()
  @IsOptional()
  milestoneId?: string;

  @ApiProperty({
    example: 'task-list-uuid-here',
    description: 'The ID of the task list the task belongs to',
    required: false,
  })
  @IsString()
  @IsOptional()
  taskListId?: string;

  @ApiPropertyOptional({
    example: 'parent-task-uuid-here',
    description: 'The ID of the parent task if this is a subtask',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentTaskId?: string;

  @ApiPropertyOptional({
    type: () => CreateTaskRecurrenceDto,
    description: 'Optional recurrence settings to configure for this task upon creation',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTaskRecurrenceDto)
  recurrence?: CreateTaskRecurrenceDto;
}
