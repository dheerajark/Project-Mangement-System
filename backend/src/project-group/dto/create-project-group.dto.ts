import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectGroupDto {
  @ApiProperty({
    example: 'Client Projects',
    description: 'Name of the project group',
  })
  @IsString()
  @IsNotEmpty({ message: 'Group name is required' })
  name: string;

  @ApiProperty({
    example: 'Projects associated with external enterprise clients',
    description: 'Description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '#6366f1',
    description: 'Hex color code for UI badge',
    required: false,
  })
  @IsString()
  @IsOptional()
  color?: string;
}
