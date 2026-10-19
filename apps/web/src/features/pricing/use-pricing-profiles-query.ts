import { useQuery } from '@tanstack/react-query';

import { getPricingProfile, listPricingProfiles } from './pricing-profiles-api';
import { pricingQueryKeys, type PricingProfileListFilters } from './pricing-query-keys';

export function usePricingProfilesQuery(filters: PricingProfileListFilters, enabled: boolean) {
  return useQuery({
    queryKey: pricingQueryKeys.profiles.list(filters),
    queryFn: () => listPricingProfiles(filters),
    enabled,
    retry: false,
  });
}

export function usePricingProfileQuery(profileId: string, enabled: boolean) {
  return useQuery({
    queryKey: pricingQueryKeys.profiles.detail(profileId),
    queryFn: () => getPricingProfile(profileId),
    enabled,
    retry: false,
  });
}
