import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  PricingParameterOrigin,
  type PricingParameterOrigin as PricingParameterOriginValue,
} from '../../generated/prisma/enums.js';

export class PricingOriginDetailsDto {
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

export class PricingParameterOriginDto extends PricingOriginDetailsDto {
  @IsEnum(PricingParameterOrigin)
  origin!: PricingParameterOriginValue;
}

export class PricingConfigurationParameterOriginsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  fixedCostMode?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  fixedCostRate?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  monthlyFixedCost?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  averageMonthlyRevenue?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  monthlyLaborCost?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  productiveHours?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  defaultDesiredMargin?: PricingParameterOriginDto;
}
