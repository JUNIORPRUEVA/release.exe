import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { AppPlatform } from '../../common/enums/platform.enum';

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

export class UploadVersionDto {
  @IsUUID()
  project_id!: string;

  @IsEnum(AppPlatform)
  platform!: AppPlatform;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => String(value).trim())
  version!: string;

  @IsInt()
  @Min(1)
  build_number!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (value == null ? '' : String(value).trim()))
  release_notes?: string;

  @IsBoolean()
  @Transform(({ value }) => toBoolean(value))
  is_required!: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toBoolean(value))
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_supported_build?: number;
}