import type { AuthResponse } from '@/lib/api';

export type OrganizationRole = AuthResponse['organization']['role'];

export interface PricingPermissions {
  viewCommercialSummary: boolean;
  setManualPrice: boolean;
  editComposition: boolean;
  viewInternalPricing: boolean;
}

export const pricingPermissions: Record<OrganizationRole, PricingPermissions> = {
  OWNER: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
  },
  ADMIN: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
  },
  OPERATIONS: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: true,
    viewInternalPricing: true,
  },
  FINANCE: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: true,
  },
  VIEWER: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: false,
  },
};

export function getPricingPermissions(role: OrganizationRole | undefined): PricingPermissions {
  if (!role) {
    return {
      viewCommercialSummary: false,
      setManualPrice: false,
      editComposition: false,
      viewInternalPricing: false,
    };
  }

  return pricingPermissions[role];
}
