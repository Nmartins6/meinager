import { describe, expect, it } from 'vitest';

import type { PricingProfileDetail } from './pricing-profiles-contracts';
import {
  buildCreatePricingProfileInput,
  buildUpdatePricingProfileInput,
  pricingProfileFormSchema,
  pricingProfileToFormValues,
} from './pricing-profile-form-state';

const profile: PricingProfileDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  isActive: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  currentRevision: {
    id: '22222222-2222-4222-8222-222222222222',
    revision: 4,
    name: 'Varejo',
    effectiveFrom: '2026-10-18T12:00:00.000Z',
    createdAt: '2026-10-18T12:00:00.000Z',
    deductions: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        position: 1,
        name: 'Cartão',
        category: 'CARD',
        rate: '0.0315',
        origin: 'MANUAL',
        originDetails: {
          schemaVersion: 1,
          source: 'Contrato',
          referenceId: null,
          periodStart: null,
          periodEnd: null,
          criterion: null,
          measuredAt: null,
          confirmedByUserId: '44444444-4444-4444-8444-444444444444',
        },
        createdAt: '2026-10-18T12:00:00.000Z',
      },
    ],
  },
};

describe('pricing profile form state', () => {
  it('converts exact human percentages without exponent and canonicalizes zeros', () => {
    const values = pricingProfileToFormValues(profile);
    expect(values.deductions[0]!.rate).toBe('3.15');
    values.deductions[0]!.rate = '0003,150000';
    expect(buildUpdatePricingProfileInput(values, profile).changed).toBe(false);
    values.deductions[0]!.rate = '0,000001';
    expect(buildUpdatePricingProfileInput(values, profile).input.deductions?.[0]?.rate).toBe(
      '0.00000001',
    );
  });

  it('builds name-only and full deduction replacement patches', () => {
    const nameOnly = pricingProfileToFormValues(profile);
    nameOnly.name = 'Atacado';
    expect(buildUpdatePricingProfileInput(nameOnly, profile)).toEqual({
      input: { expectedRevision: 4, name: 'Atacado' },
      changed: true,
    });
    const deductions = pricingProfileToFormValues(profile);
    deductions.deductions[0]!.originDetails.source = '';
    expect(buildUpdatePricingProfileInput(deductions, profile).input).toEqual({
      expectedRevision: 4,
      deductions: [
        {
          name: 'Cartão',
          category: 'CARD',
          rate: '0.0315',
          origin: 'MANUAL',
          originDetails: {
            source: null,
            referenceId: null,
            periodStart: null,
            periodEnd: null,
            criterion: null,
            measuredAt: null,
          },
        },
      ],
    });
  });

  it('preserves the visual array order for replacement, insertion and removal', () => {
    const values = pricingProfileToFormValues(profile);
    values.deductions.push({
      name: 'Marketplace',
      category: 'CHANNEL',
      rate: '10',
      origin: 'COPIED',
      originDetails: {
        source: 'Tabela',
        referenceId: '',
        periodStart: '',
        periodEnd: '',
        criterion: '',
        measuredAt: '',
      },
    });
    values.deductions.reverse();
    const replaced = buildUpdatePricingProfileInput(values, profile).input.deductions;
    expect(replaced?.map(({ name }) => name)).toEqual(['Marketplace', 'Cartão']);
    expect(replaced?.[0]?.rate).toBe('0.1');
    values.deductions.splice(1, 1);
    expect(buildUpdatePricingProfileInput(values, profile).input.deductions).toHaveLength(1);
  });

  it('preserves semantic provenance and never sends protected fields', () => {
    const values = pricingProfileToFormValues(profile);
    expect(buildUpdatePricingProfileInput(values, profile)).toEqual({
      input: { expectedRevision: 4 },
      changed: false,
    });
    const created = buildCreatePricingProfileInput(values);
    expect(JSON.stringify(created)).not.toMatch(/schemaVersion|confirmedByUserId|position|"id"/);
  });

  it('validates names, percentages and provenance dates', () => {
    const values = pricingProfileToFormValues(profile);
    values.name = ' ';
    values.deductions[0]!.rate = '1e2';
    values.deductions[0]!.originDetails.measuredAt = 'ontem';
    const result = pricingProfileFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
  });
});
