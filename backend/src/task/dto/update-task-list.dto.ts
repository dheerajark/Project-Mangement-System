import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskListFlag, TaskListStatus } from '@prisma/client';

export class UpdateTaskListDto {
  @ApiProperty({
    example: 'Sprint 1 - Core Foundation',
    description: 'Name of the task list',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Tasks and deliverables for Phase 1',
    description: 'Description of the task list',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'INTERNAL',
    enum: TaskListFlag,
    description: 'Visibility flag: INTERNAL or EXTERNAL',
    required: false,
  })
  @IsEnum(TaskListFlag)
  @IsOptional()
  flag?: TaskListFlag;

  @ApiProperty({
    example: 'ACTIVE',
    enum: TaskListStatus,
    description: 'Status of the task list: ACTIVE or COMPLETED',
    required: false,
  })
  @IsEnum(TaskListStatus)
  @IsOptional()
  status?: TaskListStatus;

  @ApiProperty({
    example: 'milestone-uuid-here',
    description: 'Optional milestone association',
    required: false,
  })
  @IsString()
  @IsOptional()
  milestoneId?: string | null;

  @ApiProperty({ example: 1, description: 'Sort position', required: false })
  @IsNumber()
  @IsOptional()
  position?: number;

  @ApiProperty({
    example: 'target-project-uuid',
    description: 'Move task list to another project',
    required: false,
  })
  @IsString()
  @IsOptional()
  targetProjectId?: string;

  @ApiProperty({
    example: 'MARK_DONE',
    enum: ['MARK_DONE', 'MOVE', 'DELETE', 'KEEP'],
    description:
      'Action for remaining open tasks when completing task list: MARK_DONE, MOVE, DELETE, KEEP',
    required: false,
  })
  @IsString()
  @IsOptional()
  resolveOpenTasks?: 'MARK_DONE' | 'MOVE' | 'DELETE' | 'KEEP';

  @ApiProperty({
    example: 'target-tasklist-uuid',
    description:
      'Target task list ID if moving open tasks (null for General/Unassigned)',
    required: false,
  })
  @IsString()
  @IsOptional()
  targetTaskListId?: string | null;
}
