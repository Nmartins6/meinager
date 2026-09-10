import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ProductType } from '../../generated/prisma/enums.js';

const decimalPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class CreateProductDto {
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const sku = value.trim().toUpperCase();
    return sku || undefined;
  })
  @IsString()
  @MaxLength(60)
  sku?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const barcode = value.trim();
    return barcode || undefined;
  })
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @Matches(decimalPattern, {
    message:
      'directCost must be a non-negative decimal with up to 6 decimal places',
  })
  directCost?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @Matches(moneyPattern, {
    message:
      'salePrice must be a non-negative decimal with up to 2 decimal places',
  })
  salePrice?: string;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @Matches(decimalPattern, {
    message:
      'minimumStock must be a non-negative decimal with up to 6 decimal places',
  })
  minimumStock?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const notes = value.trim();
    return notes || undefined;
  })
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
