import { describe, expect, it } from 'vitest';

import { pricingPermissions } from './pricing-permissions';

describe('pricingPermissions', () => {
  it('defines the complete policy for all organization roles', () => {
    expect(Object.keys(pricingPermissions)).toEqual([
      'OWNER',
      'ADMIN',
      'OPERATIONS',
      'FINANCE',
      'VIEWER',
    ]);

    expect(pricingPermissions.OWNER).toEqual({
      viewCommercialSummary: true,
      setManualPrice: true,
      editComposition: true,
      viewInternalPricing: true,
      viewConfiguration: true,
      editConfiguration: true,
      viewProfiles: true,
      editProfiles: true,
    });
    expect(pricingPermissions.ADMIN).toEqual(pricingPermissions.OWNER);
    expect(pricingPermissions.OPERATIONS).toEqual({
      viewCommercialSummary: true,
      setManualPrice: false,
      editComposition: true,
      viewInternalPricing: true,
      viewConfiguration: true,
      editConfiguration: false,
      viewProfiles: true,
      editProfiles: false,
    });
    expect(pricingPermissions.FINANCE).toEqual({
      viewCommercialSummary: true,
      setManualPrice: false,
      editComposition: false,
      viewInternalPricing: true,
      viewConfiguration: true,
      editConfiguration: false,
      viewProfiles: true,
      editProfiles: false,
    });
    expect(pricingPermissions.VIEWER).toEqual({
      viewCommercialSummary: true,
      setManualPrice: false,
      editComposition: false,
      viewInternalPricing: false,
      viewConfiguration: false,
      editConfiguration: false,
      viewProfiles: false,
      editProfiles: false,
    });
  });
});
