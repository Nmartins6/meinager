import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsObject,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  PricingFreightMode,
  type PricingFreightMode as PricingFreightModeValue,
} from '../../generated/prisma/enums.js';
import {
  PricingCompositionComponentDto,
  PricingCompositionParameterOriginsDto,
} from './pricing-composition.dto.js';
import { IsPricingDecimal } from './pricing-validation.decorators.js';

export const PricingSimulationSource = {
  PERSISTED: 'PERSISTED',
  DRAFT: 'DRAFT',
} as const;

export type PricingSimulationSource =
  (typeof PricingSimulationSource)[keyof typeof PricingSimulationSource];

/** Complete transient composition; positions are derived from array order. */
export class PricingSimulationDraftDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  profileId!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 4, scale: 8 })
  desiredMargin!: string | null;

  @IsDefined()
  @IsBoolean()
  laborEnabled!: boolean;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  timeMinutes!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(PricingFreightMode)
  freightMode!: PricingFreightModeValue | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightUnitCost!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightTotalCost!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightQuantity!: string | null;

  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsPricingDecimal({ integerDigits: 13, scale: 6 })
  freightConsumedQuantity!: string | null;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingCompositionParameterOriginsDto)
  parameterOrigins!: PricingCompositionParameterOriginsDto;

  @IsDefined()
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PricingCompositionComponentDto)
  components!: PricingCompositionComponentDto[];
}

export class CreatePricingSimulationDto {
  @IsEnum(PricingSimulationSource)
  source!: PricingSimulationSource;

  @ValidateIf(
    (object: CreatePricingSimulationDto) =>
      object.source === PricingSimulationSource.DRAFT ||
      object.draft !== undefined,
  )
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PricingSimulationDraftDto)
  draft?: PricingSimulationDraftDto;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsPricingDecimal({ integerDigits: 13, scale: 2 })
  adoptedPrice?: string;
}
