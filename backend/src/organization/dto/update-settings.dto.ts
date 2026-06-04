import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiProperty({ example: 'dark', required: false })
  @IsString()
  @IsOptional()
  theme?: string;

  @ApiProperty({ example: 'example.com', required: false })
  @IsString()
  @IsOptional()
  allowedEmailDomains?: string;

  @ApiProperty({ example: 'UTC', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ example: 'YYYY-MM-DD', required: false })
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @ApiProperty({ example: 'en', required: false })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ example: 'USD', required: false })
  @IsString()
  @IsOptional()
  currency?: string;
}
