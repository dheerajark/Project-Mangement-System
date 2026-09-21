import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class ReorderTaskDto {
  @ApiProperty({
    example: 5,
    description: 'The new position index for the task in the column',
  })
  @IsInt()
  @Min(0)
  position: number;

  @ApiPropertyOptional({
    example: 'IN_PROGRESS',
    enum: TaskStatus,
    description: 'The new column status (if moving across columns)',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'The new task list ID (if moving across Task List Kanban columns)',
  })
  @IsOptional()
  @IsString()
  taskListId?: string | null;

  @ApiPropertyOptional({
    example: 'HIGH',
    enum: TaskPriority,
    description: 'The new priority (if moving across Priority Kanban columns)',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'The new assignee user ID (if moving across Assignee Kanban columns)',
  })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}

