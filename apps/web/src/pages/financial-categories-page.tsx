import { Pencil, Plus, Search, Tags } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import {
  type FinancialCategory,
  type FinancialCategoryType,
} from '@/features/finance/financial-categories-api';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { useCreateFinancialCategoryMutation } from '@/features/finance/use-create-financial-category-mutation';
import { useFinancialCategoriesQuery } from '@/features/finance/use-financial-categories-query';
import { useUpdateFinancialCategoryMutation } from '@/features/finance/use-update-financial-category-mutation';

const categoryTypeLabels: Record<FinancialCategoryType, string> = {
  REVENUE: 'Receita',
  FIXED_EXPENSE: 'Custo fixo',
  VARIABLE_EXPENSE: 'Custo variável',
};

type CategoryTypeFilter = FinancialCategoryType | 'ALL';
type CategoryStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

export function FinancialCategoriesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CategoryTypeFilter>('ALL');
  const [status, setStatus] = useState<CategoryStatusFilter>('ACTIVE');

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FinancialCategoryType>('FIXED_EXPENSE');
  const [createError, setCreateError] = useState<string>();

  const [editingCategoryId, setEditingCategoryId] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [updateError, setUpdateError] = useState<string>();

  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const categoriesQuery = useFinancialCategoriesQuery({
    search: search || undefined,
    type: type === 'ALL' ? undefined : type,
    isActive: status === 'ALL' ? undefined : status === 'ACTIVE',
  });

  const createMutation = useCreateFinancialCategoryMutation();
  const updateMutation = useUpdateFinancialCategoryMutation();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newName.trim();

    if (name.length < 2) {
      setCreateError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    setCreateError(undefined);
    createMutation.reset();

    createMutation.mutate(
      {
        name,
        type: newType,
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewType('FIXED_EXPENSE');
          setIsCreating(false);
        },
      },
    );
  }

  function beginEditing(category: FinancialCategory) {
    setEditingCategoryId(category.id);
    setEditingName(category.name);
    setUpdateError(undefined);
    updateMutation.reset();
  }

  function cancelEditing() {
    setEditingCategoryId(undefined);
    setEditingName('');
    setUpdateError(undefined);
  }

  function handleUpdateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCategoryId) {
      return;
    }

    const name = editingName.trim();

    if (name.length < 2) {
      setUpdateError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    setUpdateError(undefined);
    updateMutation.reset();

    updateMutation.mutate(
      {
        categoryId: editingCategoryId,
        input: {
          name,
        },
      },
      {
        onSuccess: cancelEditing,
      },
    );
  }

  function handleToggleStatus(category: FinancialCategory) {
    setUpdateError(undefined);
    updateMutation.reset();

    updateMutation.mutate({
      categoryId: category.id,
      input: {
        isActive: !category.isActive,
      },
    });
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Categorias financeiras</h1>
          <p className="mt-2 text-muted-foreground">
            Organize receitas, custos fixos e custos variáveis.
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            onClick={() => {
              setIsCreating((current) => !current);
              setCreateError(undefined);
              createMutation.reset();
            }}
          >
            <Plus data-icon="inline-start" />
            {isCreating ? 'Fechar formulário' : 'Nova categoria'}
          </Button>
        )}
      </div>

      <FinancialNavigation />

      {isCreating && canManage && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Nova categoria</CardTitle>
            <CardDescription>O tipo não poderá ser alterado depois da criação.</CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-5 sm:grid-cols-[1fr_220px_auto] sm:items-end"
              onSubmit={handleCreate}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="new-category-name">Nome</Label>
                <Input
                  id="new-category-name"
                  value={newName}
                  maxLength={100}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ex.: Aluguel"
                  aria-invalid={Boolean(createError)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-category-type">Tipo</Label>
                <select
                  id="new-category-type"
                  value={newType}
                  onChange={(event) => setNewType(event.target.value as FinancialCategoryType)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="REVENUE">Receita</option>
                  <option value="FIXED_EXPENSE">Custo fixo</option>
                  <option value="VARIABLE_EXPENSE">Custo variável</option>
                </select>
              </div>

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar categoria'}
              </Button>
            </form>

            {createError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {createError}
              </p>
            )}

            {createMutation.isError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {createMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Cadastro de categorias</CardTitle>
          <CardDescription>
            {categoriesQuery.isSuccess
              ? `${categories.length} categoria(s) encontrada(s).`
              : 'Carregando suas categorias.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_210px_180px_auto] sm:items-end"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="category-search">Buscar</Label>
              <Input
                id="category-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nome da categoria"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-type-filter">Tipo</Label>
              <select
                id="category-type-filter"
                value={type}
                onChange={(event) => setType(event.target.value as CategoryTypeFilter)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="ALL">Todos</option>
                <option value="REVENUE">Receitas</option>
                <option value="FIXED_EXPENSE">Custos fixos</option>
                <option value="VARIABLE_EXPENSE">Custos variáveis</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-status-filter">Status</Label>
              <select
                id="category-status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as CategoryStatusFilter)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="ACTIVE">Ativas</option>
                <option value="INACTIVE">Inativas</option>
                <option value="ALL">Todas</option>
              </select>
            </div>

            <Button type="submit" disabled={categoriesQuery.isFetching}>
              <Search data-icon="inline-start" />
              Buscar
            </Button>
          </form>

          {categoriesQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando categorias...
            </p>
          )}

          {categoriesQuery.isError && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {categoriesQuery.error.message}
            </p>
          )}

          {categoriesQuery.isSuccess && categories.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <Tags className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhuma categoria encontrada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre uma categoria ou altere os filtros.
              </p>
            </div>
          )}

          {categories.length > 0 && (
            <div className="mt-6 space-y-3">
              {categories.map((category) => {
                const isEditing = editingCategoryId === category.id;
                const isUpdating =
                  updateMutation.isPending && updateMutation.variables?.categoryId === category.id;

                return (
                  <div key={category.id} className="rounded-lg border bg-background p-4">
                    {isEditing ? (
                      <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={handleUpdateName}
                      >
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`category-name-${category.id}`}>Nome</Label>
                          <Input
                            id={`category-name-${category.id}`}
                            value={editingName}
                            maxLength={100}
                            onChange={(event) => setEditingName(event.target.value)}
                            aria-invalid={Boolean(updateError)}
                          />
                        </div>

                        <Button type="submit" disabled={isUpdating}>
                          {isUpdating ? 'Salvando...' : 'Salvar'}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={isUpdating}
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{category.name}</p>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              {categoryTypeLabels[category.type]}
                            </span>
                            <span
                              className={
                                category.isActive
                                  ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800'
                                  : 'rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700'
                              }
                            >
                              {category.isActive ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => beginEditing(category)}
                              disabled={updateMutation.isPending}
                            >
                              <Pencil data-icon="inline-start" />
                              Renomear
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleToggleStatus(category)}
                              disabled={updateMutation.isPending}
                            >
                              {isUpdating
                                ? 'Salvando...'
                                : category.isActive
                                  ? 'Inativar'
                                  : 'Reativar'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {isEditing && updateError && (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        {updateError}
                      </p>
                    )}

                    {updateMutation.isError &&
                      updateMutation.variables?.categoryId === category.id && (
                        <p role="alert" className="mt-3 text-sm text-destructive">
                          {updateMutation.error.message}
                        </p>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
