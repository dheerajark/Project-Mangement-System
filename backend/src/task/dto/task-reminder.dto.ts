import {
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  ReminderType,
  ReminderRecipientType,
  ReminderStatus,
} from '@prisma/client';

export class CreateTaskReminderDto {
  @IsEnum(ReminderType, { message: 'Invalid reminder type' })
  type: ReminderType;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetMinutes?: number;

  @IsOptional()
  @IsString()
  timeOfDay?: string;

  @IsOptional()
  @IsDateString()
  customDate?: string;

  @IsOptional()
  @IsEnum(ReminderRecipientType)
  recipientType?: ReminderRecipientType;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsBoolean()
  repeatDailyIfOverdue?: boolean;
}

export class UpdateTaskReminderDto {
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetMinutes?: number;

  @IsOptional()
  @IsString()
  timeOfDay?: string;

  @IsOptional()
  @IsDateString()
  customDate?: string;

  @IsOptional()
  @IsEnum(ReminderRecipientType)
  recipientType?: ReminderRecipientType;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsBoolean()
  repeatDailyIfOverdue?: boolean;

  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;
}
