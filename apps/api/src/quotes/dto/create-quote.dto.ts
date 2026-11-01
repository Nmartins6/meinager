import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const quantityPattern = /^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class CreateQuoteItemDto {
  @IsOptional()
  @IsUUID('4')
  sourceItemId?: string;

  @IsOptional()
  @IsIn(['CATALOG_NOW', 'MANUAL', 'PRESERVE'])
  priceSelection?: 'CATALOG_NOW' | 'MANUAL' | 'PRESERVE';

  @IsOptional()
  @IsDateString()
  expectedProductUpdatedAt?: string;

  @IsOptional()
  @IsUUID('4')
  expectedAdoptedPricingVersionId?: string | null;

  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  description!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(quantityPattern, {
    message:
      'Informe uma quantidade positiva, com até 12 dígitos inteiros e 6 casas decimais.',
  })
  quantity!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(moneyPattern, {
    message:
      'Informe um preço unitário não negativo com até duas casas decimais.',
  })
  unitPrice!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateQuoteDto {
  @IsUUID('4')
  clientId!: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(moneyPattern, {
    message: 'Informe um desconto não negativo com até duas casas decimais.',
  })
  discount?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, {
    message: 'Informe ao menos um item no orçamento.',
  })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];
}
