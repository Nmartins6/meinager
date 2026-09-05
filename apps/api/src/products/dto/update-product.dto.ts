import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { ProductType } from '../../generated/prisma/enums.js';

const decimalPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;

export class UpdateProductDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ProductType)
  type?: ProductType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const sku = value.trim().toUpperCase();
    return sku || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(60)
  sku?: string | null;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const barcode = value.trim();
    return barcode || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(50)
  barcode?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit?: string;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    return value.trim() || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(decimalPattern, {
    message:
      'directCost must be a non-negative decimal with up to 6 decimal places',
  })
  directCost?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  trackInventory?: boolean;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    return value.trim() || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(decimalPattern, {
    message:
      'minimumStock must be a non-negative decimal with up to 6 decimal places',
  })
  minimumStock?: string | null;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const notes = value.trim();
    return notes || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
