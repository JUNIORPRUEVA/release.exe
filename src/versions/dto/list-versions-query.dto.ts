import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { AppPlatform } from '../../common/enums/platform.enum';

export class ListVersionsQueryDto {
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsEnum(AppPlatform)
  platform?: AppPlatform;
}