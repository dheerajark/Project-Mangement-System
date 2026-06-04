import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MilestoneStatus } from '@prisma/client';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Beta Release', description: 'The title of the milestone' })
  @IsString()
  @IsNotEmpty({ message: 'Milestone title is required' })
  title: string;

  @ApiProperty({ example: 'Release version 1.0.0-beta with core features', description: 'The description of the milestone', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z', description: 'Start date of the milestone', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-06-15T00:00:00.000Z', description: 'Due date of the milestone', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ example: 'PLANNED', enum: MilestoneStatus, description: 'The status of the milestone', required: false })
  @IsEnum(MilestoneStatus)
  @IsOptional()
  status?: MilestoneStatus;

  @ApiProperty({ example: 0, description: 'Sorting position of the milestone', required: false })
  @IsNumber()
  @IsOptional()
  position?: number;
}
