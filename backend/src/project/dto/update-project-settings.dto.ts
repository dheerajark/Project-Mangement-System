import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Whether to allow time tracking in the project',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allowTimeTracking?: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether to allow issue tracking in the project',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allowIssueTracking?: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether to allow file uploads in the project',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allowFileUploads?: boolean;

  @ApiProperty({
    example:
      'overview,tasks,members,milestones,issues,timeLogs,reports,documents',
    description: 'Comma-separated enabled tab keys',
    required: false,
  })
  @IsString()
  @IsOptional()
  enabledTabs?: string;
}
