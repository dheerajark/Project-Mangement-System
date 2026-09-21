import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ProjectVisibility,
  ProjectStatus,
  ProjectBudgetType,
  ProjectBillingMethod,
  TaskLayoutType,
} from '@prisma/client';

export class UpdateProjectDto {
  @ApiProperty({
    example: 'Updated Project Name',
    description: 'The name of the project',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Updated description',
    description: 'The description of the project',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2026-06-03T00:00:00.000Z',
    description: 'Start date of the project',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    example: '2026-12-31T00:00:00.000Z',
    description: 'End date of the project',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    example: 'ORGANIZATION',
    enum: ProjectVisibility,
    description: 'Visibility of the project',
    required: false,
  })
  @IsEnum(ProjectVisibility)
  @IsOptional()
  visibility?: ProjectVisibility;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ProjectStatus,
    description: 'Status of the project',
    required: false,
  })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    example: 'FIXED_COST',
    enum: ProjectBudgetType,
    description: 'Project budget type',
    required: false,
  })
  @IsEnum(ProjectBudgetType)
  @IsOptional()
  budgetType?: ProjectBudgetType;

  @ApiProperty({
    example: 50000,
    description: 'Project monetary budget amount',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  budgetAmount?: number;

  @ApiProperty({
    example: 250,
    description: 'Project total budgeted hours',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  budgetHours?: number;

  @ApiProperty({
    example: 'FIXED_RATE',
    enum: ProjectBillingMethod,
    description: 'Project billing method',
    required: false,
  })
  @IsEnum(ProjectBillingMethod)
  @IsOptional()
  billingMethod?: ProjectBillingMethod;

  @ApiProperty({
    example: 100,
    description: 'Project billing rate',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  billingRate?: number;

  @ApiProperty({
    example: 'ClientWork, Urgent',
    description: 'Comma separated tags',
    required: false,
  })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiProperty({
    example: false,
    description: 'Whether this project is a reusable template',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @ApiProperty({
    example: 'STANDARD',
    enum: TaskLayoutType,
    description: 'Task layout preference',
    required: false,
  })
  @IsEnum(TaskLayoutType)
  @IsOptional()
  taskLayout?: TaskLayoutType;

  @ApiProperty({ description: 'ID of project group', required: false })
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiProperty({ description: 'ID of assigned project owner', required: false })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiProperty({
    example: false,
    description: 'Strict project schedule enforcement',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isStrict?: boolean;

  @ApiProperty({
    example: '1,2,3,4,5',
    description: 'Comma separated working days (1=Mon, 7=Sun)',
    required: false,
  })
  @IsString()
  @IsOptional()
  workingDays?: string;

  @ApiProperty({
    example: 8.0,
    description: 'Working hours per day',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  hoursPerDay?: number;

  @ApiProperty({
    example: false,
    description: 'Allow client portal access for this project',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allowClientAccess?: boolean;
}
