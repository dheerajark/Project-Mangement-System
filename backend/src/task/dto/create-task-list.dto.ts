import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskListFlag, TaskListStatus } from '@prisma/client';

export class CreateTaskListDto {
  @ApiProperty({
    example: 'Sprint 1 - Core Foundation',
    description: 'Name of the task list',
  })
  @IsString()
  @IsNotEmpty({ message: 'Task list name is required' })
  name: string;

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
    description:
      'Visibility flag: INTERNAL (team only) or EXTERNAL (visible to clients)',
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
  milestoneId?: string;

  @ApiProperty({ example: 0, description: 'Sort position', required: false })
  @IsNumber()
  @IsOptional()
  position?: number;
}
