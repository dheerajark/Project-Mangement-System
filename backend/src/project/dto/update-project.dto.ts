import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectVisibility, ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @ApiProperty({ example: 'Updated Project Name', description: 'The name of the project', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Updated description', description: 'The description of the project', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-03T00:00:00.000Z', description: 'Start date of the project', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z', description: 'End date of the project', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'ORGANIZATION', enum: ProjectVisibility, description: 'Visibility of the project', required: false })
  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;

  @ApiProperty({ example: 'ACTIVE', enum: ProjectStatus, description: 'Status of the project', required: false })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;
}
