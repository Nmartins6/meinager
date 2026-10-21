import {
  calculatePricing,
  PricingCalculatorError,
  type PricingCalculatorInput,
  type PricingCalculatorResult,
  type PricingComponentInput,
  type PricingParameterOrigin,
} from '@meinager/pricing-calculator';

import type { Product } from '@/features/products/products-api';

import type { PricingConfiguration } from './pricing-configuration-contracts';
import type { PricingCompositionFormValues } from './pricing-composition-form-state';
import { canonicalizeDecimalInput, canonicalizePercentageInput } from './format-pricing';
import type { PricingProfileDetail } from './pricing-profiles-contracts';

export interface PricingPreviewCatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly directCost: string | null | undefined;
  readonly isActive: boolean;
  readonly eligible: boolean;
}

export type PricingPreviewBlockedStatus =
  | 'configuration-missing'
  | 'missing-parameter'
  | 'profile-inactive'
  | 'catalog-incompatible'
  | 'incomplete-draft'
  | 'calculator-error';

export type PricingPreviewCalculation =
  | {
      readonly status: 'available';
      readonly input: PricingCalculatorInput;
      readonly result: PricingCalculatorResult;
    }
  | {
      readonly status: PricingPreviewBlockedStatus;
      readonly message: string;
      readonly field?: string;
      readonly code?: PricingCalculatorError['code'];
    };

interface BuildPricingPreviewOptions {
  readonly product: Pick<Product, 'id' | 'salePrice'>;
  readonly values: PricingCompositionFormValues;
  readonly configuration: PricingConfiguration | null;
  readonly profile: PricingProfileDetail | null;
  readonly catalogProducts: readonly PricingPreviewCatalogProduct[];
}

const valueLimits = { integerDigits: 13, scale: 6 } as const;

function blocked(
  status: PricingPreviewBlockedStatus,
  message: string,
  field?: string,
): PricingPreviewCalculation {
  return { status, message, ...(field ? { field } : {}) };
}

function decimal(value: string, field: string): string | PricingPreviewCalculation {
  const result = canonicalizeDecimalInput(value, valueLimits);
  return (
    result ??
    blocked(
      'incomplete-draft',
      'Complete os valores financeiros válidos do rascunho para atualizar a prévia.',
      field,
    )
  );
}

function configurationOrigin(
  configuration: PricingConfiguration,
  parameter: 'fixedCostRate' | 'monthlyFixedCost',
): PricingParameterOrigin | null {
  return configuration.currentRevision.parameterOrigins[parameter]?.origin ?? null;
}

interface ResolvedDesiredMargin {
  readonly value: string;
  readonly precedence: 'COMPOSITION' | 'CONFIGURATION';
  readonly origin: PricingParameterOrigin;
}

function resolveDesiredMargin(
  values: PricingCompositionFormValues,
  configuration: PricingConfiguration,
): ResolvedDesiredMargin | PricingPreviewCalculation {
  if (values.desiredMargin.trim() !== '') {
    const value = canonicalizePercentageInput(values.desiredMargin);
    if (value === null) {
      return blocked(
        'incomplete-draft',
        'Informe uma margem desejada válida para atualizar a prévia.',
        'desiredMargin',
      );
    }
    const origin = values.parameterOrigins.desiredMargin.origin;
    if (origin === '') {
      return blocked(
        'incomplete-draft',
        'Informe a origem da margem desejada da composição para atualizar a prévia.',
        'parameterOrigins.desiredMargin',
      );
    }
    return { value, precedence: 'COMPOSITION', origin };
  }

  const value = configuration.currentRevision.defaultDesiredMargin;
  if (value === null) {
    return blocked(
      'missing-parameter',
      'Informe uma margem na composição ou na configuração organizacional.',
      'desiredMargin',
    );
  }
  const origin =
    configuration.currentRevision.parameterOrigins.defaultDesiredMargin?.origin ?? null;
  if (origin === null) {
    return blocked(
      'missing-parameter',
      'A margem padrão da configuração exige uma origem.',
      'parameterOrigins.defaultDesiredMargin',
    );
  }
  return { value, precedence: 'CONFIGURATION', origin };
}

