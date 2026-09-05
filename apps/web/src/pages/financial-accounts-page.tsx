import { Landmark, Pencil, Plus, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import {
  type FinancialAccount,
  type FinancialAccountType,
} from '@/features/finance/financial-accounts-api';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { useCreateFinancialAccountMutation } from '@/features/finance/use-create-financial-account-mutation';
import { useFinancialAccountsQuery } from '@/features/finance/use-financial-accounts-query';
import { useUpdateFinancialAccountMutation } from '@/features/finance/use-update-financial-account-mutation';

const accountTypeLabels: Record<FinancialAccountType, string> = {
  CASH: 'Caixa',
  CHECKING_ACCOUNT: 'Conta corrente',
  SAVINGS_ACCOUNT: 'Conta poupança',
  DIGITAL_WALLET: 'Carteira digital',
  OTHER: 'Outra',
};

const moneyPattern = /^-?\d{1,12}(?:\.\d{1,2})?$/;

type AccountTypeFilter = FinancialAccountType | 'ALL';
type AccountStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

function formatCurrency(value: string): string {
  const isNegative = value.startsWith('-');
  const absoluteValue = isNegative ? value.slice(1) : value;
  const [integerPart, decimalPart = '00'] = absoluteValue.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${isNegative ? '-' : ''}R$ ${formattedInteger},${decimalPart}`;
}

export function FinancialAccountsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountTypeFilter>('ALL');
  const [status, setStatus] = useState<AccountStatusFilter>('ACTIVE');

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FinancialAccountType>('CHECKING_ACCOUNT');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0.00');
  const [createError, setCreateError] = useState<string>();

  const [editingAccountId, setEditingAccountId] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [editingOpeningBalance, setEditingOpeningBalance] = useState('');
  const [updateError, setUpdateError] = useState<string>();

  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const accountsQuery = useFinancialAccountsQuery({
    search: search || undefined,
    type: type === 'ALL' ? undefined : type,
    isActive: status === 'ALL' ? undefined : status === 'ACTIVE',
  });

  const createMutation = useCreateFinancialAccountMutation();
  const updateMutation = useUpdateFinancialAccountMutation();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newName.trim();
    const openingBalance = newOpeningBalance.trim();

    if (name.length < 2) {
      setCreateError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    if (!moneyPattern.test(openingBalance)) {
      setCreateError('Informe um saldo inicial válido com até duas casas decimais.');
      return;
    }

    setCreateError(undefined);
    createMutation.reset();

    createMutation.mutate(
      {
        name,
        type: newType,
        openingBalance,
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewType('CHECKING_ACCOUNT');
          setNewOpeningBalance('0.00');
          setIsCreating(false);
        },
      },
    );
  }

  function beginEditing(account: FinancialAccount) {
    setEditingAccountId(account.id);
    setEditingName(account.name);
    setEditingOpeningBalance(account.openingBalance);
    setUpdateError(undefined);
    updateMutation.reset();
  }

  function cancelEditing() {
    setEditingAccountId(undefined);
    setEditingName('');
    setEditingOpeningBalance('');
    setUpdateError(undefined);
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAccountId) {
      return;
    }

    const name = editingName.trim();
    const openingBalance = editingOpeningBalance.trim();

    if (name.length < 2) {
      setUpdateError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    if (!moneyPattern.test(openingBalance)) {
      setUpdateError('Informe um saldo inicial válido com até duas casas decimais.');
      return;
    }

    setUpdateError(undefined);
    updateMutation.reset();

    updateMutation.mutate(
      {
        accountId: editingAccountId,
        input: {
          name,
          openingBalance,
        },
      },
      {
        onSuccess: cancelEditing,
      },
    );
  }

  function handleToggleStatus(account: FinancialAccount) {
    setUpdateError(undefined);
    updateMutation.reset();

    updateMutation.mutate({
      accountId: account.id,
      input: {
        isActive: !account.isActive,
      },
    });
  }

  const accounts = accountsQuery.data ?? [];

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contas financeiras</h1>
          <p className="mt-2 text-muted-foreground">
            Cadastre os locais utilizados para receber e movimentar valores.
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
            {isCreating ? 'Fechar formulário' : 'Nova conta'}
          </Button>
        )}
      </div>

      <FinancialNavigation />

      {isCreating && canManage && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Nova conta financeira</CardTitle>
            <CardDescription>O tipo não poderá ser alterado depois da criação.</CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto] xl:items-end"
              onSubmit={handleCreate}
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="new-account-name">Nome</Label>
                <Input
                  id="new-account-name"
                  value={newName}
                  maxLength={100}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ex.: Conta principal"
                  aria-invalid={Boolean(createError)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-account-type">Tipo</Label>
                <select
                  id="new-account-type"
                  value={newType}
                  onChange={(event) => setNewType(event.target.value as FinancialAccountType)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="CASH">Caixa</option>
                  <option value="CHECKING_ACCOUNT">Conta corrente</option>
                  <option value="SAVINGS_ACCOUNT">Conta poupança</option>
                  <option value="DIGITAL_WALLET">Carteira digital</option>
                  <option value="OTHER">Outra</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-opening-balance">Saldo inicial</Label>
                <Input
                  id="new-opening-balance"
                  type="text"
                  inputMode="decimal"
                  value={newOpeningBalance}
                  onChange={(event) => setNewOpeningBalance(event.target.value)}
                  placeholder="0.00"
                  aria-invalid={Boolean(createError)}
                />
              </div>

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar conta'}
              </Button>
            </form>

            <p className="mt-3 text-xs text-muted-foreground">
              Use ponto para separar os centavos. Valores negativos são permitidos.
            </p>

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
          <CardTitle>Cadastro de contas</CardTitle>
          <CardDescription>
            {accountsQuery.isSuccess
              ? `${accounts.length} conta(s) encontrada(s).`
              : 'Carregando suas contas.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_220px_180px_auto] xl:items-end"
            onSubmit={handleSearch}
          >
            <div className="space-y-2">
              <Label htmlFor="account-search">Buscar</Label>
              <Input
                id="account-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nome da conta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type-filter">Tipo</Label>
              <select
                id="account-type-filter"
                value={type}
                onChange={(event) => setType(event.target.value as AccountTypeFilter)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="ALL">Todos</option>
                <option value="CASH">Caixa</option>
                <option value="CHECKING_ACCOUNT">Conta corrente</option>
                <option value="SAVINGS_ACCOUNT">Conta poupança</option>
                <option value="DIGITAL_WALLET">Carteira digital</option>
                <option value="OTHER">Outra</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-status-filter">Status</Label>
              <select
                id="account-status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as AccountStatusFilter)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="ACTIVE">Ativas</option>
                <option value="INACTIVE">Inativas</option>
                <option value="ALL">Todas</option>
              </select>
            </div>

            <Button type="submit" disabled={accountsQuery.isFetching}>
              <Search data-icon="inline-start" />
              Buscar
            </Button>
          </form>

          {accountsQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando contas financeiras...
            </p>
          )}

          {accountsQuery.isError && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {accountsQuery.error.message}
            </p>
          )}

          {accountsQuery.isSuccess && accounts.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <Landmark className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhuma conta financeira encontrada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre uma conta ou altere os filtros.
              </p>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="mt-6 space-y-3">
              {accounts.map((account) => {
                const isEditing = editingAccountId === account.id;
                const isUpdating =
                  updateMutation.isPending && updateMutation.variables?.accountId === account.id;

                return (
                  <div key={account.id} className="rounded-lg border bg-background p-4">
                    {isEditing ? (
                      <form
                        className="grid gap-3 sm:grid-cols-[1fr_220px_auto_auto] sm:items-end"
                        onSubmit={handleUpdate}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`account-name-${account.id}`}>Nome</Label>
                          <Input
                            id={`account-name-${account.id}`}
                            value={editingName}
                            maxLength={100}
                            onChange={(event) => setEditingName(event.target.value)}
                            aria-invalid={Boolean(updateError)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`opening-balance-${account.id}`}>Saldo inicial</Label>
                          <Input
                            id={`opening-balance-${account.id}`}
                            type="text"
                            inputMode="decimal"
                            value={editingOpeningBalance}
                            onChange={(event) => setEditingOpeningBalance(event.target.value)}
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
                            <p className="font-medium">{account.name}</p>

                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                              {accountTypeLabels[account.type]}
                            </span>

                            <span
                              className={
                                account.isActive
                                  ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800'
                                  : 'rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700'
                              }
                            >
                              {account.isActive ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground">
                            Saldo inicial:{' '}
                            <span className="font-medium text-foreground">
                              {formatCurrency(account.openingBalance)}
                            </span>
                          </p>
                        </div>

                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => beginEditing(account)}
                              disabled={updateMutation.isPending}
                            >
                              <Pencil data-icon="inline-start" />
                              Editar
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleToggleStatus(account)}
                              disabled={updateMutation.isPending}
                            >
                              {isUpdating
                                ? 'Salvando...'
                                : account.isActive
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
                      updateMutation.variables?.accountId === account.id && (
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
