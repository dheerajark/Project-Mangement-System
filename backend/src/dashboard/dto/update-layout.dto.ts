import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WidgetLayoutItemDto {
  @ApiProperty({ description: 'Widget ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Position order index' })
  position: number;

  @ApiPropertyOptional({ description: 'Width: FULL, HALF, THIRD, QUARTER' })
  @IsOptional()
  @IsString()
  width?: string;
}

export class UpdateLayoutDto {
  @ApiProperty({
    type: [WidgetLayoutItemDto],
    description: 'Updated widget layout order and dimensions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetLayoutItemDto)
  widgets: WidgetLayoutItemDto[];

  @ApiPropertyOptional({ description: 'Canvas layout metadata JSON' })
  @IsOptional()
  @IsString()
  layout?: string;
}
