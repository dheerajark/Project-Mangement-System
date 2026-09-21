import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DependencyType, DependencyLinkType } from '@prisma/client';

export class CreateTaskDependencyDto {
  @ApiPropertyOptional({
    description:
      'Predecessor task ID (the task that must come before). Required if setting predecessor from successor context.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  predecessorId?: string;

  @ApiPropertyOptional({
    description:
      'Successor task ID (the task that depends on this task). Required if setting successor from predecessor context.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  successorId?: string;

  @ApiPropertyOptional({
    enum: DependencyType,
    default: DependencyType.FINISH_TO_START,
    description: 'Dependency relationship type (FS, SS, FF, SF)',
  })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Lag duration in working days (positive for lag/delay, negative for lead/advance)',
  })
  @IsOptional()
  @IsInt()
  lag?: number;

  @ApiPropertyOptional({
    enum: DependencyLinkType,
    default: DependencyLinkType.HARD,
    description:
      'Link type: HARD auto-reschedules successor dates, SOFT maintains relationship without auto-rescheduling',
  })
  @IsOptional()
  @IsEnum(DependencyLinkType)
  linkType?: DependencyLinkType;
}

export class UpdateTaskDependencyDto {
  @ApiPropertyOptional({
    enum: DependencyType,
    description: 'Dependency relationship type (FS, SS, FF, SF)',
  })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;

  @ApiPropertyOptional({
    description:
      'Lag duration in working days (positive for lag/delay, negative for lead/advance)',
  })
  @IsOptional()
  @IsInt()
  lag?: number;

  @ApiPropertyOptional({
    enum: DependencyLinkType,
    description:
      'Link type: HARD auto-reschedules successor dates, SOFT maintains relationship without auto-rescheduling',
  })
  @IsOptional()
  @IsEnum(DependencyLinkType)
  linkType?: DependencyLinkType;
}
