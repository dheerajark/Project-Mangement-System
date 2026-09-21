import { IsOptional, IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({ description: 'New version string e.g., 1.1 or 2.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ description: 'File URL or path for new version' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsInt()
  fileSize?: number;

  @ApiPropertyOptional({ description: 'Version notes or changelog' })
  @IsOptional()
  @IsString()
  notes?: string;
}
