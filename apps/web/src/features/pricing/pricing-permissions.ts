import type { AuthResponse } from '@/lib/api';

export type OrganizationRole = AuthResponse['organization']['role'];

export interface PricingPermissions {
  viewCommercialSummary: boolean;
  setManualPrice: boolean;
  editComposition: boolean;
  viewInternalPricing: boolean;
  viewConfiguration: boolean;
  editConfiguration: boolean;
  viewProfiles: boolean;
  editProfiles: boolean;
}

export const pricingPermissions: Record<OrganizationRole, PricingPermissions> = {
  OWNER: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: true,
    viewProfiles: true,
    editProfiles: true,
  },
  ADMIN: {
    viewCommercialSummary: true,
    setManualPrice: true,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: true,
    viewProfiles: true,
    editProfiles: true,
  },
  OPERATIONS: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: true,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: false,
    viewProfiles: true,
    editProfiles: false,
  },
  FINANCE: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: true,
    viewConfiguration: true,
    editConfiguration: false,
    viewProfiles: true,
    editProfiles: false,
  },
  VIEWER: {
    viewCommercialSummary: true,
    setManualPrice: false,
    editComposition: false,
    viewInternalPricing: false,
    viewConfiguration: false,
    editConfiguration: false,
    viewProfiles: false,
    editProfiles: false,
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
      viewProfiles: false,
      editProfiles: false,
    };
  }

  return pricingPermissions[role];
}
