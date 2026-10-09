import { IsBoolean, IsString, IsUUID, ValidateIf } from 'class-validator';

export class CreatePricingAdoptionDto {
  @IsUUID('4')
  versionId!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  belowMinimumConfirmed?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  justification?: string;
}
