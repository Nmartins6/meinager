import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Client } from '@/features/clients/clients-api';
import type { Product } from '@/features/products/products-api';

const quantityPattern = /^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const quoteItemSchema = z.object({
  productId: z.string(),
  sourceItemId: z.string(),
  priceSelection: z.enum(['CATALOG_NOW', 'MANUAL', 'PRESERVE']),
  expectedProductUpdatedAt: z.string(),
  expectedAdoptedPricingVersionId: z.string(),
  description: z
    .string()
    .trim()
    .min(2, 'Informe uma descrição com pelo menos 2 caracteres.')
    .max(160, 'A descrição deve ter no máximo 160 caracteres.'),
  unit: z
    .string()
    .trim()
    .min(1, 'Informe a unidade do item.')
    .max(20, 'A unidade deve ter no máximo 20 caracteres.'),
  quantity: z
    .string()
    .regex(
      quantityPattern,
      'Informe uma quantidade positiva com até 12 dígitos inteiros e 6 casas decimais.',
    ),
  unitPrice: z
    .string()
    .regex(moneyPattern, 'Informe um preço não negativo com até duas casas decimais.'),
  notes: z.string().trim().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
});

const quoteFormSchema = z.object({
  clientId: z.string().uuid('Selecione um cliente.'),
  validUntil: z
    .string()
    .refine(
      (value) => value === '' || datePattern.test(value),
      'Informe uma data de validade válida.',
    ),
  discount: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || moneyPattern.test(value),
      'Informe um desconto não negativo com até duas casas decimais.',
    ),
  notes: z.string().trim().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
  items: z
    .array(quoteItemSchema)
    .min(1, 'Informe ao menos um item no orçamento.')
    .max(100, 'O orçamento pode ter no máximo 100 itens.'),
});

export type QuoteFormData = z.infer<typeof quoteFormSchema>;

const quantityScale = 1_000_000n;
const centsScale = 100n;

interface QuotePreview {
  lineTotals: Array<bigint | null>;
  subtotal: bigint;
  discount: bigint | null;
  total: bigint | null;
  hasIncompleteItems: boolean;
  isDiscountGreaterThanSubtotal: boolean;
}

function parseQuantity(value: string): bigint | null {
  if (!quantityPattern.test(value)) {
    return null;
  }

  const [integer, fraction = ''] = value.split('.');

  return BigInt(integer) * quantityScale + BigInt(fraction.padEnd(6, '0'));
}

function parseMoneyInCents(value: string): bigint | null {
  if (!moneyPattern.test(value)) {
    return null;
  }

  const [integer, fraction = ''] = value.split('.');

  return BigInt(integer) * centsScale + BigInt(fraction.padEnd(2, '0'));
}

function calculateLineTotal(
  item: Pick<QuoteFormData['items'][number], 'quantity' | 'unitPrice'>,
): bigint | null {
  const quantity = parseQuantity(item.quantity);
  const unitPrice = parseMoneyInCents(item.unitPrice);

  if (quantity === null || unitPrice === null) {
    return null;
  }

  return (quantity * unitPrice + quantityScale / 2n) / quantityScale;
}

function calculatePreview(items: QuoteFormData['items'], discountValue: string): QuotePreview {
  const lineTotals = items.map(calculateLineTotal);
  const hasIncompleteItems = lineTotals.some((total) => total === null);

  const subtotal = lineTotals.reduce<bigint>((sum, lineTotal) => sum + (lineTotal ?? 0n), 0n);

  const normalizedDiscount = discountValue.trim();
  const discount = normalizedDiscount === '' ? 0n : parseMoneyInCents(normalizedDiscount);

  const isDiscountGreaterThanSubtotal =
    !hasIncompleteItems && discount !== null && discount > subtotal;

  const total =
    hasIncompleteItems || discount === null || isDiscountGreaterThanSubtotal
      ? null
      : subtotal - discount;

  return {
    lineTotals,
    subtotal,
    discount,
    total,
    hasIncompleteItems,
    isDiscountGreaterThanSubtotal,
  };
}

function formatCents(value: bigint): string {
  const cents = value.toString().padStart(3, '0');
  const integer = cents.slice(0, -2);
  const fraction = cents.slice(-2);
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `R$ ${groupedInteger},${fraction}`;
}

