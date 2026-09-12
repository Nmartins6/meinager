import { ArrowLeft, Package } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { ProductForm, type ProductFormData } from '@/features/products/product-form';
import { useProductQuery } from '@/features/products/use-product-query';
import { useUpdateProductMutation } from '@/features/products/use-update-product-mutation';
import { ProductInventory } from '@/features/inventory/product-inventory';

export function ProductPage() {
  const navigate = useNavigate();
  const { productId = '' } = useParams();
  const currentUserQuery = useCurrentUserQuery();
  const productQuery = useProductQuery(productId);
  const updateProductMutation = useUpdateProductMutation();
  const product = productQuery.data;

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';

  function handleSubmit(data: ProductFormData) {
    const trackInventory = data.type === 'PRODUCT' && data.trackInventory;

    updateProductMutation.mutate(
      {
        productId,
        input: {
          type: data.type,
          name: data.name.trim(),
          sku: data.sku.trim() || null,
          barcode: data.barcode.trim() || null,
          unit: data.unit.trim().toUpperCase(),
          directCost: data.directCost.trim() || null,
          salePrice: data.salePrice.trim() || null,
          trackInventory,
          minimumStock: trackInventory ? data.minimumStock.trim() || null : null,
          notes: data.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          navigate('/app/produtos', { replace: true });
        },
      },
    );
  }

  function handleStatusChange() {
    if (!product) {
      return;
    }

    updateProductMutation.mutate({
      productId,
      input: {
        isActive: !product.isActive,
      },
    });
  }

  if (productQuery.isPending || currentUserQuery.isPending) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p role="status" className="text-muted-foreground">
          Carregando produto...
        </p>
      </section>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {productQuery.error?.message ?? 'Não foi possível carregar o produto.'}
        </p>

        <Link
          to="/app/produtos"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Voltar para produtos
        </Link>
      </section>
    );
  }

  if (currentUserQuery.isError) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {currentUserQuery.error.message}
        </p>
      </section>
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

      {canManage ? (
        <>
          <Card className="mt-6">
            <CardHeader>
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
                <Package className="size-5 text-primary" />
              </div>
              <CardTitle className="text-2xl">Editar produto ou serviço</CardTitle>
              <CardDescription>
                Atualize os dados de {product.name}. Produtos com histórico de estoque não podem
                alterar tipo, unidade ou controle de estoque.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ProductForm
                initialValues={{
                  type: product.type,
                  name: product.name,
                  sku: product.sku ?? '',
                  barcode: product.barcode ?? '',
                  unit: product.unit,
                  directCost: product.directCost ?? '',
                  salePrice: product.salePrice ?? '',
                  trackInventory: product.trackInventory,
                  minimumStock: product.minimumStock ?? '',
                  notes: product.notes ?? '',
                }}
                submitLabel="Salvar alterações"
                pendingLabel="Salvando..."
                isPending={updateProductMutation.isPending}
                errorMessage={updateProductMutation.error?.message}
                onSubmit={handleSubmit}
                onCancel={() => navigate('/app/produtos')}
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Status do item</CardTitle>
              <CardDescription>
                Itens inativos permanecem no histórico, mas não podem receber novas movimentações de
                estoque.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">{product.isActive ? 'Item ativo' : 'Item inativo'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.isActive
                    ? 'O item está disponível para novos usos.'
                    : 'Reative para voltar a utilizar este item.'}
                </p>
              </div>

              <Button
                variant={product.isActive ? 'destructive' : 'default'}
                onClick={handleStatusChange}
                disabled={updateProductMutation.isPending}
              >
                {product.isActive ? 'Inativar item' : 'Reativar item'}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Você não possui permissão para editar este item.</p>
          </CardContent>
        </Card>
      )}

      {product.type === 'PRODUCT' && product.trackInventory ? (
        <ProductInventory
          productId={product.id}
          unit={product.unit}
          canManage={canManage}
          isActive={product.isActive}
        />
      ) : null}
    </section>
  );
}
