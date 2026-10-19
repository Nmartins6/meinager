import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createPricingProfile,
  deactivatePricingProfile,
  updatePricingProfile,
} from './pricing-profiles-api';
import type {
  CreatePricingProfileInput,
  DeactivatePricingProfileInput,
  UpdatePricingProfileInput,
} from './pricing-profiles-contracts';
import { pricingQueryKeys } from './pricing-query-keys';

export function useCreatePricingProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePricingProfileInput) => createPricingProfile(input),
    retry: false,
    onSuccess: (profile) => {
      queryClient.setQueryData(pricingQueryKeys.profiles.detail(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.profiles.lists() });
    },
  });
}

export function useUpdatePricingProfileMutation(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePricingProfileInput) => updatePricingProfile(profileId, input),
    retry: false,
    onSuccess: (profile) => {
      queryClient.setQueryData(pricingQueryKeys.profiles.detail(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.profiles.lists() });
    },
  });
}

export function useDeactivatePricingProfileMutation(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeactivatePricingProfileInput) =>
      deactivatePricingProfile(profileId, input),
    retry: false,
    onSuccess: (profile) => {
      queryClient.setQueryData(pricingQueryKeys.profiles.detail(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.profiles.lists() });
    },
  });
}
