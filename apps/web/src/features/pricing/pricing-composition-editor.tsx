import { useQueries, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProduct } from '@/features/products/products-api';
import { useProductQuery } from '@/features/products/use-product-query';

import { getPricingComposition } from './pricing-composition-api';
import {
  PricingCompositionForm,
  type PricingCatalogProductOption,
} from './pricing-composition-form';
import { pricingQueryKeys } from './pricing-query-keys';
import { usePricingCompositionQuery } from './use-pricing-composition-query';
import { usePricingCatalogQuery } from './use-pricing-catalog-query';
import {
  useAllActivePricingProfilesQuery,
  usePricingProfileQuery,
} from './use-pricing-profiles-query';

export function PricingCompositionEditor({
  productId,
  canEdit,
}: {
  productId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const compositionQuery = usePricingCompositionQuery(productId, true);
  const productQuery = useProductQuery(productId);
  const profilesQuery = useAllActivePricingProfilesQuery(true);
  const catalogQuery = usePricingCatalogQuery(true);
  const linkedProfileId = compositionQuery.data?.profileId ?? '';
  const shouldLoadLinkedProfile =
    profilesQuery.isSuccess &&
    linkedProfileId !== '' &&
    !profilesQuery.data.some((profile) => profile.id === linkedProfileId);
  const linkedProfileQuery = usePricingProfileQuery(linkedProfileId, shouldLoadLinkedProfile);
  const linkedCatalogSourceIds = [
    ...new Set(
      (compositionQuery.data?.components ?? [])
        .filter((component) => component.costSource === 'CATALOG')
        .map((component) => component.sourceProductId)
        .filter((sourceProductId): sourceProductId is string => sourceProductId !== null),
    ),
  ];
  const listedCatalogProducts = catalogQuery.data ?? [];
  const listedCatalogById = new Map(listedCatalogProducts.map((product) => [product.id, product]));
  const unresolvedCatalogSourceIds = linkedCatalogSourceIds.filter(
    (sourceProductId) => !listedCatalogById.has(sourceProductId),
  );
  const linkedCatalogQueries = useQueries({
    queries: unresolvedCatalogSourceIds.map((sourceProductId) => ({
      queryKey: ['products', 'detail', sourceProductId] as const,
      queryFn: () => getProduct(sourceProductId),
      retry: false,
    })),
  });
  const pending =
    compositionQuery.isPending ||
    productQuery.isPending ||
    profilesQuery.isPending ||
    catalogQuery.isPending ||
    (shouldLoadLinkedProfile && linkedProfileQuery.isPending) ||
    linkedCatalogQueries.some((query) => query.isPending);
  if (pending) {
    return (
      <p role="status" className="mt-6 text-sm text-muted-foreground">
        Carregando composição...
      </p>
    );
  }

  const error =
    compositionQuery.error ??
    productQuery.error ??
    profilesQuery.error ??
    catalogQuery.error ??
    (shouldLoadLinkedProfile ? linkedProfileQuery.error : null);
  if (error || !productQuery.data || !profilesQuery.data || !catalogQuery.data) {
    return (
      <Card className="mt-6">
        <CardContent className="space-y-3 py-6">
          <p role="alert" className="text-sm text-destructive">
            {error?.message ?? 'Não foi possível carregar os dados da composição.'}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={
              compositionQuery.isFetching ||
              productQuery.isFetching ||
              profilesQuery.isFetching ||
              catalogQuery.isFetching ||
              (shouldLoadLinkedProfile && linkedProfileQuery.isFetching)
            }
            onClick={() => {
              const retries: Array<Promise<unknown>> = [
                compositionQuery.refetch(),
                productQuery.refetch(),
                profilesQuery.refetch(),
                catalogQuery.refetch(),
              ];
              if (shouldLoadLinkedProfile) retries.push(linkedProfileQuery.refetch());
              void Promise.all(retries);
            }}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const composition = compositionQuery.data ?? null;
  if (!composition && !canEdit) {
    return (
      <Card className="mt-6">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Este produto ainda não possui composição persistida.
        </CardContent>
      </Card>
    );
  }

  const eligibleCatalogProducts = catalogQuery.data.filter(
    (product) =>
      product.id !== productId && product.isActive && typeof product.directCost === 'string',
  );
  const eligibleCatalogIds = new Set(eligibleCatalogProducts.map((product) => product.id));
  const resolvedLinkedCatalogById = new Map(listedCatalogById);
  unresolvedCatalogSourceIds.forEach((sourceProductId, index) => {
    const resolved = linkedCatalogQueries[index]?.data;
    if (resolved) resolvedLinkedCatalogById.set(sourceProductId, resolved);
  });
  const componentUnitBySourceId = new Map(
    (composition?.components ?? [])
      .filter(
        (component) => component.costSource === 'CATALOG' && component.sourceProductId !== null,
      )
      .map((component) => [component.sourceProductId!, component.unit]),
  );
  const catalogProducts: PricingCatalogProductOption[] = [
    ...eligibleCatalogProducts.map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      eligible: true,
    })),
    ...linkedCatalogSourceIds
      .filter((sourceProductId) => !eligibleCatalogIds.has(sourceProductId))
      .map((sourceProductId) => {
        const resolved = resolvedLinkedCatalogById.get(sourceProductId);
        return {
          id: sourceProductId,
          name: resolved?.name ?? `Produto ${sourceProductId}`,
          unit:
            resolved?.unit ??
            componentUnitBySourceId.get(sourceProductId) ??
            'unidade desconhecida',
          eligible: false,
        };
      }),
  ];

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Composição de {productQuery.data.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {composition
            ? `Edite os parâmetros e componentes da revisão ${composition.revision}.`
            : 'Crie a composição persistida deste produto.'}
        </p>
      </div>
      <PricingCompositionForm
        productId={productId}
        composition={composition}
        canEdit={canEdit}
        profiles={profilesQuery.data}
        linkedProfile={linkedProfileQuery.data}
        catalogProducts={catalogProducts}
        onCancel={() => void compositionQuery.refetch()}
        onReload={async () => {
          try {
            const loaded = await getPricingComposition(productId);
            queryClient.setQueryData(pricingQueryKeys.products.composition(productId), loaded);
            return { success: true, composition: loaded };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Não foi possível recarregar a composição.',
            };
          }
        }}
      />
    </div>
  );
}
