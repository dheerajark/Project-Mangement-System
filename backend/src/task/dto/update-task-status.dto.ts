import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskStatusDto {
  @ApiProperty({ example: 'IN_PROGRESS', enum: TaskStatus, description: 'The new status of the task' })
  @IsEnum(TaskStatus)
  @IsNotEmpty({ message: 'Status is required' })
  status: TaskStatus;
}
