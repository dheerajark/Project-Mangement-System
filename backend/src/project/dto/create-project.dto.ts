import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectVisibility } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'My New Project', description: 'The name of the project' })
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  name: string;

  @ApiProperty({ example: 'This is a description of the project', description: 'The description of the project', required: false })
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

  @ApiProperty({ example: 'PRIVATE', enum: ProjectVisibility, description: 'Visibility of the project', required: false })
  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;
}
