import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PutPricingCompositionDto } from './pricing-composition.dto.js';

describe('PutPricingCompositionDto', () => {
  const validPayload = () => ({
    expectedRevision: null,
    profileId: null,
    desiredMargin: '0.25',
    laborEnabled: true,
    timeMinutes: '90',
    freightMode: 'MANUAL',
    freightUnitCost: '3',
    freightTotalCost: null,
    freightQuantity: null,
    freightConsumedQuantity: null,
    parameterOrigins: {
      desiredMargin: { origin: 'MANUAL' },
      laborEnabled: { origin: 'MANUAL' },
      timeMinutes: { origin: 'MANUAL' },
      freightMode: { origin: 'MANUAL' },
      freightUnitCost: { origin: 'MANUAL' },
    },
    components: [
      {
        description: 'Material',
        category: 'MATERIAL',
        unit: 'UN',
        quantity: '2',
        costSource: 'MANUAL',
        storedUnitCost: '12.5',
      },
    ],
  });

  it('accepts the complete composition contract', async () => {
    const errors = await validate(
      plainToInstance(PutPricingCompositionDto, validPayload()),
    );
    expect(errors).toEqual([]);
  });

  it('rejects arrays where nested provenance objects are expected', async () => {
    const payload = validPayload();
    const errors = await validate(
      plainToInstance(PutPricingCompositionDto, {
        ...payload,
        parameterOrigins: [],
      }),
    );
    expect(errors.some((error) => error.property === 'parameterOrigins')).toBe(
      true,
    );
  });
});
