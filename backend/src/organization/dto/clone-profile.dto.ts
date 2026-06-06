import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloneProfileDto {
  @ApiProperty({ example: 'QA Engineer' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'QA specific permissions', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
