import type { PricingClassification, PricingCalculatorResult } from '@meinager/pricing-calculator';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { formatBrl, formatPercentage as percentage } from './format-pricing';
import type { PricingPreviewCalculation } from './pricing-preview-adapter';

export type PricingPreviewViewState =
  | PricingPreviewCalculation
  | { readonly status: 'waiting'; readonly message: string }
  | { readonly status: 'profile-loading'; readonly message: string }
  | { readonly status: 'profile-error'; readonly message: string }
  | { readonly status: 'dependency-error'; readonly message: string };

const classificationLabels: Record<PricingClassification, string> = {
  BELOW_MINIMUM: 'Abaixo do preço mínimo',
  COST_COVERAGE: 'Cobertura de custos',
  BELOW_DESIRED_MARGIN: 'Abaixo da margem desejada',
  DESIRED_MARGIN_MET: 'Margem desejada atingida',
  ABOVE_DESIRED_MARGIN: 'Acima da margem desejada',
};

function ResultValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-lg font-semibold">{value}</dd>
    </div>
  );
}

function PricingBreakdown({ result }: { result: PricingCalculatorResult }) {
  return (
    <div className="space-y-5">
      <section aria-labelledby="pricing-components-title">
        <h4 id="pricing-components-title" className="font-semibold">
          Componentes
        </h4>
        {result.components.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum componente informado.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Componente</th>
                  <th className="py-2 pr-3 font-medium">Origem</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {result.components.map((component, index) => (
                  <tr key={`${component.description}-${index}`} className="border-b last:border-0">
                    <td className="py-2 pr-3">{component.description}</td>
                    <td className="py-2 pr-3">{component.origin}</td>
                    <td className="py-2 text-right">{formatBrl(component.total.display)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result.labor && (
        <section aria-labelledby="pricing-labor-title">
          <h4 id="pricing-labor-title" className="font-semibold">
            Mão de obra
          </h4>
          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
            <ResultValue
              label="Custo por hora"
              value={formatBrl(result.labor.costPerHour.display)}
            />
            <ResultValue
              label="Custo por minuto"
              value={formatBrl(result.labor.costPerMinute.display)}
            />
            <ResultValue
              label="Total de mão de obra"
              value={formatBrl(result.labor.total.display)}
            />
          </dl>
        </section>
      )}

      {result.freight && (
        <section aria-labelledby="pricing-freight-title">
          <h4 id="pricing-freight-title" className="font-semibold">
            Frete
          </h4>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <ResultValue
              label="Custo por unidade do lote"
              value={formatBrl(result.freight.costPerLotUnit.display)}
            />
            <ResultValue label="Total de frete" value={formatBrl(result.freight.total.display)} />
          </dl>
        </section>
      )}

      <section aria-labelledby="pricing-analysis-title">
        <h4 id="pricing-analysis-title" className="font-semibold">
          Análise do preço
        </h4>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ResultValue
            label="Cobertura de custos fixos"
            value={formatBrl(result.analysis.fixedCosts.display)}
          />
          <ResultValue
            label="Total de deduções"
            value={formatBrl(result.analysis.totalDeductions.display)}
          />
          <ResultValue label="Lucro" value={formatBrl(result.analysis.profit.display)} />
          <ResultValue label="Margem efetiva" value={percentage(result.analysis.effectiveMargin)} />
          <ResultValue
            label="Diferença para o sugerido"
            value={formatBrl(result.analysis.differenceFromSuggestedExact.display)}
          />
          <ResultValue label="Desconto máximo" value={percentage(result.maximumDiscountRate)} />
        </dl>
      </section>

      <section aria-labelledby="pricing-deductions-title">
        <h4 id="pricing-deductions-title" className="font-semibold">
          Deduções
        </h4>
        {result.analysis.deductions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma dedução aplicada.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {result.analysis.deductions.map((deduction, index) => (
              <li
                key={`${deduction.name}-${index}`}
                className="flex flex-wrap justify-between gap-2 p-3 text-sm"
              >
                <span>
                  {deduction.name} — {percentage(deduction.rate)}
                </span>
                <strong>{formatBrl(deduction.amount.display)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PricingResultDetails({
  result,
  analyzesCurrentPrice,
}: {
  result: PricingCalculatorResult;
  analyzesCurrentPrice: boolean;
}) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ResultValue label="Custo-base" value={formatBrl(result.baseCost.display)} />
        <ResultValue label="Preço mínimo" value={formatBrl(result.minimumPrice.commercial)} />
        <ResultValue label="Preço sugerido" value={formatBrl(result.suggestedPrice.commercial)} />
        <ResultValue
          label={analyzesCurrentPrice ? 'Análise do preço atual' : 'Preço analisado'}
          value={formatBrl(result.analysis.price)}
        />
        <ResultValue label="Taxa de custos fixos" value={percentage(result.fixedCosts.rate)} />
        <ResultValue label="Taxa total de deduções" value={percentage(result.totalDeductionRate)} />
        <ResultValue label="Margem desejada" value={percentage(result.desiredMargin)} />
        <ResultValue
          label="Classificação"
          value={classificationLabels[result.analysis.classification]}
        />
        <ResultValue label="Versão da fórmula" value={result.formulaVersion} />
      </dl>

      <PricingBreakdown result={result} />

      {result.warnings.length > 0 && (
        <section aria-labelledby="pricing-warnings-title">
          <h4 id="pricing-warnings-title" className="font-semibold">
            Avisos
          </h4>
          <ul className="mt-2 space-y-2">
            {result.warnings.map((warning) => (
              <li
                key={warning.code}
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function PricingPreviewPanel({
  state,
  analyzesCurrentPrice,
  onRetryProfile,
  isRetryingProfile = false,
}: {
  state: PricingPreviewViewState;
  analyzesCurrentPrice: boolean;
  onRetryProfile?: () => void;
  isRetryingProfile?: boolean;
}) {
  if (state.status !== 'available') {
    const waiting = state.status === 'waiting' || state.status === 'profile-loading';
    return (
      <Card aria-live="polite">
        <CardHeader>
          <CardTitle role="heading" aria-level={3}>
            Prévia local
          </CardTitle>
          <CardDescription>
            Esta é uma prévia local. Nenhum preço ou versão será alterado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role={waiting ? 'status' : 'alert'}
            className={
              waiting
                ? 'rounded-lg bg-muted p-4 text-sm text-muted-foreground'
                : 'rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950'
            }
          >
            <p>{state.message}</p>
            {state.status === 'profile-error' && onRetryProfile && (
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={isRetryingProfile}
                onClick={onRetryProfile}
              >
                {isRetryingProfile ? 'Tentando novamente...' : 'Tentar novamente o perfil'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { result } = state;
  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          Prévia local
        </CardTitle>
        <CardDescription>
          Esta é uma prévia local. Nenhum preço ou versão será alterado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PricingResultDetails result={result} analyzesCurrentPrice={analyzesCurrentPrice} />
      </CardContent>
    </Card>
  );
}
