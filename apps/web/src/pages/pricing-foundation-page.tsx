import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';

interface PricingFoundationPageProps {
  title: string;
}

export function PricingFoundationPage({ title }: PricingFoundationPageProps) {
  const currentUserQuery = useCurrentUserQuery();
  const permissions = getPricingPermissions(currentUserQuery.data?.organization.role);

  if (currentUserQuery.isPending) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-10">
        <p role="status" className="text-muted-foreground">
          Verificando acesso...
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Card className="mt-6">
        <CardContent className="py-10 text-center">
          <p className="font-medium">
            {permissions.viewInternalPricing
              ? 'Esta área será disponibilizada em uma próxima etapa.'
              : 'Você não possui acesso à precificação interna.'}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
