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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  PricingParameterOrigin,
  type PricingParameterOrigin as PricingParameterOriginValue,
} from '../../generated/prisma/enums.js';
import { PricingOriginDetailsDto } from './pricing-parameter-origin.dto.js';
import { IsPricingDecimal } from './pricing-validation.decorators.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PricingDeductionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  category!: string;

  @IsDefined()
  @IsPricingDecimal({ integerDigits: 4, scale: 8 })
  rate!: string;

  @IsEnum(PricingParameterOrigin)
  origin!: PricingParameterOriginValue;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingOriginDetailsDto)
  originDetails?: PricingOriginDetailsDto;
}

export class CreatePricingProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingDeductionDto)
  deductions?: PricingDeductionDto[];
}

export class UpdatePricingProfileDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingDeductionDto)
  deductions?: PricingDeductionDto[];
}

export class DeactivatePricingProfileDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class ListPricingProfilesQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
