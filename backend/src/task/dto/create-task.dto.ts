import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority, TaskType } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement Project Seeding', description: 'The title of the task' })
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  title: string;

  @ApiProperty({ example: 'Seeding of initial roles & permissions', description: 'The description of the task', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'TODO', enum: TaskStatus, description: 'The status of the task', required: false })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ example: 'MEDIUM', enum: TaskPriority, description: 'The priority of the task', required: false })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ example: 'TASK', enum: TaskType, description: 'The type of the task', required: false })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiProperty({ example: 4.5, description: 'Estimated hours to complete', required: false })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;

  @ApiProperty({ example: '2026-06-15T00:00:00.000Z', description: 'Due date of the task', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ example: 'project-uuid-here', description: 'The ID of the project the task belongs to' })
  @IsString()
  @IsNotEmpty({ message: 'Project ID is required' })
  projectId: string;

  @ApiProperty({ example: 'user-uuid-here', description: 'The ID of the user assigned to the task', required: false })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({ example: 'milestone-uuid-here', description: 'The ID of the milestone associated with the task', required: false })
  @IsString()
  @IsOptional()
  milestoneId?: string;
}
