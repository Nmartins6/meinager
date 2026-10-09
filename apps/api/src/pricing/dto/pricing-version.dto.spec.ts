import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreatePricingVersionDto,
  ListPricingVersionsQueryDto,
} from './pricing-version.dto.js';

describe('pricing version DTOs', () => {
  it('accepts only the expected revision and an optional canonical adopted price', async () => {
    const dto = plainToInstance(CreatePricingVersionDto, {
      expectedCompositionRevision: 2,
      adoptedPrice: '100.00',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    {},
    { expectedCompositionRevision: 0 },
    { expectedCompositionRevision: 1, adoptedPrice: null },
    { expectedCompositionRevision: 1, adoptedPrice: '1e2' },
    { expectedCompositionRevision: 1, adoptedPrice: '100.001' },
  ])('rejects invalid creation input %#', async (input) => {
    expect(
      await validate(plainToInstance(CreatePricingVersionDto, input)),
    ).not.toHaveLength(0);
  });

  it('transforms and validates pagination', async () => {
    const query = plainToInstance(ListPricingVersionsQueryDto, {
      page: '2',
      pageSize: '50',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ page: 2, pageSize: 50 });
  });
});
