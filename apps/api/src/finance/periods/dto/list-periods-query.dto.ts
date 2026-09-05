import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  FinancialPeriodStatus,
  FinancialRevenueSource,
} from '../../../generated/prisma/enums.js';

export class ListPeriodsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  year?: number;

  @IsOptional()
  @IsEnum(FinancialPeriodStatus)
  status?: FinancialPeriodStatus;

  @IsOptional()
  @IsEnum(FinancialRevenueSource)
  revenueSource?: FinancialRevenueSource;
}
