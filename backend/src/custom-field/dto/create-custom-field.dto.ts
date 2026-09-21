import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Matches,
  MaxLength,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'API name must contain only alphanumeric characters and underscores',
  })
  apiName: string;

  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  placeholder?: string;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  showInList?: boolean;

  @IsBoolean()
  @IsOptional()
  showInKanban?: boolean;

  @IsBoolean()
  @IsOptional()
  showInGantt?: boolean;

  @IsString()
  @IsOptional()
  options?: string; // JSON string: [{ label, value, color }] or string[]

  @IsString()
  @IsOptional()
  validation?: string; // JSON string: { minLength, maxLength, minValue, maxValue, minDate, maxDate, regex, regexMessage, decimalPlaces, currencyCode }

  @IsInt()
  @IsOptional()
  position?: number;

  @IsString()
  @IsOptional()
  section?: string;
}
