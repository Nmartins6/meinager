import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^-?\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'openingBalance must be a decimal with up to 12 integer and 2 decimal digits',
  })
  openingBalance?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
