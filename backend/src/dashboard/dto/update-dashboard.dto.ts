import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardVisibility } from '@prisma/client';

export class UpdateDashboardDto {
  @ApiPropertyOptional({ description: 'Updated name of the dashboard' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description of dashboard' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated project association (or null to make portal-wide)',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: DashboardVisibility })
  @IsOptional()
  @IsEnum(DashboardVisibility)
  visibility?: DashboardVisibility;

  @ApiPropertyOptional({ description: 'JSON string storing custom layout' })
  @IsOptional()
  @IsString()
  layout?: string;
}
