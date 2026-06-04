import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ example: 'abcdef123456...', description: 'The secure raw invitation token' })
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required' })
  token: string;

  @ApiProperty({ example: 'securePassword123', description: 'The new user password (min 6 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({ example: 'Jane', description: 'The first name of the user', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', description: 'The last name of the user', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;
}
