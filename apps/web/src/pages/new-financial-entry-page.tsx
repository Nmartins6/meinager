import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { useClientsQuery } from '@/features/clients/use-clients-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import { useCreateFinancialEntryMutation } from '@/features/finance/use-create-financial-entry-mutation';
import { useFinancialCategoriesQuery } from '@/features/finance/use-financial-categories-query';
import { useFinancialPeriodsQuery } from '@/features/finance/use-financial-periods-query';

const amountPattern = /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/;

const financialEntryFormSchema = z.object({
  periodId: z.string().uuid('Selecione uma competência.'),
  categoryId: z.string().uuid('Selecione uma categoria.'),
  clientId: z.string(),
  description: z
    .string()
    .trim()
    .min(2, 'Informe uma descrição com pelo menos 2 caracteres.')
    .max(160, 'A descrição deve ter no máximo 160 caracteres.'),
  amount: z.string().regex(amountPattern, 'Informe um valor positivo com até duas casas decimais.'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data de vencimento.'),
  notes: z.string().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
});

type FinancialEntryFormData = z.infer<typeof financialEntryFormSchema>;

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

const categoryTypeLabels = {
  REVENUE: 'Receita',
  FIXED_EXPENSE: 'Custo fixo',
  VARIABLE_EXPENSE: 'Custo variável',
} as const;

function formatPeriod(year: number, month: number): string {
  return `${monthNames[month - 1]} de ${year}`;
}

function formatDateBoundary(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function NewFinancialEntryPage() {
  const navigate = useNavigate();

  const currentUserQuery = useCurrentUserQuery();
  const periodsQuery = useFinancialPeriodsQuery({
    status: 'OPEN',
  });
  const categoriesQuery = useFinancialCategoriesQuery({
    isActive: true,
  });
  const clientsQuery = useClientsQuery({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const createMutation = useCreateFinancialEntryMutation();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FinancialEntryFormData>({
    resolver: zodResolver(financialEntryFormSchema),
    defaultValues: {
      periodId: '',
      categoryId: '',
      clientId: '',
      description: '',
      amount: '',
      dueDate: '',
      notes: '',
    },
  });

  const selectedPeriodId = useWatch({
    control,
    name: 'periodId',
  });

  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'FINANCE';

  const periods = periodsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const clients = clientsQuery.data?.data ?? [];

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId);

  const availableCategories = categories.filter(
    (category) =>
      !(selectedPeriod?.revenueSource === 'MANUAL_TOTAL' && category.type === 'REVENUE'),
  );

  const firstDueDate = selectedPeriod
    ? formatDateBoundary(selectedPeriod.year, selectedPeriod.month, 1)
    : undefined;

  const lastDueDate = selectedPeriod
    ? formatDateBoundary(
        selectedPeriod.year,
        selectedPeriod.month,
        new Date(Date.UTC(selectedPeriod.year, selectedPeriod.month, 0)).getUTCDate(),
      )
    : undefined;

  const periodRegistration = register('periodId');

  function handleValidSubmit(data: FinancialEntryFormData) {
    clearErrors('root');

    const period = periods.find((candidate) => candidate.id === data.periodId);

    if (!period) {
      setError('periodId', {
        message: 'Selecione uma competência aberta.',
      });
      return;
    }

    const expectedDuePeriod = `${String(period.year).padStart(
      4,
      '0',
    )}-${String(period.month).padStart(2, '0')}`;

    if (!data.dueDate.startsWith(expectedDuePeriod)) {
      setError('dueDate', {
        message: 'A data de vencimento deve pertencer à competência selecionada.',
      });
      return;
    }

    createMutation.mutate(
      {
        periodId: data.periodId,
        categoryId: data.categoryId,
        clientId: data.clientId || undefined,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        notes: data.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          navigate('/app/financeiro/lancamentos', {
            replace: true,
          });
        },
      },
    );
  }

  const isLoadingDependencies =
    currentUserQuery.isPending ||
    periodsQuery.isPending ||
    categoriesQuery.isPending ||
    clientsQuery.isPending;

  const dependencyError = periodsQuery.error ?? categoriesQuery.error ?? clientsQuery.error;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/app/financeiro/lancamentos')}
        >
          <ArrowLeft data-icon="inline-start" />
          Voltar aos lançamentos
        </Button>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Novo lançamento</h1>
        <p className="mt-2 text-muted-foreground">
          Registre uma receita, um custo fixo ou um custo variável.
        </p>
      </div>

      <FinancialNavigation />

      {isLoadingDependencies && (
        <p role="status" className="py-16 text-center text-muted-foreground">
          Preparando o formulário...
        </p>
      )}

      {dependencyError && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {dependencyError.message}
        </p>
      )}

      {!isLoadingDependencies && !dependencyError && !canManage && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Você não possui permissão para criar lançamentos.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingDependencies && !dependencyError && canManage && periods.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Nenhuma competência aberta disponível</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie ou reabra uma competência antes de registrar o lançamento.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoadingDependencies && !dependencyError && canManage && periods.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
                <FilePlus2 className="size-5 text-primary" />
              </div>

              <div>
                <CardTitle>Dados do lançamento</CardTitle>
                <CardDescription>
                  O valor deve ser sempre positivo; o tipo da categoria determina se é receita ou
                  despesa.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entry-period">Competência</Label>
                  <select
                    id="entry-period"
                    aria-invalid={Boolean(errors.periodId)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    {...periodRegistration}
                    onChange={(event) => {
                      periodRegistration.onChange(event);
                      setValue('categoryId', '');
                      setValue('dueDate', '');
                      clearErrors(['periodId', 'categoryId', 'dueDate']);
                    }}
                  >
                    <option value="">Selecione</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {formatPeriod(period.year, period.month)}
                      </option>
                    ))}
                  </select>
                  {errors.periodId && (
                    <p className="text-sm text-destructive">{errors.periodId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry-category">Categoria</Label>
                  <select
                    id="entry-category"
                    aria-invalid={Boolean(errors.categoryId)}
                    disabled={!selectedPeriod}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    {...register('categoryId')}
                  >
                    <option value="">Selecione</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} — {categoryTypeLabels[category.type]}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                  )}
                  {selectedPeriod?.revenueSource === 'MANUAL_TOTAL' && (
                    <p className="text-xs text-muted-foreground">
                      Esta competência usa faturamento manual e não aceita lançamentos de receita.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry-description">Descrição</Label>
                <Input
                  id="entry-description"
                  maxLength={160}
                  placeholder="Ex.: Pagamento do cliente ou aluguel"
                  aria-invalid={Boolean(errors.description)}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entry-amount">Valor</Label>
                  <Input
                    id="entry-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={Boolean(errors.amount)}
                    {...register('amount')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use ponto para separar os centavos.
                  </p>
                  {errors.amount && (
                    <p className="text-sm text-destructive">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry-due-date">Data de vencimento</Label>
                  <Input
                    id="entry-due-date"
                    type="date"
                    min={firstDueDate}
                    max={lastDueDate}
                    disabled={!selectedPeriod}
                    aria-invalid={Boolean(errors.dueDate)}
                    {...register('dueDate')}
                  />
                  {errors.dueDate && (
                    <p className="text-sm text-destructive">{errors.dueDate.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry-client">Cliente opcional</Label>
                <select
                  id="entry-client"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register('clientId')}
                >
                  <option value="">Nenhum cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry-notes">Observações</Label>
                <textarea
                  id="entry-notes"
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register('notes')}
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
              </div>

              {createMutation.isError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {createMutation.error.message}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/app/financeiro/lancamentos')}
                  disabled={createMutation.isPending}
                >
                  Cancelar
                </Button>

                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Criar lançamento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
