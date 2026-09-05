import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateEntryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID('4')
  categoryId?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  clientId?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/, {
    message:
      'amount must be a positive decimal with up to 12 integer and 2 decimal digits',
  })
  amount?: string;

  @ValidateIf((_object, value) => value !== undefined)
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
  dueDate?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
