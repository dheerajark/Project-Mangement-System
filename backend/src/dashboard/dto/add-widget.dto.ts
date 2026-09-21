import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetType } from '@prisma/client';

export class AddWidgetDto {
  @ApiProperty({ description: 'Title of the widget' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: WidgetType, description: 'Type of widget' })
  @IsEnum(WidgetType)
  type: WidgetType;

  @ApiPropertyOptional({ description: 'Position index of widget', default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional({
    description: 'Width of widget: FULL, HALF, THIRD, QUARTER',
    default: 'HALF',
  })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({
    description: 'JSON object or string configuration for widget filters and options',
  })
  @IsOptional()
  config?: any;
}
