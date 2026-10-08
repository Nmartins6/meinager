import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreatePricingSimulationDto } from './pricing-simulation.dto.js';

describe('CreatePricingSimulationDto', () => {
  const draft = () => ({
    profileId: null,
    desiredMargin: '0.25',
    laborEnabled: false,
    timeMinutes: null,
    freightMode: null,
    freightUnitCost: null,
    freightTotalCost: null,
    freightQuantity: null,
    freightConsumedQuantity: null,
    parameterOrigins: { desiredMargin: { origin: 'MANUAL' } },
    components: [
      {
        description: 'Material',
        category: 'MATERIAL',
        unit: 'UN',
        quantity: '1',
        costSource: 'MANUAL',
        storedUnitCost: '10',
      },
    ],
  });

  it('accepts the explicit persisted and draft variants', async () => {
    await expect(
      validate(
        plainToInstance(CreatePricingSimulationDto, {
          source: 'PERSISTED',
          adoptedPrice: '90.91',
        }),
      ),
    ).resolves.toEqual([]);
    await expect(
      validate(
        plainToInstance(CreatePricingSimulationDto, {
          source: 'DRAFT',
          draft: draft(),
        }),
      ),
    ).resolves.toEqual([]);
  });

  it('requires the draft for the DRAFT discriminator', async () => {
    const errors = await validate(
      plainToInstance(CreatePricingSimulationDto, { source: 'DRAFT' }),
    );
    expect(errors.some((error) => error.property === 'draft')).toBe(true);
  });

  it('rejects exponential, negative and over-precision adopted prices', async () => {
    for (const adoptedPrice of ['1e2', '-1', '1.001']) {
      const errors = await validate(
        plainToInstance(CreatePricingSimulationDto, {
          source: 'PERSISTED',
          adoptedPrice,
        }),
      );
      expect(errors.some((error) => error.property === 'adoptedPrice')).toBe(
        true,
      );
    }
  });

  it('rejects calculated and protected fields through the global whitelist contract', async () => {
    const instance = plainToInstance(CreatePricingSimulationDto, {
      source: 'DRAFT',
      draft: draft(),
      organizationId: '00000000-0000-4000-8000-000000000001',
      actorUserId: '00000000-0000-4000-8000-000000000002',
      formulaVersion: 'margin-divisor-v1',
      result: {},
      snapshot: {},
      classification: 'DESIRED_MARGIN_MET',
    });
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'organizationId',
        'actorUserId',
        'formulaVersion',
        'result',
        'snapshot',
        'classification',
      ]),
    );
  });
});
