import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const orderWorkflowStageFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da etapa.')
    .max(100, 'O nome da etapa deve ter no máximo 100 caracteres.'),
});

const orderWorkflowFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe o nome do fluxo.')
      .max(100, 'O nome do fluxo deve ter no máximo 100 caracteres.'),
    stages: z
      .array(orderWorkflowStageFormSchema)
      .min(2, 'Informe pelo menos duas etapas.')
      .max(20, 'O fluxo pode ter no máximo 20 etapas.'),
  })
  .superRefine((data, context) => {
    const stageNames = new Map<string, number>();

    data.stages.forEach((stage, index) => {
      const normalizedName = stage.name.trim().toLocaleLowerCase('pt-BR');

      if (!normalizedName) {
        return;
      }

      if (stageNames.has(normalizedName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stages', index, 'name'],
          message: 'As etapas devem possuir nomes diferentes.',
        });

        return;
      }

      stageNames.set(normalizedName, index);
    });
  });

export type OrderWorkflowFormData = z.infer<typeof orderWorkflowFormSchema>;

interface OrderWorkflowFormProps {
  initialValues?: OrderWorkflowFormData;
  submitLabel?: string;
  pendingLabel?: string;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (data: OrderWorkflowFormData) => void;
  onCancel: () => void;
}

function createEmptyStage(): OrderWorkflowFormData['stages'][number] {
  return {
    name: '',
  };
}

function createDefaultValues(initialValues?: OrderWorkflowFormData): OrderWorkflowFormData {
  if (initialValues) {
    return {
      name: initialValues.name,
      stages: initialValues.stages.map((stage) => ({
        name: stage.name,
      })),
    };
  }

  return {
    name: '',
    stages: [createEmptyStage(), createEmptyStage(), createEmptyStage()],
  };
}

function getStageCategoryLabel(index: number, total: number): string {
  if (index === 0) {
    return 'Pendente';
  }

  if (index === total - 1) {
    return 'Concluído';
  }

  return 'Em andamento';
}

export function OrderWorkflowForm({
  initialValues,
  submitLabel = 'Criar fluxo',
  pendingLabel = 'Criando fluxo...',
  isPending,
  errorMessage,
  onSubmit,
  onCancel,
}: OrderWorkflowFormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderWorkflowFormData>({
    resolver: zodResolver(orderWorkflowFormSchema),
    defaultValues: createDefaultValues(initialValues),
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'stages',
  });

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="order-workflow-name">Nome do fluxo</Label>
        <Input
          id="order-workflow-name"
          maxLength={100}
          placeholder="Ex.: Produção personalizada"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-medium">Etapas do fluxo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A primeira etapa será pendente, a última será concluída e as intermediárias ficarão em
              andamento.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => append(createEmptyStage())}
            disabled={isPending || fields.length >= 20}
          >
            <Plus data-icon="inline-start" />
            Adicionar etapa
          </Button>
        </div>

        {errors.stages?.root?.message && (
          <p className="text-sm text-destructive">{errors.stages.root.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const stageError = errors.stages?.[index]?.name;
            const categoryLabel = getStageCategoryLabel(index, fields.length);

            return (
              <fieldset key={field.id} className="rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">Etapa {index + 1}</legend>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="space-y-2">
                    <Label htmlFor={`order-workflow-stage-${index}`}>
                      Nome da etapa {index + 1}
                    </Label>
                    <Input
                      id={`order-workflow-stage-${index}`}
                      maxLength={100}
                      placeholder={
                        index === 0
                          ? 'Ex.: Pedido recebido'
                          : index === fields.length - 1
                            ? 'Ex.: Pedido finalizado'
                            : 'Ex.: Em produção'
                      }
                      aria-invalid={Boolean(stageError)}
                      {...register(`stages.${index}.name`)}
                    />
                    <p className="text-xs text-muted-foreground">Categoria: {categoryLabel}</p>
                    {stageError && <p className="text-sm text-destructive">{stageError.message}</p>}
                  </div>

                  <div className="flex gap-1 sm:pt-7">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover etapa ${index + 1} para cima`}
                      onClick={() => move(index, index - 1)}
                      disabled={isPending || index === 0}
                    >
                      <ArrowUp />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover etapa ${index + 1} para baixo`}
                      onClick={() => move(index, index + 1)}
                      disabled={isPending || index === fields.length - 1}
                    >
                      <ArrowDown />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover etapa ${index + 1}`}
                      onClick={() => remove(index)}
                      disabled={isPending || fields.length <= 2}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </fieldset>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{fields.length} de 20 etapas adicionadas.</p>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>

        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
