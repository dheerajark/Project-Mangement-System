import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyTaskListTemplateDto {
  @ApiProperty({
    required: false,
    description: 'Optional milestone in the target project',
  })
  @IsString()
  @IsOptional()
  milestoneId?: string;

  @ApiProperty({
    required: false,
    description: 'Anchor date for template due-date offsets',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;
}
