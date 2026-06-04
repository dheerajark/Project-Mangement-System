import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ example: 'newuser@example.com', description: 'The email address of the invitee' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'role-uuid-here', description: 'The ID of the role to assign to the invitee' })
  @IsString()
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;
}
