import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientsQuery } from '@/features/clients/use-clients-query';
import type { FinancialEntry, UpdateFinancialEntryInput } from './financial-entries-api';
import { useFinancialCategoriesQuery } from './use-financial-categories-query';
import { useUpdateFinancialEntryMutation } from './use-update-financial-entry-mutation';

const amountPattern = /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/;

const editEntrySchema = z.object({
  categoryId: z.string().uuid('Selecione uma categoria.'),
  clientId: z.string(),
  description: z
    .string()
    .trim()
    .min(2, 'Informe uma descrição com pelo menos 2 caracteres.')
    .max(160, 'A descrição deve ter no máximo 160 caracteres.'),
  amount: z.string().regex(amountPattern, 'Informe um valor positivo com até duas casas decimais.'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  notes: z.string().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
});

type EditEntryFormData = z.infer<typeof editEntrySchema>;

const categoryTypeLabels = {
  REVENUE: 'Receita',
  FIXED_EXPENSE: 'Custo fixo',
  VARIABLE_EXPENSE: 'Custo variável',
} as const;

interface FinancialEntryEditFormProps {
  entry: FinancialEntry;
  settledAmount: string;
  canManage: boolean;
}

function formatDateBoundary(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function FinancialEntryEditForm({
  entry,
  settledAmount,
  canManage,
}: FinancialEntryEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string>();

  const categoriesQuery = useFinancialCategoriesQuery({
    isActive: true,
  });
  const clientsQuery = useClientsQuery({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const updateMutation = useUpdateFinancialEntryMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<EditEntryFormData>({
    resolver: zodResolver(editEntrySchema),
    defaultValues: {
      categoryId: entry.category.id,
      clientId: entry.client?.id ?? '',
      description: entry.description,
      amount: entry.amount,
      dueDate: entry.dueDate,
      notes: entry.notes ?? '',
    },
  });

  const canEdit = canManage && entry.period.status === 'OPEN' && entry.status !== 'CANCELLED';

  const hasActiveSettlements = settledAmount !== '0.00';
  const categories = categoriesQuery.data ?? [];
  const clients = clientsQuery.data?.data ?? [];

  const firstDueDate = formatDateBoundary(entry.period.year, entry.period.month, 1);

  const lastDueDate = formatDateBoundary(
    entry.period.year,
    entry.period.month,
    new Date(Date.UTC(entry.period.year, entry.period.month, 0)).getUTCDate(),
  );

  if (!canEdit) {
    return null;
  }

  function openForm() {
    reset({
      categoryId: entry.category.id,
      clientId: entry.client?.id ?? '',
      description: entry.description,
      amount: entry.amount,
      dueDate: entry.dueDate,
      notes: entry.notes ?? '',
    });
    setFormError(undefined);
    clearErrors();
    updateMutation.reset();
    setIsEditing(true);
  }

  function closeForm() {
    setIsEditing(false);
    setFormError(undefined);
    clearErrors();
    updateMutation.reset();
  }

  function handleValidSubmit(data: EditEntryFormData) {
    const expectedDuePeriod = `${String(entry.period.year).padStart(
      4,
      '0',
    )}-${String(entry.period.month).padStart(2, '0')}`;

    if (!data.dueDate.startsWith(expectedDuePeriod)) {
      setError('dueDate', {
        message: 'A data de vencimento deve pertencer à competência do lançamento.',
      });
      return;
    }

    const input: UpdateFinancialEntryInput = {};
    const normalizedClientId = data.clientId || null;
    const currentClientId = entry.client?.id ?? null;
    const normalizedNotes = data.notes.trim() || null;
    const currentNotes = entry.notes ?? null;

    if (!hasActiveSettlements && data.categoryId !== entry.category.id) {
      input.categoryId = data.categoryId;
    }

    if (normalizedClientId !== currentClientId) {
      input.clientId = normalizedClientId;
    }

    if (data.description !== entry.description) {
      input.description = data.description;
    }

    if (!hasActiveSettlements && data.amount !== entry.amount) {
      input.amount = data.amount;
    }

    if (data.dueDate !== entry.dueDate) {
      input.dueDate = data.dueDate;
    }

    if (normalizedNotes !== currentNotes) {
      input.notes = normalizedNotes;
    }

    if (Object.keys(input).length === 0) {
      setFormError('Nenhuma alteração foi realizada.');
      return;
    }

    setFormError(undefined);
    updateMutation.reset();

    updateMutation.mutate(
      {
        entryId: entry.id,
        input,
      },
      {
        onSuccess: closeForm,
      },
    );
  }

  if (!isEditing) {
    return (
      <div className="mt-6 flex justify-end">
        <Button type="button" variant="outline" onClick={openForm}>
          <Pencil data-icon="inline-start" />
          Editar lançamento
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Editar lançamento</CardTitle>
        <CardDescription>
          A competência e o tipo da categoria não podem ser alterados.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-entry-category">Categoria</Label>

              {hasActiveSettlements ? (
                <>
                  <select
                    id="edit-entry-category"
                    value={entry.category.id}
                    disabled
                    className="h-9 w-full rounded-lg border border-input bg-muted px-3 text-sm opacity-70"
                  >
                    <option value={entry.category.id}>
                      {entry.category.name} — {categoryTypeLabels[entry.category.type]}
                    </option>
                  </select>
                  <input type="hidden" {...register('categoryId')} />
                </>
              ) : (
                <select
                  id="edit-entry-category"
                  aria-invalid={Boolean(errors.categoryId)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register('categoryId')}
                >
                  {!categories.some((category) => category.id === entry.category.id) && (
                    <option value={entry.category.id}>
                      {entry.category.name} — {categoryTypeLabels[entry.category.type]}
                    </option>
                  )}

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} — {categoryTypeLabels[category.type]}
                    </option>
                  ))}
                </select>
              )}

              {hasActiveSettlements && (
                <p className="text-xs text-muted-foreground">
                  A categoria não pode ser alterada enquanto houver baixas ativas.
                </p>
              )}

              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-entry-client">Cliente</Label>
              <select
                id="edit-entry-client"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register('clientId')}
              >
                <option value="">Nenhum cliente</option>

                {entry.client && !clients.some((client) => client.id === entry.client?.id) && (
                  <option value={entry.client.id}>{entry.client.name}</option>
                )}

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-entry-description">Descrição</Label>
            <Input
              id="edit-entry-description"
              maxLength={160}
              aria-invalid={Boolean(errors.description)}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-entry-amount">Valor</Label>

              {hasActiveSettlements ? (
                <>
                  <Input
                    id="edit-entry-amount"
                    value={entry.amount}
                    readOnly
                    className="bg-muted"
                  />
                  <input type="hidden" {...register('amount')} />
                </>
              ) : (
                <Input
                  id="edit-entry-amount"
                  type="text"
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.amount)}
                  {...register('amount')}
                />
              )}

              {hasActiveSettlements && (
                <p className="text-xs text-muted-foreground">
                  O valor não pode ser alterado enquanto houver baixas ativas.
                </p>
              )}

              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-entry-due-date">Data de vencimento</Label>
              <Input
                id="edit-entry-due-date"
                type="date"
                min={firstDueDate}
                max={lastDueDate}
                aria-invalid={Boolean(errors.dueDate)}
                {...register('dueDate')}
              />
              {errors.dueDate && (
                <p className="text-sm text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-entry-notes">Observações</Label>
            <textarea
              id="edit-entry-notes"
              rows={4}
              maxLength={2000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('notes')}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          {updateMutation.isError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {updateMutation.error.message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={updateMutation.isPending}
            >
              Cancelar edição
            </Button>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
