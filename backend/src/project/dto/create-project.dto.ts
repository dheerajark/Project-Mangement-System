import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectVisibility, ProjectBudgetType, ProjectBillingMethod, TaskLayoutType } from '@prisma/client';

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

  @ApiProperty({ example: 'USD', description: 'Currency code', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'FIXED_COST', enum: ProjectBudgetType, description: 'Project budget type', required: false })
  @IsEnum(ProjectBudgetType)
  @IsOptional()
  budgetType?: ProjectBudgetType;

  @ApiProperty({ example: 50000, description: 'Project monetary budget amount', required: false })
  @IsNumber()
  @IsOptional()
  budgetAmount?: number;

  @ApiProperty({ example: 250, description: 'Project total budgeted hours', required: false })
  @IsNumber()
  @IsOptional()
  budgetHours?: number;

  @ApiProperty({ example: 'FIXED_RATE', enum: ProjectBillingMethod, description: 'Project billing method', required: false })
  @IsEnum(ProjectBillingMethod)
  @IsOptional()
  billingMethod?: ProjectBillingMethod;

  @ApiProperty({ example: 100, description: 'Project billing rate', required: false })
  @IsNumber()
  @IsOptional()
  billingRate?: number;

  @ApiProperty({ example: 'ClientWork, Urgent', description: 'Comma separated tags', required: false })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiProperty({ example: false, description: 'Whether this project is a reusable template', required: false })
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @ApiProperty({ example: 'STANDARD', enum: TaskLayoutType, description: 'Task layout preference', required: false })
  @IsEnum(TaskLayoutType)
  @IsOptional()
  taskLayout?: TaskLayoutType;

  @ApiProperty({ description: 'ID of baseline project/template to clone from', required: false })
  @IsString()
  @IsOptional()
  templateProjectId?: string;

  @ApiProperty({ example: true, description: 'Whether to clone tasks when creating from a template', required: false })
  @IsBoolean()
  @IsOptional()
  copyTasks?: boolean;

  @ApiProperty({ example: true, description: 'Whether to clone milestones when creating from a template', required: false })
  @IsBoolean()
  @IsOptional()
  copyMilestones?: boolean;

  @ApiProperty({ example: false, description: 'Whether to clone members when creating from a template', required: false })
  @IsBoolean()
  @IsOptional()
  copyMembers?: boolean;
}
