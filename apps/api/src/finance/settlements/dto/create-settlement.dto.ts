import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSettlementDto {
  @IsUUID('4')
  accountId!: string;

  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with up to 12 integer and 2 decimal digits',
  })
  amount!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'settledAt must use the YYYY-MM-DD format',
  })
  @IsDateString(
    { strict: true },
    {
      message: 'settledAt must be a valid date',
    },
  )
  settledAt!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
