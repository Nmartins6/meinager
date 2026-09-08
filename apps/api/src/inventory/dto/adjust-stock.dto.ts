import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdjustStockDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/, {
    message:
      'Informe uma contagem não negativa, com até 12 dígitos inteiros e 6 casas decimais.',
  })
  countedQuantity!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, {
    message: 'Informe o saldo esperado como decimal não negativo.',
  })
  expectedBalance!: string;

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