import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { IsPricingDecimal } from './pricing-validation.decorators.js';

export class CreatePricingVersionDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  expectedCompositionRevision!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDefined()
  @IsPricingDecimal({ integerDigits: 12, scale: 2 })
  adoptedPrice?: string;
}

export class ListPricingVersionsQueryDto {
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
