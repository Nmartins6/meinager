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

export function useAllActivePricingProfilesQuery(enabled: boolean) {
  return useQuery({
    queryKey: pricingQueryKeys.profiles.allActive(),
    queryFn: async () => {
      const profiles = new Map<
        string,
        Awaited<ReturnType<typeof listPricingProfiles>>['data'][number]
      >();
      let page = 1;
      let totalPages = 1;
      do {
        const response = await listPricingProfiles({ page, pageSize: 100, isActive: true });
        for (const profile of response.data) {
          if (!profiles.has(profile.id)) profiles.set(profile.id, profile);
        }
        totalPages = response.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);
      return [...profiles.values()];
    },
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
