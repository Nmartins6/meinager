import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FinancialAccountType } from '../../../generated/prisma/enums.js';

export class CreateAccountDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(FinancialAccountType)
  type!: FinancialAccountType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^-?\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'openingBalance must be a decimal with up to 12 integer and 2 decimal digits',
  })
  openingBalance?: string;
}
