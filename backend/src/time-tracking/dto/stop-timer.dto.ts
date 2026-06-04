import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StopTimerDto {
  @ApiPropertyOptional({ example: 'Stopped timer logs', description: 'Description of the work done during timer' })
  @IsOptional()
  @IsString()
  description?: string;
}
