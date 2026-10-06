import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  PricingFixedCostMode,
  type PricingFixedCostMode as PricingFixedCostModeValue,
} from '../../generated/prisma/enums.js';
import {
  IsPricingCurrency,
  IsPricingDecimal,
} from './pricing-validation.decorators.js';
import { PricingConfigurationParameterOriginsDto } from './pricing-parameter-origin.dto.js';

export class UpdatePricingConfigurationDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  expectedRevision!: number | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsPricingCurrency()
  currency?: string;

  @IsOptional()
  @IsEnum(PricingFixedCostMode)
  fixedCostMode?: PricingFixedCostModeValue | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 4, scale: 8 })
  fixedCostRate?: string | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  monthlyFixedCost?: string | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  averageMonthlyRevenue?: string | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  monthlyLaborCost?: string | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  productiveHours?: string | null;

  @IsOptional()
  @IsPricingDecimal({ integerDigits: 4, scale: 8 })
  defaultDesiredMargin?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => PricingConfigurationParameterOriginsDto)
  parameterOrigins?: PricingConfigurationParameterOriginsDto;
}
