import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { CreateQuoteItemDto } from './create-quote.dto.js';

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class UpdateQuoteDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID('4')
  clientId?: string;

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
  @IsDateString()
  validUntil?: string | null;

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
  @Matches(moneyPattern, {
    message: 'Informe um desconto não negativo com até duas casas decimais.',
  })
  discount?: string | null;

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
  @MaxLength(2000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Informe ao menos um item no orçamento.',
  })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items?: CreateQuoteItemDto[];
}
