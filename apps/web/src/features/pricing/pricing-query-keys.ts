export interface PricingProfileListFilters {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export interface PricingVersionListFilters {
  page?: number;
  pageSize?: number;
}

export const pricingQueryKeys = {
  all: ['pricing'] as const,
  configuration: () => ['pricing', 'configuration'] as const,
  profiles: {
    all: () => ['pricing', 'profiles'] as const,
    lists: () => ['pricing', 'profiles', 'list'] as const,
    allActive: () => ['pricing', 'profiles', 'list', 'all-active'] as const,
    list: (filters: PricingProfileListFilters = {}) =>
      ['pricing', 'profiles', 'list', filters] as const,
    detail: (profileId: string) => ['pricing', 'profiles', 'detail', profileId] as const,
  },
  products: {
    summary: (productId: string) => ['pricing', 'products', productId, 'summary'] as const,
    composition: (productId: string) => ['pricing', 'products', productId, 'composition'] as const,
    versions: {
      all: (productId: string) => ['pricing', 'products', productId, 'versions'] as const,
      list: (productId: string, filters: PricingVersionListFilters = {}) =>
        ['pricing', 'products', productId, 'versions', 'list', filters] as const,
      detail: (productId: string, versionId: string) =>
        ['pricing', 'products', productId, 'versions', 'detail', versionId] as const,
    },
  },
};
