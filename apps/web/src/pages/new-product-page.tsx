import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { ProductForm, type ProductFormData } from '@/features/products/product-form';
import { useCreateProductMutation } from '@/features/products/use-create-product-mutation';

export function NewProductPage() {
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUserQuery();
  const createProductMutation = useCreateProductMutation();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';

  function handleSubmit(data: ProductFormData) {
    const trackInventory = data.type === 'PRODUCT' && data.trackInventory;

    createProductMutation.mutate(
      {
        type: data.type,
        name: data.name.trim(),
        sku: data.sku.trim() || undefined,
        barcode: data.barcode.trim() || undefined,
        unit: data.unit.trim().toUpperCase(),
        directCost: data.directCost.trim() || undefined,
        salePrice: data.salePrice.trim() || undefined,
        trackInventory,
        minimumStock: trackInventory ? data.minimumStock.trim() || undefined : undefined,
        notes: data.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          navigate('/app/produtos', { replace: true });
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/app/produtos"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para produtos
      </Link>

      {currentUserQuery.isPending && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Preparando o formulário...
        </p>
      )}

      {currentUserQuery.isError && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {currentUserQuery.error.message}
        </p>
      )}

      {!currentUserQuery.isPending && !currentUserQuery.isError && !canManage && (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Você não possui permissão para cadastrar produtos.</p>
          </CardContent>
        </Card>
      )}

      {!currentUserQuery.isPending && !currentUserQuery.isError && canManage && (
        <Card className="mt-6">
          <CardHeader>
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
              <PackagePlus className="size-5 text-primary" />
            </div>
            <h1 className="font-heading text-2xl leading-snug font-medium">
              Novo produto ou serviço
            </h1>
            <CardDescription>
              Cadastre itens do catálogo e ative o controle de estoque quando necessário.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ProductForm
              submitLabel="Salvar item"
              pendingLabel="Salvando..."
              isPending={createProductMutation.isPending}
              errorMessage={createProductMutation.error?.message}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/app/produtos')}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
