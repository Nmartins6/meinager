import { FileText, Plus, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type FinancialEntryCategoryType,
  type FinancialEntryStatus,
} from '@/features/finance/financial-entries-api';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { useFinancialEntriesQuery } from '@/features/finance/use-financial-entries-query';
import { useFinancialPeriodsQuery } from '@/features/finance/use-financial-periods-query';
import { cn } from '@/lib/utils';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const entryStatusLabels: Record<FinancialEntryStatus, string> = {
  PENDING: 'Pendente',
  PARTIAL: 'Parcial',
  SETTLED: 'Liquidado',
  CANCELLED: 'Cancelado',
};

type CategoryTypeFilter = FinancialEntryCategoryType | 'ALL';
type EntryStatusFilter = FinancialEntryStatus | 'ALL';

function formatPeriod(year: number, month: number): string {
  return `${monthNames[month - 1]} de ${year}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string): string {
  const [integerPart, decimalPart = '00'] = value.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${formattedInteger},${decimalPart}`;
}

export function FinancialEntriesPage() {
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUserQuery();

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryType, setCategoryType] = useState<CategoryTypeFilter>('ALL');
  const [status, setStatus] = useState<EntryStatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const periodsQuery = useFinancialPeriodsQuery();
  const periods = periodsQuery.data ?? [];

  const activePeriodId =
    selectedPeriodId && periods.some((period) => period.id === selectedPeriodId)
      ? selectedPeriodId
      : periods[0]?.id;

  const entriesQuery = useFinancialEntriesQuery(
    {
      periodId: activePeriodId,
      search: search || undefined,
      categoryType: categoryType === 'ALL' ? undefined : categoryType,
      status: status === 'ALL' ? undefined : status,
      page,
      pageSize: 10,
    },
    Boolean(activePeriodId),
  );

  const response = entriesQuery.data;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Lançamentos financeiros</h1>
          <p className="mt-2 text-muted-foreground">
            Consulte as receitas e despesas registradas em cada competência.
          </p>
        </div>

        {canManage && (
          <Button type="button" onClick={() => navigate('/app/financeiro/lancamentos/novo')}>
            <Plus data-icon="inline-start" />
            Novo lançamento
          </Button>
        )}
      </div>

      <FinancialNavigation />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Movimentações da competência</CardTitle>
          <CardDescription>
            {response
              ? `${response.pagination.total} lançamento(s) encontrado(s).`
              : 'Selecione uma competência para consultar os lançamentos.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {periodsQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando competências financeiras...
            </p>
          )}

          {periodsQuery.isError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {periodsQuery.error.message}
            </p>
          )}

          {periodsQuery.isSuccess && periods.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <FileText className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhuma competência financeira cadastrada</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Crie uma competência no resumo financeiro antes de registrar lançamentos.
              </p>
            </div>
          )}

          {periods.length > 0 && (
            <>
              <form
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-[240px_1fr_190px_170px_auto] xl:items-end"
                onSubmit={handleSearch}
              >
                <div className="space-y-2">
                  <Label htmlFor="entry-period-filter">Competência</Label>
                  <select
                    id="entry-period-filter"
                    value={activePeriodId ?? ''}
                    onChange={(event) => {
                      setSelectedPeriodId(event.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {formatPeriod(period.year, period.month)}
                        {period.status === 'CLOSED' ? ' — Fechada' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry-search">Buscar</Label>
                  <Input
                    id="entry-search"
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Descrição ou observações"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry-type-filter">Tipo</Label>
                  <select
                    id="entry-type-filter"
                    value={categoryType}
                    onChange={(event) => {
                      setCategoryType(event.target.value as CategoryTypeFilter);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="ALL">Todos</option>
                    <option value="REVENUE">Receitas</option>
                    <option value="FIXED_EXPENSE">Custos fixos</option>
                    <option value="VARIABLE_EXPENSE">Custos variáveis</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry-status-filter">Status</Label>
                  <select
                    id="entry-status-filter"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as EntryStatusFilter);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="ALL">Todos</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="PARTIAL">Parciais</option>
                    <option value="SETTLED">Liquidados</option>
                    <option value="CANCELLED">Cancelados</option>
                  </select>
                </div>

                <Button type="submit" disabled={entriesQuery.isFetching}>
                  <Search data-icon="inline-start" />
                  Buscar
                </Button>
              </form>

              {entriesQuery.isPending && (
                <p role="status" className="py-12 text-center text-muted-foreground">
                  Carregando lançamentos...
                </p>
              )}

              {entriesQuery.isError && (
                <p
                  role="alert"
                  className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {entriesQuery.error.message}
                </p>
              )}

              {response && response.data.length === 0 && (
                <div className="grid place-items-center py-14 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                    <FileText className="size-6 text-primary" />
                  </div>
                  <p className="mt-4 font-medium">Nenhum lançamento encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Registre um lançamento ou altere os filtros.
                  </p>
                </div>
              )}

              {response && response.data.length > 0 && (
                <>
                  <div className="mt-6 overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-4xl text-left text-sm">
                      <thead className="bg-muted/60 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Descrição</th>
                          <th className="px-4 py-3 font-medium">Categoria</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Vencimento</th>
                          <th className="px-4 py-3 text-right font-medium">Valor</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {response.data.map((entry) => {
                          const isRevenue = entry.category.type === 'REVENUE';

                          return (
                            <tr key={entry.id} className="border-t bg-background">
                              <td className="px-4 py-3">
                                <p className="font-medium">{entry.description}</p>
                                {entry.origin === 'DUPLICATED' && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Duplicado do mês anterior
                                  </p>
                                )}
                              </td>

                              <td className="px-4 py-3 text-muted-foreground">
                                {entry.category.name}
                              </td>

                              <td className="px-4 py-3 text-muted-foreground">
                                {entry.client?.name ?? 'Não informado'}
                              </td>

                              <td className="px-4 py-3 text-muted-foreground">
                                {formatDate(entry.dueDate)}
                              </td>

                              <td
                                className={cn(
                                  'px-4 py-3 text-right font-medium',
                                  isRevenue ? 'text-emerald-700' : 'text-destructive',
                                  entry.status === 'CANCELLED' &&
                                    'text-muted-foreground line-through',
                                )}
                              >
                                {isRevenue ? '+' : '-'}
                                {formatCurrency(entry.amount)}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-medium',
                                    entry.status === 'PENDING' && 'bg-amber-100 text-amber-800',
                                    entry.status === 'PARTIAL' && 'bg-blue-100 text-blue-800',
                                    entry.status === 'SETTLED' && 'bg-emerald-100 text-emerald-800',
                                    entry.status === 'CANCELLED' && 'bg-zinc-200 text-zinc-700',
                                  )}
                                >
                                  {entryStatusLabels[entry.status]}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-sm text-muted-foreground">
                      Página {response.pagination.page} de{' '}
                      {Math.max(response.pagination.totalPages, 1)}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPage((current) => Math.max(current - 1, 1))}
                        disabled={page <= 1 || entriesQuery.isFetching}
                      >
                        Anterior
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPage((current) => current + 1)}
                        disabled={page >= response.pagination.totalPages || entriesQuery.isFetching}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
