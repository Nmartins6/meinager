import { ArrowLeft } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { ProductCommercialSummary } from '@/features/pricing/product-commercial-summary';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';

const PricingCompositionEditor = lazy(async () => {
  const module = await import('@/features/pricing/pricing-composition-editor');
  return { default: module.PricingCompositionEditor };
});

export function ProductPricingPage() {
  const { productId = '' } = useParams();
  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const permissions = getPricingPermissions(role);

  if (currentUserQuery.isPending) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p role="status" className="text-muted-foreground">
          Preparando precificação...
        </p>
      </section>
    );
  }

  if (currentUserQuery.isError) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p role="alert" className="text-sm text-destructive">
          {currentUserQuery.error.message}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <Link
        to={`/app/produtos/${productId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para o produto
      </Link>

      <div className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Precificação do produto</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte a situação comercial atual deste item.
        </p>
      </div>

      <ProductCommercialSummary productId={productId} role={role} />

      {permissions.viewInternalPricing && (
        <Suspense
          fallback={
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Preparando composição...
            </p>
          }
        >
          <PricingCompositionEditor
            key={productId}
            productId={productId}
            canEdit={permissions.editComposition}
            canSimulate={permissions.simulatePricing}
            canAdopt={permissions.adoptPricing}
            canAdoptBelowMinimum={permissions.adoptBelowMinimum}
          />
        </Suspense>
      )}
    </section>
  );
}
