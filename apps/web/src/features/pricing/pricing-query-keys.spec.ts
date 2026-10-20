import { describe, expect, it } from 'vitest';

import { pricingQueryKeys } from './pricing-query-keys';

describe('pricingQueryKeys', () => {
  it('creates the approved stable hierarchy', () => {
    expect(pricingQueryKeys.all).toEqual(['pricing']);
    expect(pricingQueryKeys.configuration()).toEqual(['pricing', 'configuration']);
    expect(pricingQueryKeys.profiles.all()).toEqual(['pricing', 'profiles']);
    expect(pricingQueryKeys.profiles.lists()).toEqual(['pricing', 'profiles', 'list']);
    expect(pricingQueryKeys.profiles.allActive()).toEqual([
      'pricing',
      'profiles',
      'list',
      'all-active',
    ]);
    expect(pricingQueryKeys.profiles.list({ page: 2 })).toEqual([
      'pricing',
      'profiles',
      'list',
      { page: 2 },
    ]);
    expect(pricingQueryKeys.profiles.detail('profile-1')).toEqual([
      'pricing',
      'profiles',
      'detail',
      'profile-1',
    ]);
    expect(pricingQueryKeys.profiles.list({ page: 1, isActive: true })).not.toEqual(
      pricingQueryKeys.profiles.list({ page: 2, isActive: true }),
    );
    expect(pricingQueryKeys.profiles.list({ page: 1, isActive: true })).not.toEqual(
      pricingQueryKeys.profiles.list({ page: 1, isActive: false }),
    );
    expect(pricingQueryKeys.products.summary('product-1')).toEqual([
      'pricing',
      'products',
      'product-1',
      'summary',
    ]);
    expect(pricingQueryKeys.products.composition('product-1')).toEqual([
      'pricing',
      'products',
      'product-1',
      'composition',
    ]);
    expect(pricingQueryKeys.products.versions.list('product-1', { pageSize: 10 })).toEqual([
      'pricing',
      'products',
      'product-1',
      'versions',
      'list',
      { pageSize: 10 },
    ]);
    expect(pricingQueryKeys.products.versions.detail('product-1', 'version-1')).toEqual([
      'pricing',
      'products',
      'product-1',
      'versions',
      'detail',
      'version-1',
    ]);
  });
});
