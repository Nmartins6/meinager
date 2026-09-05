import { IsEnum, IsString, Matches, ValidateIf } from 'class-validator';
import { FinancialRevenueSource } from '../../../generated/prisma/enums.js';

export class UpdatePeriodDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(FinancialRevenueSource)
  revenueSource?: FinancialRevenueSource;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'manualRevenue must be a non-negative decimal with up to 12 integer and 2 decimal digits',
  })
  manualRevenue?: string;
}
