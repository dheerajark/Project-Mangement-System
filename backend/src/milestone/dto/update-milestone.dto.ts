import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MilestoneStatus } from '@prisma/client';

export class UpdateMilestoneDto {
  @ApiProperty({ example: 'Beta Release v2', description: 'The title of the milestone', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Release version 1.0.0-beta.2', description: 'The description of the milestone', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-05T00:00:00.000Z', description: 'Start date of the milestone', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-06-20T00:00:00.000Z', description: 'Due date of the milestone', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ example: 'IN_PROGRESS', enum: MilestoneStatus, description: 'The status of the milestone', required: false })
  @IsEnum(MilestoneStatus)
  @IsOptional()
  status?: MilestoneStatus;

  @ApiProperty({ example: 1, description: 'Sorting position of the milestone', required: false })
  @IsNumber()
  @IsOptional()
  position?: number;
}