function createEmptyItem(): QuoteFormData['items'][number] {
  return {
    productId: '',
    sourceItemId: '',
    priceSelection: 'MANUAL',
    expectedProductUpdatedAt: '',
    expectedAdoptedPricingVersionId: '',
    description: '',
    unit: 'UN',
    quantity: '1',
    unitPrice: '',
    notes: '',
  };
}

interface QuoteFormProps {
  clients: Pick<Client, 'id' | 'name'>[];
  products: Pick<
    Product,
    'id' | 'name' | 'unit' | 'salePrice' | 'updatedAt' | 'adoptedPricingVersionId'
  >[];
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (data: QuoteFormData) => void;
  onCancel: () => void;
  onRefreshCatalog?: () => Promise<
    Pick<Product, 'id' | 'salePrice' | 'updatedAt' | 'adoptedPricingVersionId'>[]
  >;
  initialValues?: QuoteFormData;
  submitLabel?: string;
}

export function QuoteForm({
  clients,
  products,
  isPending,
  errorMessage,
  initialValues,
  submitLabel = 'Salvar orçamento',
  onSubmit,
  onCancel,
  onRefreshCatalog,
}: QuoteFormProps) {
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setValue,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: initialValues ?? {
      clientId: '',
      validUntil: '',
      discount: '',
      notes: '',
      items: [createEmptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = useWatch({
    control,
    name: 'items',
  });

  const watchedDiscount = useWatch({
    control,
    name: 'discount',
  });

  const preview = calculatePreview(watchedItems ?? [], watchedDiscount ?? '');

  async function refreshCatalog() {
    if (!onRefreshCatalog || isRefreshingCatalog) return;
    setIsRefreshingCatalog(true);
    setRefreshError('');
    try {
      const currentProducts = await onRefreshCatalog();
      let unavailable = false;
      for (const [index, item] of getValues('items').entries()) {
        if (item.priceSelection !== 'CATALOG_NOW') continue;
        const current = currentProducts.find((product) => product.id === item.productId);
        if (
          !current ||
          current.salePrice === null ||
          current.adoptedPricingVersionId === undefined
        ) {
          unavailable = true;
          continue;
        }
        setValue(`items.${index}.unitPrice`, current.salePrice, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setValue(`items.${index}.expectedProductUpdatedAt`, current.updatedAt);
        setValue(
          `items.${index}.expectedAdoptedPricingVersionId`,
          current.adoptedPricingVersionId ?? '',
        );
      }
      if (unavailable)
        setRefreshError(
          'Algum produto não possui preço atual disponível. Escolha preço manual ou regularize o cadastro.',
        );
    } catch {
      setRefreshError(
        'Não foi possível atualizar o catálogo. O rascunho foi preservado; tente novamente.',
      );
    } finally {
      setIsRefreshingCatalog(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quote-client">Cliente</Label>
          <select
            id="quote-client"
            aria-invalid={Boolean(errors.clientId)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register('clientId')}
          >
            <option value="">Selecione</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.clientId && <p className="text-sm text-destructive">{errors.clientId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quote-valid-until">Válido até</Label>
          <Input
            id="quote-valid-until"
            type="date"
            aria-invalid={Boolean(errors.validUntil)}
            {...register('validUntil')}
          />
          {errors.validUntil && (
            <p className="text-sm text-destructive">{errors.validUntil.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quote-discount">Desconto opcional</Label>
        <Input
          id="quote-discount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={Boolean(errors.discount)}
          {...register('discount')}
        />
        <p className="text-xs text-muted-foreground">
          Use ponto como separador decimal. A prévia é atualizada aqui e o valor final é confirmado
          pelo servidor.
        </p>
        {errors.discount && <p className="text-sm text-destructive">{errors.discount.message}</p>}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-medium">Itens do orçamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione um produto ou serviço do catálogo, ou preencha um item manualmente.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => append(createEmptyItem())}
            disabled={isPending || fields.length >= 100}
          >
            <Plus data-icon="inline-start" />
            Adicionar item
          </Button>
        </div>

        {fields.map((field, index) => {
          const productIdRegistration = register(`items.${index}.productId`);
          const itemErrors = errors.items?.[index];
          const lineTotal = preview.lineTotals[index] ?? null;
          const currentItem = watchedItems?.[index];
          const selectedProduct = products.find((product) => product.id === currentItem?.productId);

          return (
            <fieldset key={field.id} className="space-y-5 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={isPending || fields.length === 1}
                  aria-label={`Remover item ${index + 1}`}
                >
                  <Trash2 data-icon="inline-start" />
                  Remover
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`quote-item-product-${index}`}>Item do catálogo opcional</Label>
                <select
                  id={`quote-item-product-${index}`}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...productIdRegistration}
                  onChange={(event) => {
                    productIdRegistration.onChange(event);

                    const product = products.find(
                      (candidate) => candidate.id === event.target.value,
                    );

                    setValue(`items.${index}.sourceItemId`, '');
                    setValue(`items.${index}.expectedProductUpdatedAt`, product?.updatedAt ?? '');
                    setValue(
                      `items.${index}.expectedAdoptedPricingVersionId`,
                      product?.adoptedPricingVersionId ?? '',
                    );
                    setValue(
                      `items.${index}.priceSelection`,
                      product?.salePrice != null ? 'CATALOG_NOW' : 'MANUAL',
                    );
                    setValue(`items.${index}.unitPrice`, product?.salePrice ?? '', {
                      shouldValidate: true,
                    });

                    if (!product) {
                      return;
                    }

                    setValue(`items.${index}.description`, product.name, {
                      shouldValidate: true,
                    });
                    setValue(`items.${index}.unit`, product.unit, {
                      shouldValidate: true,
                    });
                    clearErrors([
                      `items.${index}.description`,
                      `items.${index}.unit`,
                      `items.${index}.unitPrice`,
                    ]);
                  }}
                >
                  <option value="">Item manual</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {product.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`quote-item-price-source-${index}`}>Origem do preço</Label>
                <select
                  id={`quote-item-price-source-${index}`}
                  value={currentItem?.priceSelection ?? 'MANUAL'}
                  onChange={(event) => {
                    const selection = event.target
                      .value as QuoteFormData['items'][number]['priceSelection'];
                    setValue(`items.${index}.priceSelection`, selection, { shouldDirty: true });
                    if (selection === 'CATALOG_NOW' && selectedProduct?.salePrice != null) {
                      setValue(`items.${index}.unitPrice`, selectedProduct.salePrice, {
                        shouldValidate: true,
                      });
                      setValue(
                        `items.${index}.expectedProductUpdatedAt`,
                        selectedProduct.updatedAt,
                      );
                      setValue(
                        `items.${index}.expectedAdoptedPricingVersionId`,
                        selectedProduct.adoptedPricingVersionId ?? '',
                      );
                    } else if (selection === 'PRESERVE') {
                      const original = initialValues?.items.find(
                        (item) => item.sourceItemId === currentItem?.sourceItemId,
                      );
                      if (original) {
                        setValue(`items.${index}.unitPrice`, original.unitPrice, {
                          shouldValidate: true,
                        });
                      }
                      setValue(`items.${index}.expectedProductUpdatedAt`, '');
                      setValue(`items.${index}.expectedAdoptedPricingVersionId`, '');
                    } else {
                      setValue(`items.${index}.expectedProductUpdatedAt`, '');
                      setValue(`items.${index}.expectedAdoptedPricingVersionId`, '');
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {currentItem?.sourceItemId && (
                    <option value="PRESERVE">Preservar preço histórico</option>
                  )}
                  {(selectedProduct?.salePrice != null ||
                    currentItem?.priceSelection === 'CATALOG_NOW') && (
                    <option value="CATALOG_NOW">Usar preço atual do produto</option>
                  )}
                  <option value="MANUAL">Definir preço manual</option>
                </select>
                {currentItem?.priceSelection === 'CATALOG_NOW' && (
                  <p className="text-xs text-muted-foreground">
                    Se o preço do produto mudar antes de salvar, será necessária nova confirmação.
                  </p>
                )}
                {selectedProduct &&
                  selectedProduct.salePrice === null &&
                  !currentItem?.sourceItemId && (
                    <p className="text-xs text-muted-foreground">
                      Este produto não possui preço atual. Defina um preço manual ou regularize o
                      cadastro.
                    </p>
                  )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`quote-item-description-${index}`}>
                    Descrição do item {index + 1}
                  </Label>
                  <Input
                    id={`quote-item-description-${index}`}
                    maxLength={160}
                    aria-invalid={Boolean(itemErrors?.description)}
                    {...register(`items.${index}.description`)}
                  />
                  {itemErrors?.description && (
                    <p className="text-sm text-destructive">{itemErrors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`quote-item-unit-${index}`}>Unidade</Label>
                  <Input
                    id={`quote-item-unit-${index}`}
                    maxLength={20}
                    placeholder="Ex.: UN, KG, M ou H"
                    aria-invalid={Boolean(itemErrors?.unit)}
                    {...register(`items.${index}.unit`)}
                  />
                  {itemErrors?.unit && (
                    <p className="text-sm text-destructive">{itemErrors.unit.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`quote-item-quantity-${index}`}>Quantidade</Label>
                  <Input
                    id={`quote-item-quantity-${index}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="1"
                    aria-invalid={Boolean(itemErrors?.quantity)}
                    {...register(`items.${index}.quantity`)}
                  />
                  {itemErrors?.quantity && (
                    <p className="text-sm text-destructive">{itemErrors.quantity.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`quote-item-unit-price-${index}`}>Preço unitário</Label>
                  <Input
                    id={`quote-item-unit-price-${index}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={Boolean(itemErrors?.unitPrice)}
                    readOnly={currentItem?.priceSelection !== 'MANUAL'}
                    {...register(`items.${index}.unitPrice`)}
                  />
                  {itemErrors?.unitPrice && (
                    <p className="text-sm text-destructive">{itemErrors.unitPrice.message}</p>
                  )}
                </div>
              </div>

              <div
                className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm"
                aria-live="polite"
              >
                <span className="text-muted-foreground">Total do item</span>
                <span className="font-medium tabular-nums">
                  {lineTotal === null
                    ? 'Informe quantidade e preço válidos.'
                    : formatCents(lineTotal)}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`quote-item-notes-${index}`}>Observações opcionais</Label>
                <textarea
                  id={`quote-item-notes-${index}`}
                  rows={3}
                  maxLength={2000}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-invalid={Boolean(itemErrors?.notes)}
                  {...register(`items.${index}.notes`)}
                />
                {itemErrors?.notes && (
                  <p className="text-sm text-destructive">{itemErrors.notes.message}</p>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>

      <section
        aria-label="Resumo do orçamento"
        className="rounded-lg border bg-muted/30 p-4"
        aria-live="polite"
      >
        <h2 className="font-medium">Resumo do orçamento</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium tabular-nums">{formatCents(preview.subtotal)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Desconto</dt>
            <dd className="font-medium tabular-nums">
              {preview.discount === null ? '—' : formatCents(preview.discount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-2 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold tabular-nums">
              {preview.total === null ? '—' : formatCents(preview.total)}
            </dd>
          </div>
        </dl>

        {preview.hasIncompleteItems && (
          <p className="mt-3 text-sm text-muted-foreground">
            Informe quantidade e preço unitário válidos para calcular o total.
          </p>
        )}

        {preview.discount === null && (
          <p className="mt-3 text-sm text-destructive">
            Informe um desconto válido, com até duas casas decimais.
          </p>
        )}

        {preview.isDiscountGreaterThanSubtotal && (
          <p className="mt-3 text-sm text-destructive">
            O desconto não pode ultrapassar o subtotal do orçamento.
          </p>
        )}
      </section>

      <div className="space-y-2">
        <Label htmlFor="quote-notes">Observações opcionais</Label>
        <textarea
          id="quote-notes"
          rows={4}
          maxLength={2000}
          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-invalid={Boolean(errors.notes)}
          {...register('notes')}
        />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      {errorMessage && (
        <div className="space-y-2">
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
          {onRefreshCatalog && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isRefreshingCatalog}
              onClick={() => void refreshCatalog()}
            >
              {isRefreshingCatalog ? 'Atualizando catálogo...' : 'Atualizar preços do catálogo'}
            </Button>
          )}
        </div>
      )}
      {refreshError && (
        <p role="alert" className="text-sm text-destructive">
          {refreshError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>

        <Button type="submit" disabled={isPending || isRefreshingCatalog}>
          {isPending ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
