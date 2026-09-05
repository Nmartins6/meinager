import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientType } from '../../generated/prisma/enums.js';

export class CreateClientDto {
  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

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

    const digits = value.replace(/\D/g, '');
    return digits || undefined;
  })
  @Matches(/^(?:\d{11}|\d{14})$/, {
    message: 'document must contain 11 or 14 digits',
  })
  document?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const digits = value.replace(/\D/g, '');
    return digits || undefined;
  })
  @Matches(/^\d{10,13}$/, {
    message: 'phone must contain between 10 and 13 digits',
  })
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const email = value.trim().toLowerCase();
    return email || undefined;
  })
  @IsEmail()
  @MaxLength(254)
  email?: string;

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
