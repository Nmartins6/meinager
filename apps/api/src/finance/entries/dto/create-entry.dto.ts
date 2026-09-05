import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEntryDto {
  @IsUUID('4')
  periodId!: string;

  @IsUUID('4')
  categoryId!: string;

  @IsOptional()
  @IsUUID('4')
  clientId?: string | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  description!: string;

  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with up to 12 integer and 2 decimal digits',
  })
  amount!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueDate must use the YYYY-MM-DD format',
  })
  @IsDateString(
    { strict: true },
    {
      message: 'dueDate must be a valid date',
    },
  )
  dueDate!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