function buildComponents(
  productId: string,
  values: PricingCompositionFormValues,
  catalogProducts: readonly PricingPreviewCatalogProduct[],
): readonly PricingComponentInput[] | PricingPreviewCalculation {
  const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));
  const resolved: PricingComponentInput[] = [];

  for (const [index, component] of values.components.entries()) {
    const prefix = `components.${index}`;
    const description = component.description.trim();
    const unit = component.unit.trim();
    if (!description || !unit) {
      return blocked(
        'incomplete-draft',
        'Complete a descrição e a unidade dos componentes para atualizar a prévia.',
        !description ? `${prefix}.description` : `${prefix}.unit`,
      );
    }
    const quantity = decimal(component.quantity, `${prefix}.quantity`);
    if (typeof quantity !== 'string') return quantity;

    if (component.costSource === 'CATALOG') {
      const sourceId = component.sourceProductId;
      const source = catalogById.get(sourceId);
      if (!sourceId || sourceId === productId || !source) {
        return blocked(
          'catalog-incompatible',
          'Selecione um produto de catálogo válido para este componente.',
          `${prefix}.sourceProductId`,
        );
      }
      if (!source.eligible || !source.isActive || typeof source.directCost !== 'string') {
        return blocked(
          'catalog-incompatible',
          'O produto de catálogo deve estar ativo e possuir custo direto atual.',
          `${prefix}.sourceProductId`,
        );
      }
      if (source.unit.trim().toUpperCase() !== unit.toUpperCase()) {
        return blocked(
          'catalog-incompatible',
          'A unidade do componente deve corresponder à unidade do produto de catálogo.',
          `${prefix}.unit`,
        );
      }
      const unitCost = decimal(source.directCost, `${prefix}.sourceProductId`);
      if (typeof unitCost !== 'string') {
        return blocked(
          'catalog-incompatible',
          'O custo direto atual do produto de catálogo é inválido.',
          `${prefix}.sourceProductId`,
        );
      }
      resolved.push({
        description,
        category: component.category,
        unit,
        quantity,
        unitCost,
        origin: 'CATALOG',
        productId: source.id,
      });
      continue;
    }

    const unitCost = decimal(component.storedUnitCost, `${prefix}.storedUnitCost`);
    if (typeof unitCost !== 'string') return unitCost;
    resolved.push({
      description,
      category: component.category,
      unit,
      quantity,
      unitCost,
      origin: component.costSource,
    });
  }

  return resolved;
}

