import { describe, expect, it } from 'vitest';

import {
  createPricingProfileInputSchema,
  pricingProfileDetailSchema,
  pricingProfilesListSchema,
  updatePricingProfileInputSchema,
} from './pricing-profiles-contracts';

const ids = {
  profile: '11111111-1111-4111-8111-111111111111',
  revision: '22222222-2222-4222-8222-222222222222',
  deduction: '33333333-3333-4333-8333-333333333333',
  user: '44444444-4444-4444-8444-444444444444',
};

const detail = {
  id: ids.profile,
  isActive: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  currentRevision: {
    id: ids.revision,
    revision: 1,
    name: 'Varejo',
    effectiveFrom: '2026-10-18T12:00:00.000Z',
    createdAt: '2026-10-18T12:00:00.000Z',
    deductions: [
      {
        id: ids.deduction,
        position: 1,
        name: 'Cartão',
        category: 'CARD',
        rate: '0.00000001',
        origin: 'MANUAL',
        originDetails: {
          schemaVersion: 1,
          source: null,
          referenceId: null,
          periodStart: null,
          periodEnd: null,
          criterion: null,
          measuredAt: null,
          confirmedByUserId: ids.user,
        },
        createdAt: '2026-10-18T12:00:00.000Z',
      },
    ],
  },
};

describe('pricing profile contracts', () => {
  it('accepts exact detail and paginated list responses', () => {
    expect(pricingProfileDetailSchema.parse(detail)).toEqual(detail);
    const { deductions: _deductions, ...revision } = detail.currentRevision;
    const item = { ...detail, currentRevision: revision };
    expect(
      pricingProfilesListSchema.parse({
        data: [item],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    ).toBeTruthy();
  });

  it('rejects unknown response fields, noncanonical rates and invalid pagination', () => {
    expect(
      pricingProfileDetailSchema.safeParse({ ...detail, organizationId: ids.profile }).success,
    ).toBe(false);
    const invalidRate = structuredClone(detail);
    invalidRate.currentRevision.deductions[0]!.rate = '1e-8';
    expect(pricingProfileDetailSchema.safeParse(invalidRate).success).toBe(false);
    expect(
      pricingProfilesListSchema.safeParse({
        data: [],
        pagination: { page: 0, pageSize: 101, total: -1, totalPages: -1 },
      }).success,
    ).toBe(false);
  });

  it('distinguishes omission from null and rejects protected input fields', () => {
    expect(createPricingProfileInputSchema.safeParse({ name: 'Varejo' }).success).toBe(true);
    expect(
      createPricingProfileInputSchema.safeParse({ name: 'Varejo', deductions: null }).success,
    ).toBe(false);
    expect(updatePricingProfileInputSchema.safeParse({ expectedRevision: 1 }).success).toBe(true);
    expect(
      updatePricingProfileInputSchema.safeParse({ expectedRevision: 1, name: null }).success,
    ).toBe(false);
    expect(
      createPricingProfileInputSchema.safeParse({
        name: 'Varejo',
        deductions: [
          {
            name: 'Cartão',
            category: 'CARD',
            rate: '0.03',
            origin: 'MANUAL',
            position: 1,
            confirmedByUserId: ids.user,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('validates provenance objects strictly', () => {
    const input = {
      name: 'Varejo',
      deductions: [
        {
          name: 'Cartão',
          category: 'CARD',
          rate: '0.03',
          origin: 'MANUAL',
          originDetails: { source: null, measuredAt: '2026-10-18T12:00:00.000Z' },
        },
      ],
    };
    expect(createPricingProfileInputSchema.safeParse(input).success).toBe(true);
    expect(
      createPricingProfileInputSchema.safeParse({
        ...input,
        deductions: [{ ...input.deductions[0], originDetails: { schemaVersion: 1 } }],
      }).success,
    ).toBe(false);
  });
});
