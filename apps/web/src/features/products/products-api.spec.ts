import { describe, expect, it } from 'vitest';

import { productSchema } from './products-api';

const product = {
  id: 'f25c7c1a-bd29-438f-a940-77d89a93ec50',
  type: 'PRODUCT',
  name: 'Caneca branca',
  sku: 'CAN-001',
  barcode: null,
  unit: 'UN',
  salePrice: '29.90',
  trackInventory: true,
  minimumStock: '5.000000',
  notes: null,
  isActive: true,
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
} as const;

describe('productSchema', () => {
  it('preserves an absent directCost without materializing a value', () => {
    const parsed = productSchema.parse(product);

    expect(parsed).not.toHaveProperty('directCost');
  });

  it('preserves directCost when the API provides it', () => {
    expect(productSchema.parse({ ...product, directCost: '12.500000' }).directCost).toBe(
      '12.500000',
    );
  });
});
