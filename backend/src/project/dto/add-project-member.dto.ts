import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberRole } from '@prisma/client';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'user-uuid-here', description: 'The ID of the user to add to the project' })
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ example: 'MEMBER', enum: ProjectMemberRole, description: 'The role of the member in the project', default: ProjectMemberRole.MEMBER })
  @IsEnum(ProjectMemberRole)
  @IsNotEmpty({ message: 'Role is required' })
  role: ProjectMemberRole;
}
