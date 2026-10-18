import type { AuthResponse } from '@/lib/api';

export type OrganizationRole = AuthResponse['organization']['role'];

export interface PricingPermissions {
  viewCommercialSummary: boolean;
  setManualPrice: boolean;
  editComposition: boolean;
  viewInternalPricing: boolean;
  viewConfiguration: boolean;
  editConfiguration: boolean;
}

export const pricingPermissions: Record<OrganizationRole, PricingPermissions> = {
  OWNER: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: true,
  },
  ADMIN: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: true,
  },
  OPERATIONS: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: false,
  },
  FINANCE: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: false,
  },
  VIEWER: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: false,
    viewConfiguration: false,
    editConfiguration: false,
  },
};

export function getPricingPermissions(role: OrganizationRole | undefined): PricingPermissions {
  if (!role) {
    return {
      viewCommercialSummary: false,
      setManualPrice: false,
      editComposition: false,
      viewInternalPricing: false,
      viewConfiguration: false,
      editConfiguration: false,
    };
  }

  return pricingPermissions[role];
}
