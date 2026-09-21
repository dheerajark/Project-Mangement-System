import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  MaxLength,
} from 'class-validator';

export class UpdateCustomFieldDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

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
  options?: string;

  @IsString()
  @IsOptional()
  validation?: string;

  @IsInt()
  @IsOptional()
  position?: number;

  @IsString()
  @IsOptional()
  section?: string;
}
