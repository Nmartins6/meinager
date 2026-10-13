import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { formatBrl } from './format-pricing';
import { getPricingPermissions, type OrganizationRole } from './pricing-permissions';
import { ManualProductPriceDialog } from './manual-product-price-dialog';
import { usePricingProductSummaryQuery } from './use-pricing-product-summary-query';

interface ProductCommercialSummaryProps {
  productId: string;
  role: OrganizationRole | undefined;
}

export function ProductCommercialSummary({ productId, role }: ProductCommercialSummaryProps) {
  const summaryQuery = usePricingProductSummaryQuery(productId);
  const permissions = getPricingPermissions(role);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Resumo comercial</CardTitle>
        <CardDescription>Preço atual e situação da precificação deste item.</CardDescription>
      </CardHeader>
      <CardContent>
        {summaryQuery.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando resumo comercial...
          </p>
        )}

        {summaryQuery.isError && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {summaryQuery.error.message}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void summaryQuery.refetch()}
              disabled={summaryQuery.isFetching}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {summaryQuery.data && (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">Preço atual</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {formatBrl(summaryQuery.data.salePrice)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Origem</dt>
                <dd className="mt-1 font-medium">
                  {summaryQuery.data.priceOrigin === 'PRICING_VERSION'
                    ? 'Versão de precificação'
                    : 'Preço manual'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Composição</dt>
                <dd className="mt-1 font-medium">
                  {summaryQuery.data.hasComposition
                    ? 'Composição cadastrada'
                    : 'Sem composição cadastrada'}
                </dd>
              </div>
            </dl>

            {permissions.setManualPrice && (
              <ManualProductPriceDialog
                productId={productId}
                currentPrice={summaryQuery.data.salePrice}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
