import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { FinancialRevenueSource } from '../../../generated/prisma/enums.js';

export class CreatePeriodDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsEnum(FinancialRevenueSource)
  revenueSource!: FinancialRevenueSource;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'manualRevenue must be a non-negative decimal with up to 12 integer and 2 decimal digits',
  })
  manualRevenue?: string;
}
