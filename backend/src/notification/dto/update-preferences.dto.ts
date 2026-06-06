import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  taskAssignment?: boolean;

  @IsBoolean()
  @IsOptional()
  taskComment?: boolean;

  @IsBoolean()
  @IsOptional()
  issueAssignment?: boolean;

  @IsBoolean()
  @IsOptional()
  issueComment?: boolean;

  @IsBoolean()
  @IsOptional()
  milestoneUpdate?: boolean;

  @IsBoolean()
  @IsOptional()
  timesheetSubmitted?: boolean;

  @IsBoolean()
  @IsOptional()
  timesheetApproved?: boolean;

  @IsBoolean()
  @IsOptional()
  timesheetRejected?: boolean;
}
