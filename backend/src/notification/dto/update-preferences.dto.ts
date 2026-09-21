import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  taskAssignment?: boolean;

  @IsBoolean()
  @IsOptional()
  taskStatusChange?: boolean;

  @IsBoolean()
  @IsOptional()
  taskPriorityChange?: boolean;

  @IsBoolean()
  @IsOptional()
  taskDueDateChange?: boolean;

  @IsBoolean()
  @IsOptional()
  taskComment?: boolean;

  @IsBoolean()
  @IsOptional()
  taskMention?: boolean;

  @IsBoolean()
  @IsOptional()
  taskAttachment?: boolean;

  @IsBoolean()
  @IsOptional()
  taskReminder?: boolean;

  @IsBoolean()
  @IsOptional()
  taskOverdue?: boolean;

  @IsBoolean()
  @IsOptional()
  taskDependency?: boolean;

  @IsBoolean()
  @IsOptional()
  recurringTask?: boolean;

  @IsBoolean()
  @IsOptional()
  taskListComment?: boolean;

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

  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppNotifications?: boolean;
}