export function buildLocalPricingPreview({
  product,
  values,
  configuration,
  profile,
  catalogProducts,
}: BuildPricingPreviewOptions): PricingPreviewCalculation {
  if (configuration === null || !configuration.isActive) {
    return blocked(
      'configuration-missing',
      'Configure os parâmetros organizacionais antes de calcular a prévia.',
    );
  }
  if (configuration.currentRevision.currency !== 'BRL') {
    return blocked(
      'missing-parameter',
      'A configuração de precificação deve usar BRL.',
      'currency',
    );
  }
  if (values.profileId !== '') {
    if (!profile || profile.id !== values.profileId) {
      return blocked(
        'incomplete-draft',
        'O detalhe do perfil selecionado ainda não está disponível.',
        'profileId',
      );
    }
    if (!profile.isActive) {
      return blocked(
        'profile-inactive',
        'O perfil de venda selecionado está inativo.',
        'profileId',
      );
    }
  }

  const components = buildComponents(product.id, values, catalogProducts);
  if (!Array.isArray(components)) return components as PricingPreviewCalculation;

  const desiredMargin = resolveDesiredMargin(values, configuration);
  if ('status' in desiredMargin) return desiredMargin;

  const revision = configuration.currentRevision;
  let fixedCosts: PricingCalculatorInput['fixedCosts'];
  if (revision.fixedCostMode === 'RATE') {
    const origin = configurationOrigin(configuration, 'fixedCostRate');
    if (revision.fixedCostRate === null || origin === null) {
      return blocked(
        'missing-parameter',
        'A configuração por taxa exige o percentual de custo fixo e sua origem.',
        revision.fixedCostRate === null ? 'fixedCostRate' : 'parameterOrigins.fixedCostRate',
      );
    }
    fixedCosts = { mode: 'RATE', rate: revision.fixedCostRate, origin };
  } else if (revision.fixedCostMode === 'MONTHLY') {
    const origin = configurationOrigin(configuration, 'monthlyFixedCost');
    if (
      revision.monthlyFixedCost === null ||
      revision.averageMonthlyRevenue === null ||
      origin === null
    ) {
      return blocked(
        'missing-parameter',
        'A configuração mensal exige custo fixo, faturamento médio e origem do custo.',
        revision.monthlyFixedCost === null
          ? 'monthlyFixedCost'
          : revision.averageMonthlyRevenue === null
            ? 'averageMonthlyRevenue'
            : 'parameterOrigins.monthlyFixedCost',
      );
    }
    fixedCosts = {
      mode: 'MONTHLY',
      monthlyCost: revision.monthlyFixedCost,
      averageRevenue: revision.averageMonthlyRevenue,
      origin,
    };
  }

  let labor: PricingCalculatorInput['labor'];
  if (values.laborEnabled) {
    if (revision.monthlyLaborCost === null || revision.productiveHours === null) {
      return blocked(
        'missing-parameter',
        'A configuração de mão de obra exige custo mensal e horas produtivas.',
        revision.monthlyLaborCost === null ? 'monthlyLaborCost' : 'productiveHours',
      );
    }
    const timeMinutes = decimal(values.timeMinutes, 'timeMinutes');
    if (typeof timeMinutes !== 'string') return timeMinutes;
    labor = {
      monthlyCost: revision.monthlyLaborCost,
      productiveHours: revision.productiveHours,
      timeMinutes,
    };
  }

  let freight: PricingCalculatorInput['freight'];
  if (values.freightMode === 'MANUAL') {
    const unitCost = decimal(values.freightUnitCost, 'freightUnitCost');
    if (typeof unitCost !== 'string') return unitCost;
    freight = { mode: 'MANUAL', unitCost };
  } else if (values.freightMode === 'ALLOCATED') {
    const totalCost = decimal(values.freightTotalCost, 'freightTotalCost');
    if (typeof totalCost !== 'string') return totalCost;
    const quantity = decimal(values.freightQuantity, 'freightQuantity');
    if (typeof quantity !== 'string') return quantity;
    let consumedQuantity: string | undefined;
    if (values.freightConsumedQuantity.trim() !== '') {
      const consumed = decimal(values.freightConsumedQuantity, 'freightConsumedQuantity');
      if (typeof consumed !== 'string') return consumed;
      consumedQuantity = consumed;
    }
    freight = {
      mode: 'ALLOCATED',
      totalCost,
      quantity,
      ...(consumedQuantity === undefined ? {} : { consumedQuantity }),
    };
  }

  const input: PricingCalculatorInput = {
    currency: 'BRL',
    components,
    deductions:
      profile?.currentRevision.deductions.map((deduction) => ({
        name: deduction.name,
        category: deduction.category,
        rate: deduction.rate,
        origin: deduction.origin,
      })) ?? [],
    desiredMargin: desiredMargin.value,
    ...(fixedCosts === undefined ? {} : { fixedCosts }),
    ...(labor === undefined ? {} : { labor }),
    ...(freight === undefined ? {} : { freight }),
    ...(typeof product.salePrice === 'string' ? { adoptedPrice: product.salePrice } : {}),
  };

  try {
    return { status: 'available', input, result: calculatePricing(input) };
  } catch (error) {
    if (error instanceof PricingCalculatorError) {
      return {
        status: 'calculator-error',
        code: error.code,
        field: error.field,
        message: error.message,
      };
    }
    return blocked(
      'calculator-error',
      'Não foi possível calcular a prévia local com os dados informados.',
    );
  }
}
