import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FinancialPeriod } from './finance-api';
import { useCreateFinancialPeriodMutation } from './use-create-financial-period-mutation';

const manualRevenuePattern = /^\d{1,12}(?:\.\d{1,2})?$/;

const financialPeriodSchema = z
  .object({
    year: z
      .number()
      .int('Informe um ano válido.')
      .min(1, 'Informe um ano válido.')
      .max(9999, 'Informe um ano válido.'),
    month: z.number().int().min(1, 'Selecione o mês.').max(12, 'Selecione o mês.'),
    revenueSource: z.enum(['ENTRIES', 'MANUAL_TOTAL']),
    manualRevenue: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.revenueSource !== 'MANUAL_TOTAL') {
      return;
    }

    const manualRevenue = data.manualRevenue?.trim();

    if (!manualRevenue) {
      context.addIssue({
        code: 'custom',
        path: ['manualRevenue'],
        message: 'Informe o faturamento manual.',
      });

      return;
    }

    if (!manualRevenuePattern.test(manualRevenue)) {
      context.addIssue({
        code: 'custom',
        path: ['manualRevenue'],
        message: 'Informe um valor positivo ou zero com até duas casas decimais.',
      });
    }
  });

type FinancialPeriodFormData = z.infer<typeof financialPeriodSchema>;

interface FinancialPeriodFormProps {
  periods: FinancialPeriod[];
  onCreated: (period: FinancialPeriod) => void;
  onCancel: () => void;
}

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

export function FinancialPeriodForm({ periods, onCreated, onCancel }: FinancialPeriodFormProps) {
  const formId = useId();
  const today = new Date();
  const createMutation = useCreateFinancialPeriodMutation();

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FinancialPeriodFormData>({
    resolver: zodResolver(financialPeriodSchema),
    defaultValues: {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      revenueSource: 'ENTRIES',
      manualRevenue: '',
    },
  });

  const revenueSource = useWatch({
    control,
    name: 'revenueSource',
  });

  function handleValidSubmit(data: FinancialPeriodFormData) {
    clearErrors('root');

    const alreadyExists = periods.some(
      (period) => period.year === data.year && period.month === data.month,
    );

    if (alreadyExists) {
      setError('root', {
        message: 'Já existe uma competência financeira para este mês.',
      });

      return;
    }

    createMutation.mutate(
      {
        year: data.year,
        month: data.month,
        revenueSource: data.revenueSource,
        ...(data.revenueSource === 'MANUAL_TOTAL'
          ? {
              manualRevenue: data.manualRevenue?.trim(),
            }
          : {}),
      },
      {
        onSuccess: onCreated,
      },
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Nova competência</CardTitle>
        <CardDescription>
          Defina o mês e a origem do faturamento utilizado no resumo.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-period-month`}>Mês</Label>
              <select
                id={`${formId}-period-month`}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-invalid={Boolean(errors.month)}
                {...register('month', {
                  valueAsNumber: true,
                })}
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              {errors.month && <p className="text-sm text-destructive">{errors.month.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-period-year`}>Ano</Label>
              <Input
                id={`${formId}-period-year`}
                type="number"
                min={1}
                max={9999}
                aria-invalid={Boolean(errors.year)}
                {...register('year', {
                  valueAsNumber: true,
                })}
              />
              {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-revenue-source`}>Origem do faturamento</Label>
            <select
              id={`${formId}-revenue-source`}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('revenueSource')}
            >
              <option value="ENTRIES">Somar lançamentos de receita</option>
              <option value="MANUAL_TOTAL">Informar o total manualmente</option>
            </select>
          </div>

          {revenueSource === 'MANUAL_TOTAL' && (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-manual-revenue`}>Faturamento manual</Label>
              <Input
                id={`${formId}-manual-revenue`}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={Boolean(errors.manualRevenue)}
                {...register('manualRevenue')}
              />
              <p className="text-xs text-muted-foreground">
                Use ponto para separar os centavos, por exemplo: 1500.50.
              </p>
              {errors.manualRevenue && (
                <p className="text-sm text-destructive">{errors.manualRevenue.message}</p>
              )}
            </div>
          )}

          {errors.root?.message && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}

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
              onClick={onCancel}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar competência'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
