import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { StockMovementType } from '../../generated/prisma/enums.js';

export class CreateStockMovementDto {
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/, {
    message:
      'Informe uma quantidade positiva, com até 12 dígitos inteiros e 6 casas decimais.',
  })
  quantity!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3, {
    message: 'Informe um motivo com pelo menos 3 caracteres.',
  })
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string;
}