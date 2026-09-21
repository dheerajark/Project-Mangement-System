import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DashboardAccessLevel } from '@prisma/client';

export class ShareDashboardDto {
  @ApiProperty({ description: 'User ID to share the dashboard with' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: DashboardAccessLevel,
    default: DashboardAccessLevel.VIEWER,
  })
  @IsEnum(DashboardAccessLevel)
  accessLevel: DashboardAccessLevel;
}
