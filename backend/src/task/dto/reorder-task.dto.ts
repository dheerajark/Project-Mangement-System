import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class ReorderTaskDto {
  @ApiProperty({ example: 5, description: 'The new position index for the task in the column' })
  @IsInt()
  @Min(0)
  position: number;

  @ApiPropertyOptional({ example: 'IN_PROGRESS', enum: TaskStatus, description: 'The new column status (if moving across columns)' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
