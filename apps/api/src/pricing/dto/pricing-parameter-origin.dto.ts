import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  PricingParameterOrigin,
  type PricingParameterOrigin as PricingParameterOriginValue,
} from '../../generated/prisma/enums.js';

export class PricingParameterOriginDto {
  @IsEnum(PricingParameterOrigin)
  origin!: PricingParameterOriginValue;

  @IsOptional()
  @IsString()
  source?: string | null;

  @IsOptional()
  @IsString()
  referenceId?: string | null;

  @IsOptional()
  @IsDateString()
  periodStart?: string | null;

  @IsOptional()
  @IsDateString()
  periodEnd?: string | null;

  @IsOptional()
  @IsString()
  criterion?: string | null;

  @IsOptional()
  @IsDateString()
  measuredAt?: string | null;
}

export class PricingConfigurationParameterOriginsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  fixedCostMode?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  fixedCostRate?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  monthlyFixedCost?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  averageMonthlyRevenue?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  monthlyLaborCost?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  productiveHours?: PricingParameterOriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  defaultDesiredMargin?: PricingParameterOriginDto;
}
