import { ArrowRight, Building2, CalendarClock, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { useFinancialEntriesQuery } from '@/features/finance/use-financial-entries-query';
import { useFinancialPeriodsQuery } from '@/features/finance/use-financial-periods-query';
import { useFinancialSummaryQuery } from '@/features/finance/use-financial-summary-query';

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: string): string {
  const negative = value.startsWith('-');
  const [integer, fraction = '00'] = (negative ? value.slice(1) : value).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${grouped},${fraction}`;
}

function FinancialDashboard() {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const inSevenDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const periodsQuery = useFinancialPeriodsQuery({ year: today.getFullYear() });
  const currentPeriod = periodsQuery.data?.find(
    (period) => period.year === today.getFullYear() && period.month === today.getMonth() + 1,
  );
  const summaryQuery = useFinancialSummaryQuery(currentPeriod?.id);
  const overduePending = useFinancialEntriesQuery({
    status: 'PENDING',
    dueTo: localDate(today),
    pageSize: 1,
  });
  const overduePartial = useFinancialEntriesQuery({
    status: 'PARTIAL',
    dueTo: localDate(today),
    pageSize: 1,
  });
  const upcomingPending = useFinancialEntriesQuery({
    status: 'PENDING',
    dueFrom: localDate(tomorrow),
    dueTo: localDate(inSevenDays),
    pageSize: 1,
  });
  const upcomingPartial = useFinancialEntriesQuery({
    status: 'PARTIAL',
    dueFrom: localDate(tomorrow),
    dueTo: localDate(inSevenDays),
    pageSize: 1,
  });
  const overdue =
    (overduePending.data?.pagination.total ?? 0) + (overduePartial.data?.pagination.total ?? 0);
  const upcoming =
    (upcomingPending.data?.pagination.total ?? 0) + (upcomingPartial.data?.pagination.total ?? 0);
  const dueQueries = [overduePending, overduePartial, upcomingPending, upcomingPartial];
  const dueLoading = dueQueries.some((query) => query.isPending);

  return (
    <section className="mt-10" aria-labelledby="financial-overview-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="financial-overview-title" className="text-xl font-semibold">
            Indicadores financeiros
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultado da competência atual e prazos dos lançamentos cadastrados.
          </p>
        </div>
        <Link to="/app/financeiro" className="text-sm font-medium text-primary hover:underline">
          Abrir financeiro <ArrowRight className="inline size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Faturamento do mês</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.totals.revenue) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resultado do mês</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.totals.result) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CircleAlert className="size-4" aria-hidden="true" /> Vencidos ou vencendo hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {dueLoading ? '—' : overdue}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4" aria-hidden="true" /> Vencem nos próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {dueLoading ? '—' : upcoming}
          </CardContent>
        </Card>
      </div>
      {periodsQuery.isSuccess && !currentPeriod && (
        <p className="mt-3 text-sm text-muted-foreground">
          Cadastre a competência deste mês para acompanhar faturamento e resultado.
        </p>
      )}
      {(periodsQuery.isError ||
        summaryQuery.isError ||
        dueQueries.some((query) => query.isError)) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Alguns indicadores não puderam ser carregados. Confira os dados no Financeiro.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Prazos incluem lançamentos pendentes ou parciais, de receitas e despesas. Os valores do mês
        vêm do resumo financeiro da competência; não representam lucro realizado por pedido.
      </p>
    </section>
  );
}

export function DashboardPage() {
  const currentUserQuery = useCurrentUserQuery();
  const auth = currentUserQuery.data;
  if (!auth) return null;

  const canViewFinancialIndicators = ['OWNER', 'ADMIN', 'FINANCE'].includes(auth.organization.role);
  const canManageSetup = auth.organization.role === 'OWNER' || auth.organization.role === 'ADMIN';

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-start gap-4">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
          <Building2 className="size-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-2 text-muted-foreground">
            Olá, {auth.user.name}. Esta é a área da empresa {auth.organization.name}.
          </p>
        </div>
      </div>
      {canManageSetup && (
        <Link
          to="/app/cadastro-guiado"
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Cadastrar custos, insumos e produtos
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
      {canViewFinancialIndicators && <FinancialDashboard />}
    </section>
  );
}
