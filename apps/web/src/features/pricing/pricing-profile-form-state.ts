import { z } from 'zod';

import {
  pricingIsoDateStringSchema,
  pricingParameterOriginSchema,
} from './pricing-configuration-contracts';
import {
  type CreatePricingProfileInput,
  type PricingDeduction,
  type PricingDeductionInput,
  type PricingProfileDetail,
  type UpdatePricingProfileInput,
} from './pricing-profiles-contracts';
import { canonicalizePercentageInput, percentageFractionToInput } from './format-pricing';

const originFormSchema = z.strictObject({
  source: z.string(),
  referenceId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  criterion: z.string(),
  measuredAt: z.string(),
});

const deductionFormSchema = z.strictObject({
  name: z.string().trim().min(1, 'Informe o nome da dedução.').max(100),
  category: z.string().trim().min(1, 'Informe a categoria da dedução.'),
  rate: z.string().min(1, 'Informe o percentual da dedução.'),
  origin: pricingParameterOriginSchema,
  originDetails: originFormSchema,
});

export const pricingProfileFormSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'Informe o nome do perfil.').max(100),
    deductions: z.array(deductionFormSchema),
  })
  .superRefine((values, context) => {
    values.deductions.forEach((deduction, index) => {
      if (deduction.rate !== '' && canonicalizePercentageInput(deduction.rate) === null) {
        context.addIssue({
          code: 'custom',
          path: ['deductions', index, 'rate'],
          message: 'Informe um percentual válido com até seis casas decimais.',
        });
      }
      for (const field of ['periodStart', 'periodEnd', 'measuredAt'] as const) {
        const value = deduction.originDetails[field];
        if (value !== '' && !pricingIsoDateStringSchema.safeParse(value).success) {
          context.addIssue({
            code: 'custom',
            path: ['deductions', index, 'originDetails', field],
            message: 'Informe uma data ISO 8601 válida.',
          });
        }
      }
    });
  });

export type PricingProfileFormValues = z.infer<typeof pricingProfileFormSchema>;

export const emptyPricingDeductionFormValue: PricingProfileFormValues['deductions'][number] = {
  name: '',
  category: '',
  rate: '',
  origin: 'MANUAL',
  originDetails: {
    source: '',
    referenceId: '',
    periodStart: '',
    periodEnd: '',
    criterion: '',
    measuredAt: '',
  },
};

function deductionToForm(deduction: PricingDeduction) {
  return {
    name: deduction.name,
    category: deduction.category,
    rate: percentageFractionToInput(deduction.rate),
    origin: deduction.origin,
    originDetails: {
      source: deduction.originDetails.source ?? '',
      referenceId: deduction.originDetails.referenceId ?? '',
      periodStart: deduction.originDetails.periodStart ?? '',
      periodEnd: deduction.originDetails.periodEnd ?? '',
      criterion: deduction.originDetails.criterion ?? '',
      measuredAt: deduction.originDetails.measuredAt ?? '',
    },
  };
}

export function pricingProfileToFormValues(
  profile: PricingProfileDetail | null,
): PricingProfileFormValues {
  return {
    name: profile?.currentRevision.name ?? '',
    deductions: profile?.currentRevision.deductions.map(deductionToForm) ?? [],
  };
}

function nullable(value: string): string | null {
  return value === '' ? null : value;
}

function deductionFromForm(
  deduction: PricingProfileFormValues['deductions'][number],
): PricingDeductionInput {
  return {
    name: deduction.name.trim(),
    category: deduction.category.trim(),
    rate: canonicalizePercentageInput(deduction.rate)!,
    origin: deduction.origin,
    originDetails: {
      source: nullable(deduction.originDetails.source),
      referenceId: nullable(deduction.originDetails.referenceId),
      periodStart: nullable(deduction.originDetails.periodStart),
      periodEnd: nullable(deduction.originDetails.periodEnd),
      criterion: nullable(deduction.originDetails.criterion),
      measuredAt: nullable(deduction.originDetails.measuredAt),
    },
  };
}

function sameDeduction(left: PricingDeductionInput, right: PricingDeduction): boolean {
  return (
    left.name === right.name &&
    left.category === right.category &&
    left.rate === right.rate &&
    left.origin === right.origin &&
    left.originDetails?.source === right.originDetails.source &&
    left.originDetails?.referenceId === right.originDetails.referenceId &&
    left.originDetails?.periodStart === right.originDetails.periodStart &&
    left.originDetails?.periodEnd === right.originDetails.periodEnd &&
    left.originDetails?.criterion === right.originDetails.criterion &&
    left.originDetails?.measuredAt === right.originDetails.measuredAt
  );
}

export function buildCreatePricingProfileInput(
  values: PricingProfileFormValues,
): CreatePricingProfileInput {
  return {
    name: values.name.trim(),
    deductions: values.deductions.map(deductionFromForm),
  };
}

export function buildUpdatePricingProfileInput(
  values: PricingProfileFormValues,
  profile: PricingProfileDetail,
): { input: UpdatePricingProfileInput; changed: boolean } {
  const input: UpdatePricingProfileInput = {
    expectedRevision: profile.currentRevision.revision,
  };
  const name = values.name.trim();
  if (name !== profile.currentRevision.name) input.name = name;

  const deductions = values.deductions.map(deductionFromForm);
  const deductionsChanged =
    deductions.length !== profile.currentRevision.deductions.length ||
    deductions.some((deduction, index) => {
      const persisted = profile.currentRevision.deductions[index];
      return !persisted || !sameDeduction(deduction, persisted);
    });
  if (deductionsChanged) input.deductions = deductions;

  return { input, changed: input.name !== undefined || input.deductions !== undefined };
}
