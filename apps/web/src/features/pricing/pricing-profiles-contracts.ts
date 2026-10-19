import { z } from 'zod';

import {
  pricingIsoDateStringSchema,
  pricingParameterOriginSchema,
} from './pricing-configuration-contracts';
import { pricingDecimalStringSchema } from './pricing-contracts';

const deductionRateSchema = pricingDecimalStringSchema.refine((value) => {
  const [integer, fraction = ''] = value.split('.');
  return integer.length <= 4 && fraction.length <= 8;
}, 'Use até 4 dígitos inteiros e 8 casas decimais.');

const optionalOriginTextSchema = z.string().nullable().optional();
const optionalOriginDateSchema = pricingIsoDateStringSchema.nullable().optional();

export const pricingDeductionOriginInputSchema = z.strictObject({
  source: optionalOriginTextSchema,
  referenceId: optionalOriginTextSchema,
  periodStart: optionalOriginDateSchema,
  periodEnd: optionalOriginDateSchema,
  criterion: optionalOriginTextSchema,
  measuredAt: optionalOriginDateSchema,
});

export const pricingDeductionOriginResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.string().nullable(),
  referenceId: z.string().nullable(),
  periodStart: pricingIsoDateStringSchema.nullable(),
  periodEnd: pricingIsoDateStringSchema.nullable(),
  criterion: z.string().nullable(),
  measuredAt: pricingIsoDateStringSchema.nullable(),
  confirmedByUserId: z.string().uuid(),
});

export const pricingDeductionInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1),
  rate: deductionRateSchema,
  origin: pricingParameterOriginSchema,
  originDetails: pricingDeductionOriginInputSchema.optional(),
});

export const pricingDeductionSchema = z.strictObject({
  id: z.string().uuid(),
  position: z.number().int().positive(),
  name: z.string().min(1).max(100),
  category: z.string().min(1),
  rate: deductionRateSchema,
  origin: pricingParameterOriginSchema,
  originDetails: pricingDeductionOriginResponseSchema,
  createdAt: z.iso.datetime({ offset: true }),
});

const pricingProfileRevisionSummarySchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  name: z.string().min(1).max(100),
  effectiveFrom: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});

export const pricingProfileItemSchema = z.strictObject({
  id: z.string().uuid(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  currentRevision: pricingProfileRevisionSummarySchema,
});

export const pricingProfileDetailSchema = pricingProfileItemSchema.extend({
  currentRevision: pricingProfileRevisionSummarySchema.extend({
    deductions: z.array(pricingDeductionSchema),
  }),
});

export const pricingProfilesListSchema = z.strictObject({
  data: z.array(pricingProfileItemSchema),
  pagination: z.strictObject({
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const createPricingProfileInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  deductions: z.array(pricingDeductionInputSchema).optional(),
});

export const updatePricingProfileInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  name: z.string().trim().min(1).max(100).optional(),
  deductions: z.array(pricingDeductionInputSchema).optional(),
});

export const deactivatePricingProfileInputSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
});

export type PricingDeductionOriginInput = z.infer<typeof pricingDeductionOriginInputSchema>;
export type PricingDeductionInput = z.infer<typeof pricingDeductionInputSchema>;
export type PricingDeduction = z.infer<typeof pricingDeductionSchema>;
export type PricingProfileItem = z.infer<typeof pricingProfileItemSchema>;
export type PricingProfileDetail = z.infer<typeof pricingProfileDetailSchema>;
export type PricingProfilesList = z.infer<typeof pricingProfilesListSchema>;
export type CreatePricingProfileInput = z.infer<typeof createPricingProfileInputSchema>;
export type UpdatePricingProfileInput = z.infer<typeof updatePricingProfileInputSchema>;
export type DeactivatePricingProfileInput = z.infer<typeof deactivatePricingProfileInputSchema>;
