import { IsString, IsOptional, IsEnum, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetType } from '@prisma/client';

export class UpdateWidgetDto {
  @ApiPropertyOptional({ description: 'Updated title of the widget' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: WidgetType, description: 'Updated widget type' })
  @IsOptional()
  @IsEnum(WidgetType)
  type?: WidgetType;

  @ApiPropertyOptional({ description: 'Updated position index' })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional({
    description: 'Updated width of widget: FULL, HALF, THIRD, QUARTER',
  })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({
    description: 'Updated widget configuration JSON',
  })
  @IsOptional()
  config?: any;
}
