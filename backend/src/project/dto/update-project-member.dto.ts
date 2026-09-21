import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberRole } from '@prisma/client';

export class UpdateProjectMemberDto {
  @ApiProperty({
    example: 'MANAGER',
    enum: ProjectMemberRole,
    description: 'The role of the member in the project',
    required: false,
  })
  @IsEnum(ProjectMemberRole)
  @IsOptional()
  role?: ProjectMemberRole;

  @ApiProperty({
    example: 75.0,
    description: 'Staff hourly rate for project billing',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  hourlyRate?: number;
}
