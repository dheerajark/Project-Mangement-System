import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardVisibility, WidgetType } from '@prisma/client';

export class InitialWidgetDto {
  @ApiProperty({ description: 'Title of the widget' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: WidgetType, description: 'Type of widget' })
  @IsEnum(WidgetType)
  type: WidgetType;

  @ApiPropertyOptional({ description: 'Position index of widget', default: 0 })
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({
    description: 'Width of widget: FULL, HALF, THIRD, QUARTER',
    default: 'HALF',
  })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({
    description: 'JSON string configuration for widget filters and options',
  })
  @IsOptional()
  config?: any;
}

export class CreateDashboardDto {
  @ApiProperty({ description: 'Name of the dashboard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Optional description of dashboard' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Project ID if scoped to a project; null for portal-wide',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    enum: DashboardVisibility,
    default: DashboardVisibility.PRIVATE,
  })
  @IsOptional()
  @IsEnum(DashboardVisibility)
  visibility?: DashboardVisibility;

  @ApiPropertyOptional({
    description: 'Initial template type e.g. BLANK, PROJECT_OVERVIEW, TASKS_HEALTH, TIME_TRACKING',
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional({
    type: [InitialWidgetDto],
    description: 'Optional initial list of widgets',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialWidgetDto)
  widgets?: InitialWidgetDto[];
}
