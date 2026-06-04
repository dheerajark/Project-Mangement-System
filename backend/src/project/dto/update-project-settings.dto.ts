import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProjectSettingsDto {
  @ApiProperty({ example: true, description: 'Whether to allow time tracking in the project', required: false })
  @IsBoolean()
  @IsOptional()
  allowTimeTracking?: boolean;

  @ApiProperty({ example: true, description: 'Whether to allow issue tracking in the project', required: false })
  @IsBoolean()
  @IsOptional()
  allowIssueTracking?: boolean;

  @ApiProperty({ example: true, description: 'Whether to allow file uploads in the project', required: false })
  @IsBoolean()
  @IsOptional()
  allowFileUploads?: boolean;
}
