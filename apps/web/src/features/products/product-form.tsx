import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const decimalPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

const optionalDecimal = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || decimalPattern.test(value),
    'Informe um valor não negativo com até 6 casas decimais.',
  );

const optionalMoney = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || moneyPattern.test(value),
    'Informe um preço de venda não negativo com até 2 casas decimais.',
  );

const productFormSchema = z
  .object({
    type: z.enum(['PRODUCT', 'SERVICE']),
    name: z
      .string()
      .trim()
      .min(2, 'Informe um nome com pelo menos 2 caracteres.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.'),
    sku: z.string().trim().max(60, 'O SKU deve ter no máximo 60 caracteres.'),
    barcode: z.string().trim().max(50, 'O código de barras deve ter no máximo 50 caracteres.'),
    unit: z
      .string()
      .trim()
      .min(1, 'Informe a unidade.')
      .max(20, 'A unidade deve ter no máximo 20 caracteres.'),
    directCost: optionalDecimal,
    salePrice: optionalMoney,
    trackInventory: z.boolean(),
    minimumStock: optionalDecimal,
    notes: z.string().trim().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
  })
  .superRefine((data, context) => {
    if (data.type === 'SERVICE' && data.trackInventory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trackInventory'],
        message: 'Serviços não podem ter controle de estoque.',
      });
    }

    if (!data.trackInventory && data.minimumStock !== '') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimumStock'],
        message: 'Informe o estoque mínimo somente para itens com controle de estoque.',
      });
    }
  });

export type ProductFormData = z.infer<typeof productFormSchema>;

const defaultValues: ProductFormData = {
  type: 'PRODUCT',
  name: '',
  sku: '',
  barcode: '',
  unit: 'UN',
  directCost: '',
  salePrice: '',
  trackInventory: false,
  minimumStock: '',
  notes: '',
};

interface ProductFormProps {
  isPending: boolean;
  errorMessage?: string;
  submitLabel: string;
  pendingLabel: string;
  initialValues?: ProductFormData;
  showSalePrice?: boolean;
  onSubmit: (data: ProductFormData) => void;
  onCancel: () => void;
}

export function ProductForm({
  initialValues = defaultValues,
  showSalePrice = true,
  isPending,
  errorMessage,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const {
    clearErrors,
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
  });

  const productType = useWatch({
    control,
    name: 'type',
  });

  const trackInventory = useWatch({
    control,
    name: 'trackInventory',
  });

  const typeRegistration = register('type');
  const trackingRegistration = register('trackInventory');

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="product-type">Tipo</Label>
          <select
            id="product-type"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={Boolean(errors.type)}
            {...typeRegistration}
            onChange={(event) => {
              typeRegistration.onChange(event);

              if (event.target.value === 'SERVICE') {
                setValue('trackInventory', false, { shouldValidate: true });
                setValue('minimumStock', '');
                clearErrors(['trackInventory', 'minimumStock']);
              }
            }}
          >
            <option value="PRODUCT">Produto</option>
            <option value="SERVICE">Serviço</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-unit">Unidade</Label>
          <Input
            id="product-unit"
            maxLength={20}
            placeholder="Ex.: UN, KG, M ou H"
            aria-invalid={Boolean(errors.unit)}
            {...register('unit')}
          />
          {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-name">Nome</Label>
        <Input
          id="product-name"
          maxLength={150}
          placeholder="Ex.: Caneca personalizada"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="product-sku">SKU opcional</Label>
          <Input
            id="product-sku"
            maxLength={60}
            placeholder="Ex.: CAN-001"
            aria-invalid={Boolean(errors.sku)}
            {...register('sku')}
          />
          {errors.sku && <p className="text-sm text-destructive">{errors.sku.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-barcode">Código de barras opcional</Label>
          <Input
            id="product-barcode"
            maxLength={50}
            aria-invalid={Boolean(errors.barcode)}
            {...register('barcode')}
          />
          {errors.barcode && <p className="text-sm text-destructive">{errors.barcode.message}</p>}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="product-direct-cost">Custo direto opcional</Label>
          <Input
            id="product-direct-cost"
            type="text"
            inputMode="decimal"
            placeholder="0.000000"
            aria-invalid={Boolean(errors.directCost)}
            {...register('directCost')}
          />
          <p className="text-xs text-muted-foreground">Use ponto como separador decimal.</p>
          {errors.directCost && (
            <p className="text-sm text-destructive">{errors.directCost.message}</p>
          )}
        </div>

        {showSalePrice && (
          <div className="space-y-2">
            <Label htmlFor="product-sale-price">Preço de venda opcional</Label>
            <Input
              id="product-sale-price"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(errors.salePrice)}
              {...register('salePrice')}
            />
            <p className="text-xs text-muted-foreground">
              Valor sugerido ao adicionar este item em um orçamento.
            </p>
            {errors.salePrice && (
              <p className="text-sm text-destructive">{errors.salePrice.message}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="product-minimum-stock">Estoque mínimo opcional</Label>
          <Input
            id="product-minimum-stock"
            type="text"
            inputMode="decimal"
            placeholder="0.000000"
            disabled={!trackInventory}
            aria-invalid={Boolean(errors.minimumStock)}
            {...register('minimumStock')}
          />
          {errors.minimumStock && (
            <p className="text-sm text-destructive">{errors.minimumStock.message}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <label htmlFor="product-track-inventory" className="flex cursor-pointer items-start gap-3">
          <input
            id="product-track-inventory"
            type="checkbox"
            className="mt-0.5 size-4 rounded border-input"
            disabled={productType === 'SERVICE'}
            {...trackingRegistration}
            onChange={(event) => {
              trackingRegistration.onChange(event);

              if (!event.target.checked) {
                setValue('minimumStock', '');
                clearErrors('minimumStock');
              }
            }}
          />

          <span>
            <span className="block text-sm font-medium">Controlar estoque deste produto</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Registre entradas, saídas e ajustes de quantidade.
            </span>
          </span>
        </label>

        {errors.trackInventory && (
          <p className="mt-2 text-sm text-destructive">{errors.trackInventory.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="product-notes">Observações opcionais</Label>
        <textarea
          id="product-notes"
          rows={4}
          maxLength={2000}
          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-invalid={Boolean(errors.notes)}
          {...register('notes')}
        />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
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
