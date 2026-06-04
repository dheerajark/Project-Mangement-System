import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartTimerDto {
  @ApiProperty({ example: 'project-uuid-here', description: 'The project ID' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ example: 'task-uuid-here', description: 'The task ID' })
  @IsOptional()
  @IsString()
  taskId?: string;
}
