import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberDto {
  @ApiProperty({ example: 'SUSPENDED', enum: ['ACTIVE', 'SUSPENDED'], required: false })
  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;

  @ApiProperty({ example: 'role-uuid-here', required: false })
  @IsString()
  @IsOptional()
  roleId?: string;
}
