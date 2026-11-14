import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FinancialPeriodForm } from '@/features/finance/financial-period-form';
import type { FinancialCategoryType } from '@/features/finance/financial-categories-api';
import { useCreateFinancialCategoryMutation } from '@/features/finance/use-create-financial-category-mutation';
import { useCreateFinancialEntryMutation } from '@/features/finance/use-create-financial-entry-mutation';
import { useFinancialCategoriesQuery } from '@/features/finance/use-financial-categories-query';
import { useFinancialPeriodsQuery } from '@/features/finance/use-financial-periods-query';

const positiveMoney = /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/;

export function GuidedCostEntry({
  type,
}: {
  type: Extract<FinancialCategoryType, 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE'>;
}) {
  const periodsQuery = useFinancialPeriodsQuery({ status: 'OPEN' });
  const categoriesQuery = useFinancialCategoriesQuery({ type, isActive: true });
  const createCategory = useCreateFinancialCategoryMutation();
  const createEntry = useCreateFinancialEntryMutation();
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodId, setPeriodId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const periods = periodsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const currentPeriod = periods.find((period) => period.id === periodId);
  const label = type === 'FIXED_EXPENSE' ? 'fixo' : 'variável';

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (name.length < 2 || name.length > 100) {
      setError('Informe o nome da categoria com 2 a 100 caracteres.');
      return;
    }
    setError('');
    createCategory.mutate(
      { name, type },
      {
        onSuccess: (created) => {
          setCategoryId(created.id);
          setCategoryName('');
          setFeedback(`Categoria ${created.name} criada.`);
        },
      },
    );
  }

  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    if (!currentPeriod || !categories.some((category) => category.id === categoryId)) {
      setError('Selecione uma competência aberta e uma categoria do tipo correto.');
      return;
    }
    if (description.trim().length < 2 || description.trim().length > 160) {
      setError('Informe uma descrição com 2 a 160 caracteres.');
      return;
    }
    if (!positiveMoney.test(amount.trim())) {
      setError('Informe um valor positivo com até duas casas decimais, usando ponto.');
      return;
    }
    const expectedMonth = `${currentPeriod.year}-${String(currentPeriod.month).padStart(2, '0')}-`;
    if (!dueDate.startsWith(expectedMonth) || Number.isNaN(Date.parse(dueDate))) {
      setError('A data de vencimento deve pertencer à competência selecionada.');
      return;
    }
    setError('');
    createEntry.mutate(
      {
        periodId: currentPeriod.id,
        categoryId,
        description: description.trim(),
        amount: amount.trim(),
        dueDate,
      },
      {
        onSuccess: () => {
          setDescription('');
          setAmount('');
          setDueDate('');
          setFeedback(
            'Despesa registrada. O vencimento aparecerá nos indicadores da página inicial.',
          );
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Registre cada despesa e seu vencimento no Financeiro. Estes lançamentos não são somados
        automaticamente à composição nem à configuração de precificação.
      </p>
      {(periodsQuery.isError || categoriesQuery.isError) && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar competências ou categorias.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void periodsQuery.refetch();
              void categoriesQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {periodsQuery.isPending && <p role="status">Carregando competências...</p>}
      {categoriesQuery.isPending && <p role="status">Carregando categorias...</p>}
      {periodsQuery.isSuccess && (periods.length === 0 || showPeriodForm) && (
        <FinancialPeriodForm
          periods={periodsQuery.data}
          onCreated={(created) => {
            setPeriodId(created.id);
            setShowPeriodForm(false);
          }}
          onCancel={() => setShowPeriodForm(false)}
        />
      )}
      {periods.length > 0 && !showPeriodForm && (
        <Button type="button" variant="outline" onClick={() => setShowPeriodForm(true)}>
          Cadastrar outra competência
        </Button>
      )}
      {periodsQuery.isSuccess && categoriesQuery.isSuccess && (
        <>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={saveCategory}>
            <div className="space-y-2">
              <Label htmlFor={`${type}-category-name`}>Nova categoria de custo {label}</Label>
              <Input
                id={`${type}-category-name`}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                maxLength={100}
                placeholder={type === 'FIXED_EXPENSE' ? 'Ex.: Aluguel' : 'Ex.: Embalagens gerais'}
              />
            </div>
            <Button type="submit" variant="outline" disabled={createCategory.isPending}>
              Cadastrar categoria
            </Button>
          </form>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveEntry}>
            <div className="space-y-2">
              <Label htmlFor={`${type}-period`}>Competência</Label>
              <select
                id={`${type}-period`}
                value={periodId}
                onChange={(event) => {
                  setPeriodId(event.target.value);
                  setDueDate('');
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {String(period.month).padStart(2, '0')}/{period.year}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-category`}>Categoria</Label>
              <select
                id={`${type}-category`}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-description`}>Descrição</Label>
              <Input
                id={`${type}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-amount`}>Valor da despesa</Label>
              <Input
                id={`${type}-amount`}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-due-date`}>Vencimento</Label>
              <Input
                id={`${type}-due-date`}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={!currentPeriod}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createEntry.isPending || !currentPeriod}>
                Registrar despesa
              </Button>
            </div>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {createCategory.isError && (
        <p role="alert" className="text-sm text-destructive">
          {createCategory.error.message}
        </p>
      )}
      {createEntry.isError && (
        <p role="alert" className="text-sm text-destructive">
          {createEntry.error.message}
        </p>
      )}
      {feedback && (
        <p role="status" className="text-sm text-primary">
          {feedback}
        </p>
      )}
    </div>
  );
}
