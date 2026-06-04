import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogManualTimeDto {
  @ApiProperty({ example: 2.5, description: 'The number of hours worked' })
  @IsNumber()
  @Min(0.01)
  hours: number;

  @ApiProperty({ example: '2026-06-04T00:00:00.000Z', description: 'The date work was performed' })
  @IsDateString()
  loggedAt: string;

  @ApiPropertyOptional({ example: 'Implemented secure auth logs', description: 'Notes on the work performed' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the hours are billable' })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiProperty({ example: 'project-uuid-here', description: 'The project ID' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ example: 'task-uuid-here', description: 'The task ID logged against' })
  @IsOptional()
  @IsString()
  taskId?: string;
}
