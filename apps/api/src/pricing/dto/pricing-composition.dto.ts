import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  PricingComponentCategory,
  PricingComponentCostSource,
  PricingFreightMode,
  type PricingComponentCategory as PricingComponentCategoryValue,
  type PricingComponentCostSource as PricingComponentCostSourceValue,
  type PricingFreightMode as PricingFreightModeValue,
} from '../../generated/prisma/enums.js';
import {
  PricingOriginDetailsDto,
  PricingParameterOriginDto,
} from './pricing-parameter-origin.dto.js';
import { IsPricingDecimal } from './pricing-validation.decorators.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PricingCompositionParameterOriginsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  desiredMargin?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  laborEnabled?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  timeMinutes?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  freightMode?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  freightUnitCost?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  freightTotalCost?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  freightQuantity?: PricingParameterOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingParameterOriginDto)
  freightConsumedQuantity?: PricingParameterOriginDto;
}

export class PricingCompositionComponentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  description!: string;

  @IsEnum(PricingComponentCategory)
  category!: PricingComponentCategoryValue;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit!: string;

  @IsDefined()
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  quantity!: string;

  @IsEnum(PricingComponentCostSource)
  costSource!: PricingComponentCostSourceValue;

  @ValidateIf((_object, value) => value !== undefined)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  storedUnitCost?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  sourceProductId?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingOriginDetailsDto)
  originDetails?: PricingOriginDetailsDto;
}

export class PutPricingCompositionDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  expectedRevision!: number | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  profileId!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 4, scale: 8 })
  desiredMargin!: string | null;

  @IsDefined()
  @IsBoolean()
  laborEnabled!: boolean;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  timeMinutes!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(PricingFreightMode)
  freightMode!: PricingFreightModeValue | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightUnitCost!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightTotalCost!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightQuantity!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightConsumedQuantity!: string | null;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingCompositionParameterOriginsDto)
  parameterOrigins!: PricingCompositionParameterOriginsDto;

  @IsDefined()
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PricingCompositionComponentDto)
  components!: PricingCompositionComponentDto[];
}
