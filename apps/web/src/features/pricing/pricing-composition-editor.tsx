import { useQueries, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProduct } from '@/features/products/products-api';
import { useProductQuery } from '@/features/products/use-product-query';
import { ApiError } from '@/lib/api';

import { getPricingComposition } from './pricing-composition-api';
import {
  PricingCompositionForm,
  type PricingCatalogProductOption,
} from './pricing-composition-form';
import { pricingQueryKeys } from './pricing-query-keys';
import { usePricingCompositionQuery } from './use-pricing-composition-query';
import { usePricingConfigurationQuery } from './use-pricing-configuration-query';
import { usePricingCatalogQuery } from './use-pricing-catalog-query';
import { useAllActivePricingProfilesQuery } from './use-pricing-profiles-query';

export function PricingCompositionEditor({
  productId,
  canEdit,
  canSimulate,
}: {
  productId: string;
  canEdit: boolean;
  canSimulate: boolean;
}) {
  const queryClient = useQueryClient();
  const compositionQuery = usePricingCompositionQuery(productId, true);
  const productQuery = useProductQuery(productId);
  const profilesQuery = useAllActivePricingProfilesQuery(true);
  const catalogQuery = usePricingCatalogQuery(true);
  const configurationQuery = usePricingConfigurationQuery(true);
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
    linkedCatalogQueries.some((query) => query.isPending);
  if (pending) {
    return (
      <p role="status" className="mt-6 text-sm text-muted-foreground">
        Carregando composição...
      </p>
    );
  }

  const error =
    compositionQuery.error ?? productQuery.error ?? profilesQuery.error ?? catalogQuery.error;
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
              catalogQuery.isFetching
            }
            onClick={() => {
              const retries: Array<Promise<unknown>> = [
                compositionQuery.refetch(),
                productQuery.refetch(),
                profilesQuery.refetch(),
                catalogQuery.refetch(),
              ];
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
      directCost: product.directCost,
      isActive: product.isActive,
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
          directCost: resolved?.directCost,
          isActive: resolved?.isActive ?? false,
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
        product={productQuery.data}
        composition={composition}
        canEdit={canEdit}
        canSimulate={canSimulate}
        profiles={profilesQuery.data}
        catalogProducts={catalogProducts}
        configuration={configurationQuery.data}
        configurationStatus={
          configurationQuery.isPending
            ? 'loading'
            : configurationQuery.isError
              ? configurationQuery.error instanceof ApiError &&
                configurationQuery.error.code === 'PRICING_CONFIGURATION_NOT_FOUND'
                ? 'missing'
                : 'error'
              : 'available'
        }
        configurationError={configurationQuery.error?.message}
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
