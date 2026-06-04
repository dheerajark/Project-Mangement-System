import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitTimesheetDto {
  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-06-07T00:00:00.000Z' })
  @IsDateString()
  endDate: string;
}
