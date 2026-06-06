import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignProfileDto {
  @ApiProperty({ example: 'profile-uuid-here' })
  @IsString()
  @IsNotEmpty()
  profileId: string;
}
