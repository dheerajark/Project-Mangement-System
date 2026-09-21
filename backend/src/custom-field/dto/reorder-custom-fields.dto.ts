import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomFieldOrderItem {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNotEmpty()
  position: number;
}

export class ReorderCustomFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOrderItem)
  items: CustomFieldOrderItem[];
}
