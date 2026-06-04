import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority, TaskType } from '@prisma/client';

export class UpdateTaskDto {
  @ApiProperty({ example: 'Updated title', description: 'The title of the task', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Updated description', description: 'The description of the task', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'IN_PROGRESS', enum: TaskStatus, description: 'The status of the task', required: false })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ example: 'HIGH', enum: TaskPriority, description: 'The priority of the task', required: false })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ example: 'BUG', enum: TaskType, description: 'The type of the task', required: false })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({ example: 8, description: 'Estimated hours to complete', required: false })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({ example: '2026-06-20T00:00:00.000Z', description: 'Due date of the task', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ example: 'user-uuid-here', description: 'The ID of the user assigned to the task', required: false })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({ example: 'milestone-uuid-here', description: 'The ID of the milestone associated with the task. Pass null to unlink.', required: false })
  @IsString()
  @IsOptional()
  milestoneId?: string;
}
