import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskListFlag } from '@prisma/client';

export class UpdateTaskListTemplateDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TaskListFlag, required: false })
  @IsEnum(TaskListFlag)
  @IsOptional()
  flag?: TaskListFlag;
}
