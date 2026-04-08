import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}