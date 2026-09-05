import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ClientType } from '../../generated/prisma/enums.js';

export class UpdateClientDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ClientType)
  type?: ClientType;

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

    const digits = value.replace(/\D/g, '');
    return digits || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(/^(?:\d{11}|\d{14})$/, {
    message: 'document must contain 11 or 14 digits',
  })
  document?: string | null;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const digits = value.replace(/\D/g, '');
    return digits || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(/^\d{10,13}$/, {
    message: 'phone must contain between 10 and 13 digits',
  })
  phone?: string | null;

  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const email = value.trim().toLowerCase();
    return email || null;
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

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
