import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { AppPlatform } from '../../common/enums/platform.enum';

export class CheckUpdateQueryDto {
  @IsEnum(AppPlatform)
  platform!: AppPlatform;

  @IsInt()
  @Min(0)
  current_build!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  current_version?: string;
}