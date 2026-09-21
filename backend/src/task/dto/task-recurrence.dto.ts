import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RecurrenceFrequency,
  RecurrenceEndType,
  RecurrenceNonWorkingDayAction,
  RecurrenceStatus,
} from '@prisma/client';

export class CreateTaskRecurrenceDto {
  @ApiProperty({
    enum: RecurrenceFrequency,
    description: 'Recurrence frequency pattern',
    example: RecurrenceFrequency.WEEKLY,
  })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({
    description: 'Repeat every N days/weeks/months/years',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number = 1;

  @ApiPropertyOptional({
    description:
      'Comma-separated days of the week (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun or 0=Sun..6=Sat). E.g. "1,3,5"',
    example: '1,3,5',
  })
  @IsOptional()
  @IsString()
  daysOfWeek?: string;

  @ApiPropertyOptional({
    description: 'Specific day of the month (1-31, or -1 for last day of month)',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(31)
  dayOfMonth?: number;

  @ApiPropertyOptional({
    description:
      'Relative week of the month (1=1st, 2=2nd, 3=3rd, 4=4th, -1=last week)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(4)
  weekOfMonth?: number;

  @ApiPropertyOptional({
    description:
      'Relative day of the week for monthly recurrence (1=Mon, 2=Tue... 7=Sun)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  relativeDayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Month of the year (1-12) for yearly recurrence',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthOfYear?: number;

  @ApiPropertyOptional({
    enum: RecurrenceNonWorkingDayAction,
    description:
      'Action if scheduled date falls on non-working day or weekend',
    default: RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY,
    example: RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY,
  })
  @IsOptional()
  @IsEnum(RecurrenceNonWorkingDayAction)
  nonWorkingDayAction?: RecurrenceNonWorkingDayAction =
    RecurrenceNonWorkingDayAction.NEXT_WORKING_DAY;

  @ApiProperty({
    description: 'Start date of the recurrence series (ISO string)',
    example: '2026-10-01T09:00:00.000Z',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    enum: RecurrenceEndType,
    description: 'End condition of the recurrence series',
    default: RecurrenceEndType.NEVER,
    example: RecurrenceEndType.NEVER,
  })
  @IsOptional()
  @IsEnum(RecurrenceEndType)
  endType?: RecurrenceEndType = RecurrenceEndType.NEVER;

  @ApiPropertyOptional({
    description:
      'End date cutoff if endType is ON_DATE (ISO string)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Max occurrences count if endType is AFTER_OCCURRENCES',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number;

  @ApiPropertyOptional({
    description:
      'Whether to clone subtasks structure when generating new occurrences',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  cloneSubtasks?: boolean = true;

  @ApiPropertyOptional({
    description:
      'Whether to copy attachment metadata when generating new occurrences',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cloneAttachments?: boolean = false;
}

export class UpdateTaskRecurrenceDto {
  @ApiPropertyOptional({ enum: RecurrenceFrequency })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  daysOfWeek?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(31)
  dayOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(4)
  weekOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  relativeDayOfWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthOfYear?: number;

  @ApiPropertyOptional({ enum: RecurrenceNonWorkingDayAction })
  @IsOptional()
  @IsEnum(RecurrenceNonWorkingDayAction)
  nonWorkingDayAction?: RecurrenceNonWorkingDayAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ enum: RecurrenceEndType })
  @IsOptional()
  @IsEnum(RecurrenceEndType)
  endType?: RecurrenceEndType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cloneSubtasks?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cloneAttachments?: boolean;

  @ApiPropertyOptional({ enum: RecurrenceStatus })
  @IsOptional()
  @IsEnum(RecurrenceStatus)
  status?: RecurrenceStatus;
}

export class RecurrenceSchedulePreviewDto extends CreateTaskRecurrenceDto {
  @ApiPropertyOptional({
    description: 'Number of upcoming occurrence dates to preview',
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  previewCount?: number = 5;
}
