import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { UploadVersionDto } from './upload-version.dto';

export class CompleteUploadVersionDto extends UploadVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => String(value).trim())
  storage_key!: string;

  @IsInt()
  @Min(1)
  file_size!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (value == null ? undefined : String(value).trim()))
  content_type?: string;
}