import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChartNoAxesCombined,
  MinusCircle,
  WalletCards,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialPeriodForm } from '@/features/finance/financial-period-form';
import { FinancialNavigation } from '@/features/finance/financial-navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinancialPeriodsQuery } from '@/features/finance/use-financial-periods-query';
import { useFinancialSummaryQuery } from '@/features/finance/use-financial-summary-query';
import { FinancialPeriodActions } from '@/features/finance/financial-period-actions';
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

function formatPeriod(year: number, month: number): string {
  return `${monthNames[month - 1]} de ${year}`;
}

function formatCurrency(value: string): string {
  const isNegative = value.startsWith('-');
  const absoluteValue = isNegative ? value.slice(1) : value;
  const [integerPart, decimalPart = '00'] = absoluteValue.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${isNegative ? '-' : ''}R$ ${formattedInteger},${decimalPart}`;
}

export function FinancialPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>();

  const periodsQuery = useFinancialPeriodsQuery();
  const periods = periodsQuery.data ?? [];

  const activePeriodId =
    selectedPeriodId && periods.some((period) => period.id === selectedPeriodId)
      ? selectedPeriodId
      : periods[0]?.id;

  const selectedPeriod = periods.find((period) => period.id === activePeriodId);

  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false);
  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;

  const canManageFinancialPeriods = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const summaryQuery = useFinancialSummaryQuery(activePeriodId);
  const summary = summaryQuery.data;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-2 text-muted-foreground">
            Acompanhe faturamento, custos e resultado por competência.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          {canManageFinancialPeriods && (
            <Button type="button" onClick={() => setIsCreatingPeriod((current) => !current)}>
              <Plus data-icon="inline-start" />
              {isCreatingPeriod ? 'Fechar formulário' : 'Nova competência'}
            </Button>
          )}

          {periods.length > 0 && (
            <div className="w-full space-y-2 sm:w-64">
              <label htmlFor="financial-period" className="text-sm font-medium">
                Competência
              </label>

              <select
                id="financial-period"
                value={activePeriodId ?? ''}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
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
          )}
        </div>
      </div>

      <FinancialNavigation />

      {isCreatingPeriod && (
        <FinancialPeriodForm
          periods={periods}
          onCreated={(period) => {
            setSelectedPeriodId(period.id);
            setIsCreatingPeriod(false);
          }}
          onCancel={() => setIsCreatingPeriod(false)}
        />
      )}

      {periodsQuery.isPending && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Carregando competências financeiras...
        </p>
      )}

      {periodsQuery.isError && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {periodsQuery.error.message}
        </p>
      )}

      {periodsQuery.isSuccess && periods.length === 0 && !isCreatingPeriod && (
        <Card className="mt-8">
          <CardContent className="grid place-items-center py-14 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
              <WalletCards className="size-6 text-primary" />
            </div>
            <p className="mt-4 font-medium">Nenhuma competência financeira</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Cadastre uma competência para começar a acompanhar o resultado mensal da empresa.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPeriod && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              selectedPeriod.status === 'OPEN'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-zinc-200 text-zinc-700',
            )}
          >
            {selectedPeriod.status === 'OPEN' ? 'Competência aberta' : 'Competência fechada'}
          </span>

          <span className="text-sm text-muted-foreground">
            Faturamento por{' '}
            {selectedPeriod.revenueSource === 'ENTRIES' ? 'lançamentos' : 'valor manual'}
          </span>
        </div>
      )}

      {selectedPeriod && role && <FinancialPeriodActions period={selectedPeriod} role={role} />}

      {summaryQuery.isPending && activePeriodId && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Calculando o resumo financeiro...
        </p>
      )}

      {summaryQuery.isError && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {summaryQuery.error.message}
        </p>
      )}

      {summary && (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>Faturamento</CardDescription>
                  <ArrowUpCircle className="size-5 text-emerald-600" />
                </div>
                <CardTitle className="text-2xl">{formatCurrency(summary.totals.revenue)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {summary.entryCounts.revenue} lançamento(s) de receita
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>Custos fixos</CardDescription>
                  <MinusCircle className="size-5 text-amber-600" />
                </div>
                <CardTitle className="text-2xl">
                  {formatCurrency(summary.totals.fixedExpenses)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {summary.entryCounts.fixedExpenses} lançamento(s)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>Custos variáveis</CardDescription>
                  <ArrowDownCircle className="size-5 text-orange-600" />
                </div>
                <CardTitle className="text-2xl">
                  {formatCurrency(summary.totals.variableExpenses)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {summary.entryCounts.variableExpenses} lançamento(s)
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                summary.totals.resultStatus === 'POSITIVE' && 'ring-emerald-500/30',
                summary.totals.resultStatus === 'NEGATIVE' && 'ring-destructive/30',
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>Resultado do mês</CardDescription>
                  <ChartNoAxesCombined
                    className={cn(
                      'size-5',
                      summary.totals.resultStatus === 'POSITIVE' && 'text-emerald-600',
                      summary.totals.resultStatus === 'NEGATIVE' && 'text-destructive',
                      summary.totals.resultStatus === 'NEUTRAL' && 'text-muted-foreground',
                    )}
                  />
                </div>
                <CardTitle
                  className={cn(
                    'text-2xl',
                    summary.totals.resultStatus === 'POSITIVE' && 'text-emerald-700',
                    summary.totals.resultStatus === 'NEGATIVE' && 'text-destructive',
                  )}
                >
                  {formatCurrency(summary.totals.result)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {summary.totals.resultStatus === 'POSITIVE' && 'Resultado positivo'}
                  {summary.totals.resultStatus === 'NEGATIVE' && 'Resultado negativo'}
                  {summary.totals.resultStatus === 'NEUTRAL' && 'Resultado neutro'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Composição do resultado</CardTitle>
              <CardDescription>
                Valores calculados automaticamente para{' '}
                {formatPeriod(summary.period.year, summary.period.month)}.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 border-b pb-4">
                <span className="text-muted-foreground">Faturamento</span>
                <span className="font-medium">{formatCurrency(summary.totals.revenue)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 border-b pb-4">
                <span className="text-muted-foreground">Custos variáveis</span>
                <span className="font-medium">
                  − {formatCurrency(summary.totals.variableExpenses)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 border-b pb-4">
                <span className="text-muted-foreground">Margem de contribuição</span>
                <span className="font-medium">
                  {formatCurrency(summary.totals.contributionMargin)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Custos fixos</span>
                <span className="font-medium">
                  − {formatCurrency(summary.totals.fixedExpenses)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
