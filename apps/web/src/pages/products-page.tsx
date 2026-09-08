import { Package, Plus, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductType } from '@/features/products/products-api';
import { useProductsQuery } from '@/features/products/use-products-query';

type StatusFilter = 'active' | 'inactive' | 'all';
type TypeFilter = ProductType | 'all';
type InventoryFilter = 'tracked' | 'untracked' | 'all';

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function formatDirectCost(value: string | null): string {
  if (value === null) {
    return 'Não informado';
  }

  const [integer = '0', fraction = ''] = value.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPlaces = fraction.replace(/0+$/, '').padEnd(2, '0');

  return `R$ ${groupedInteger},${decimalPlaces}`;
}

export function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [type, setType] = useState<TypeFilter>('all');
  const [inventory, setInventory] = useState<InventoryFilter>('all');
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'OPERATIONS';
  const [page, setPage] = useState(1);

  const productsQuery = useProductsQuery({
    search: search || undefined,
    type: type === 'all' ? undefined : type,
    isActive: status === 'all' ? undefined : status === 'active',
    trackInventory: inventory === 'all' ? undefined : inventory === 'tracked',
    page,
    pageSize: 10,
  });

  const response = productsQuery.isError ? undefined : productsQuery.data;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Produtos e serviços</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte seu catálogo, custos diretos e configurações de estoque.
        </p>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>
            {productsQuery.isError
              ? 'Não foi possível carregar o catálogo.'
              : response
                ? `${response.pagination.total} item(ns) encontrado(s).`
                : 'Carregando seu catálogo.'}
          </CardDescription>
        </CardHeader>

        {canManage && (
          <Button className="mt-5" onClick={() => navigate('/app/produtos/novo')}>
            <Plus data-icon="inline-start" />
            Novo produto ou serviço
          </Button>
        )}

        <CardContent>
          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="product-search">Buscar produtos e serviços</Label>
                <Input
                  id="product-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Nome, SKU ou código de barras"
                  maxLength={150}
                />
              </div>

              <Button type="submit" disabled={productsQuery.isFetching}>
                <Search data-icon="inline-start" />
                Buscar
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="product-type">Tipo</Label>
                <select
                  id="product-type"
                  className={selectClassName}
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as TypeFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="PRODUCT">Produtos</option>
                  <option value="SERVICE">Serviços</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-status">Status</Label>
                <select
                  id="product-status"
                  className={selectClassName}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="all">Todos</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-inventory">Controle de estoque</Label>
                <select
                  id="product-inventory"
                  className={selectClassName}
                  value={inventory}
                  onChange={(event) => {
                    setInventory(event.target.value as InventoryFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="tracked">Com controle</option>
                  <option value="untracked">Sem controle</option>
                </select>
              </div>
            </div>
          </form>

          {productsQuery.isFetching && (
            <p role="status" className="py-6 text-center text-muted-foreground">
              {productsQuery.isPending ? 'Carregando catálogo...' : 'Atualizando catálogo...'}
            </p>
          )}

          {productsQuery.isError && (
            <div className="mt-6 space-y-3">
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {productsQuery.error.message}
              </p>

              <Button
                variant="outline"
                onClick={() => void productsQuery.refetch()}
                disabled={productsQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {response && response.data.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <Package className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum produto ou serviço encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Confira os filtros e o termo utilizado na busca.
              </p>
            </div>
          )}

          {response && response.data.length > 0 && (
            <div
              className="mt-6 overflow-x-auto rounded-lg border"
              aria-busy={productsQuery.isFetching}
            >
              <table className="w-full min-w-[900px] text-left text-sm">
                <caption className="sr-only">Produtos e serviços do catálogo</caption>
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Nome
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Tipo
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      SKU
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Unidade
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Custo direto
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Controle de estoque
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {response.data.map((product) => (
                    <tr key={product.id} className="border-t bg-background">
                      <td className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-primary hover:underline"
                          onClick={() => navigate(`/app/produtos/${product.id}`)}
                        >
                          {product.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.type === 'PRODUCT' ? 'Produto' : 'Serviço'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product.sku ?? 'Não informado'}
                      </td>
                      <td className="px-4 py-3">{product.unit}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {formatDirectCost(product.directCost)}
                      </td>
                      <td className="px-4 py-3">{product.trackInventory ? 'Sim' : 'Não'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            product.isActive
                              ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800'
                              : 'rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700'
                          }
                        >
                          {product.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {response && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={page <= 1 || productsQuery.isFetching}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page >= response.pagination.totalPages || productsQuery.isFetching}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
