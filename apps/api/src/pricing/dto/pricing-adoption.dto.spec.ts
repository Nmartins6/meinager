import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreatePricingAdoptionDto } from './pricing-adoption.dto.js';

describe('CreatePricingAdoptionDto', () => {
  const versionId = '00000000-0000-4000-8000-000000000001';

  it('accepts only a version and optional conditional confirmation fields', async () => {
    const dto = plainToInstance(CreatePricingAdoptionDto, {
      versionId,
      belowMinimumConfirmed: true,
      justification: 'Decisão comercial aprovada',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    {},
    { versionId: 'not-a-uuid' },
    { versionId, belowMinimumConfirmed: null },
    { versionId, belowMinimumConfirmed: 'true' },
    { versionId, justification: null },
    { versionId, justification: 42 },
  ])('rejects malformed adoption input %#', async (input) => {
    expect(
      await validate(plainToInstance(CreatePricingAdoptionDto, input)),
    ).not.toHaveLength(0);
  });
});
