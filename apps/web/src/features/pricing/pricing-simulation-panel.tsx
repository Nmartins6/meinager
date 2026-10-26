import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { percentageFractionToInput } from './format-pricing';
import { PricingResultDetails } from './pricing-preview-panel';
import type { PricingSimulationResponse } from './pricing-simulation-contracts';

export interface PricingSimulationDisplay {
  readonly response: PricingSimulationResponse;
  readonly matchesLocalPreview: boolean;
  readonly stale: boolean;
}

export function PricingSimulationPanel({
  canSimulate,
  simulation,
  error,
  isPending,
  canSubmit,
  onSimulate,
}: {
  canSimulate: boolean;
  simulation?: PricingSimulationDisplay;
  error?: string;
  isPending: boolean;
  canSubmit: boolean;
  onSimulate: () => void;
}) {
  if (!canSimulate) return null;
  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          Simulação autoritativa
        </CardTitle>
        <CardDescription>
          A simulação confirma o cálculo no servidor, mas não altera o produto nem salva uma versão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button type="button" disabled={isPending || !canSubmit} onClick={onSimulate}>
          {isPending ? 'Confirmando simulação...' : 'Confirmar simulação no servidor'}
        </Button>

        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={onSimulate}>
              Tentar novamente
            </Button>
          </div>
        )}

        {simulation && (
          <div className="space-y-5">
            {simulation.stale ? (
              <p
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
              >
                Esta confirmação está desatualizada porque o rascunho foi alterado.
              </p>
            ) : simulation.matchesLocalPreview ? (
              <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                Cálculo confirmado pelo servidor e idêntico à prévia local.
              </p>
            ) : (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                Os dados autoritativos diferem da prévia local. Revise os dois resultados antes de
                continuar.
              </p>
            )}

            <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Fonte</dt>
                <dd className="font-medium">{simulation.response.source}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Composição</dt>
                <dd className="font-medium">
                  {simulation.response.compositionRevision === null
                    ? 'Rascunho não persistido'
                    : `Revisão ${simulation.response.compositionRevision}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Configuração</dt>
                <dd className="font-medium">
                  Revisão {simulation.response.configuration.revision}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Perfil</dt>
                <dd className="font-medium">
                  {simulation.response.profile
                    ? `${simulation.response.profile.name} — revisão ${simulation.response.profile.revision}`
                    : 'Sem perfil'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Margem efetiva</dt>
                <dd className="font-medium">
                  {percentageFractionToInput(simulation.response.effectiveDesiredMargin.value)}% —{' '}
                  {simulation.response.effectiveDesiredMargin.precedence}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fórmula</dt>
                <dd className="font-medium">{simulation.response.formulaVersion}</dd>
              </div>
            </dl>

            <PricingResultDetails
              result={simulation.response.result}
              analyzesCurrentPrice={simulation.response.adoptedPrice !== null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
