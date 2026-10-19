import { apiRequest } from '@/lib/api';

import type { PricingProfileListFilters } from './pricing-query-keys';
import {
  createPricingProfileInputSchema,
  deactivatePricingProfileInputSchema,
  pricingProfileDetailSchema,
  pricingProfilesListSchema,
  type CreatePricingProfileInput,
  type DeactivatePricingProfileInput,
  type PricingProfileDetail,
  type PricingProfilesList,
  type UpdatePricingProfileInput,
  updatePricingProfileInputSchema,
} from './pricing-profiles-contracts';

export async function listPricingProfiles(
  filters: PricingProfileListFilters,
): Promise<PricingProfilesList> {
  const parameters = new URLSearchParams();
  parameters.set('page', String(filters.page ?? 1));
  parameters.set('pageSize', String(filters.pageSize ?? 20));
  if (filters.isActive !== undefined) parameters.set('isActive', String(filters.isActive));
  const response = await apiRequest(`/pricing/profiles?${parameters.toString()}`);
  return pricingProfilesListSchema.parse(await response.json());
}

export async function getPricingProfile(profileId: string): Promise<PricingProfileDetail> {
  const response = await apiRequest(`/pricing/profiles/${profileId}`);
  return pricingProfileDetailSchema.parse(await response.json());
}

export async function createPricingProfile(
  input: CreatePricingProfileInput,
): Promise<PricingProfileDetail> {
  const parsed = createPricingProfileInputSchema.parse(input);
  const response = await apiRequest('/pricing/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  return pricingProfileDetailSchema.parse(await response.json());
}

export async function updatePricingProfile(
  profileId: string,
  input: UpdatePricingProfileInput,
): Promise<PricingProfileDetail> {
  const parsed = updatePricingProfileInputSchema.parse(input);
  const response = await apiRequest(`/pricing/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  return pricingProfileDetailSchema.parse(await response.json());
}

export async function deactivatePricingProfile(
  profileId: string,
  input: DeactivatePricingProfileInput,
): Promise<PricingProfileDetail> {
  const parsed = deactivatePricingProfileInputSchema.parse(input);
  const response = await apiRequest(`/pricing/profiles/${profileId}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  return pricingProfileDetailSchema.parse(await response.json());
}
