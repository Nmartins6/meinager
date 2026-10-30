import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { formatBrl, percentageFractionToInput } from './format-pricing';
import { PricingAdoptionDialog } from './pricing-adoption-dialog';
import type { PricingVersionDetail, PricingVersionList } from './pricing-versions-contracts';
import { usePricingVersionDetailQuery, usePricingVersionsQuery } from './use-pricing-versions';

function DateText({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString('pt-BR')}</time>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}

function Provenance({
  title,
  entries,
}: {
  title: string;
  entries: Array<{
    label: string;
    origin: string;
    source: string | null;
    referenceId: string | null;
    criterion: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    measuredAt: string | null;
    confirmedByUserId: string | null;
  }>;
}) {
  return (
    <section className="space-y-2">
      <h4 className="font-semibold">{title}</h4>
      {entries.length === 0 ? (
        <p>Nenhuma origem registrada.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li key={`${entry.label}-${index}`} className="rounded border p-3">
              <strong>{entry.label}</strong> — {entry.origin}
              <p>
                Fonte: {entry.source ?? 'Não informada'}; referência:{' '}
                {entry.referenceId ?? 'Não informada'}; critério:{' '}
                {entry.criterion ?? 'Não informado'}
              </p>
              <p>
                Período: {entry.periodStart ?? '—'} a {entry.periodEnd ?? '—'}; apuração:{' '}
                {entry.measuredAt ?? '—'}; confirmação: {entry.confirmedByUserId ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VersionDetail({ version }: { version: PricingVersionDetail }) {
  const { snapshot } = version;
  const { result, context, input } = snapshot;
  return (
    <div className="space-y-5 text-sm">
      <p>
        {version.isAdopted
          ? 'Preço atual originado desta versão'
          : 'Esta versão não é a origem do preço atual.'}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact label="Versão" value={`Nº ${version.number} — ${version.state}`} />
        <Fact label="ID" value={version.id} />
        <Fact label="Finalizada em" value={version.finalizedAt} />
        <Fact label="Criada em" value={version.createdAt} />
        <Fact
          label="Fórmula e snapshot"
          value={`${version.formulaVersion} / v${version.snapshotSchemaVersion}`}
        />
        <Fact label="Moeda" value={version.currency} />
        <Fact
          label="Composição"
          value={`${context.composition.id} — revisão ${context.composition.revision}`}
        />
        <Fact
          label="Configuração"
          value={`${context.configuration.id} — revisão ${context.configuration.revision}`}
        />
        <Fact label="Vigência da configuração" value={context.configuration.effectiveFrom} />
        <Fact
          label="Perfil"
          value={
            context.salesProfile
              ? `${context.salesProfile.name} — revisão ${context.salesProfile.revision}`
              : 'Sem perfil'
          }
        />
        <Fact
          label="Margem efetiva desejada"
          value={`${percentageFractionToInput(context.effectiveDesiredMargin.value)}% — ${context.effectiveDesiredMargin.precedence} (${context.effectiveDesiredMargin.origin})`}
        />
        <Fact label="Autoria" value={version.createdByUserId} />
        <Fact label="Apuração" value={`${context.calculatedAt} — ${context.calculatedByUserId}`} />
      </dl>
      <section>
        <h4 className="font-semibold">Entradas congeladas</h4>
        <p>
          Margem: {percentageFractionToInput(input.desiredMargin)}%; preço analisado informado:{' '}
          {input.adoptedPrice === null ? 'não informado' : formatBrl(input.adoptedPrice)}; mão de
          obra:{' '}
          {input.labor
            ? `${input.labor.timeMinutes} min, custo mensal ${formatBrl(input.labor.monthlyCost)}, ${input.labor.productiveHours} h produtivas`
            : 'não informada'}
          ; frete: {input.freight ? input.freight.mode : 'não informado'}; custos fixos:{' '}
          {input.fixedCosts ? input.fixedCosts.mode : 'não informados'}.
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Fact
            label="Custos fixos resolvidos"
            value={
              input.fixedCosts === null
                ? 'Não informados'
                : input.fixedCosts.mode === 'RATE'
                  ? `${percentageFractionToInput(input.fixedCosts.rate)}% (${input.fixedCosts.origin})`
                  : `${formatBrl(input.fixedCosts.monthlyCost)} mensais / ${formatBrl(input.fixedCosts.averageRevenue)} de faturamento (${input.fixedCosts.origin})`
            }
          />
          <Fact
            label="Frete resolvido"
            value={
              input.freight === null
                ? 'Não informado'
                : input.freight.mode === 'MANUAL'
                  ? `${formatBrl(input.freight.unitCost)} por unidade`
                  : `${formatBrl(input.freight.totalCost)} / ${input.freight.quantity} unidades; consumo ${input.freight.consumedQuantity ?? '1'}`
            }
          />
          <Fact
            label="Taxa total de deduções"
            value={`${percentageFractionToInput(result.totalDeductionRate)}%`}
          />
          <Fact
            label="Taxa efetiva de custos fixos"
            value={`${percentageFractionToInput(result.fixedCosts.rate)}%`}
          />
        </dl>
      </section>
      <section>
        <h4 className="font-semibold">Preços e análise congelados</h4>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Custo-base" value={formatBrl(result.baseCost.display)} />
          <Fact label="Custo-base exato" value={result.baseCost.exact} />
          <Fact label="Mínimo" value={formatBrl(version.minimumPriceCommercial)} />
          <Fact label="Mínimo exato" value={result.minimumPrice.exact} />
          <Fact label="Sugerido" value={formatBrl(version.suggestedPriceCommercial)} />
          <Fact label="Sugerido exato" value={result.suggestedPrice.exact} />
          <Fact label="Analisado" value={formatBrl(version.analyzedPrice)} />
          <Fact label="Classificação" value={version.classification} />
          <Fact label="Lucro" value={formatBrl(result.analysis.profit.display)} />
          <Fact label="Lucro exato" value={result.analysis.profit.exact} />
          <Fact
            label="Margem efetiva"
            value={
              result.analysis.effectiveMargin === null
                ? 'Não se aplica'
                : `${percentageFractionToInput(result.analysis.effectiveMargin)}%`
            }
          />
          <Fact
            label="Desconto máximo"
            value={
              result.maximumDiscountRate === null
                ? 'Não se aplica'
                : `${percentageFractionToInput(result.maximumDiscountRate)}%`
            }
          />
          <Fact
            label="Deduções totais"
            value={formatBrl(result.analysis.totalDeductions.display)}
          />
          <Fact label="Custos fixos" value={formatBrl(result.analysis.fixedCosts.display)} />
          <Fact
            label="Mão de obra calculada"
            value={result.labor ? formatBrl(result.labor.total.display) : 'Não aplicada'}
          />
          <Fact
            label="Frete calculado"
            value={result.freight ? formatBrl(result.freight.total.display) : 'Não aplicado'}
          />
        </dl>
      </section>
      <section>
        <h4 className="font-semibold">Componentes congelados ({version.componentCount})</h4>
        <ul className="space-y-2">
          {version.components.map((item) => (
            <li key={item.id} className="rounded border p-3">
              {item.position}. {item.description} ({item.category}, {item.unit}) — {item.quantity} ×{' '}
              {formatBrl(item.effectiveUnitCost)} = {formatBrl(item.totalDisplay)};{' '}
              {item.costSource}
              {item.sourceProductId ? `, produto ${item.sourceProductId}` : ''}. Total exato:{' '}
              {item.totalExact}.
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="font-semibold">Deduções congeladas ({version.deductionCount})</h4>
        <ul className="space-y-2">
          {version.deductions.map((item) => (
            <li key={item.id} className="rounded border p-3">
              {item.position}. {item.name} ({item.category}) —{' '}
              {percentageFractionToInput(item.rate)}%, {formatBrl(item.amountDisplay)}; origem{' '}
              {item.origin}. Valor exato: {item.amountExact}.
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="font-semibold">Decomposição e avisos</h4>
        <p>
          Custos fixos: {formatBrl(result.analysis.fixedCosts.display)}; deduções:{' '}
          {formatBrl(result.analysis.totalDeductions.display)}; diferença do sugerido:{' '}
          {formatBrl(result.analysis.differenceFromSuggestedExact.display)}.
        </p>
        {result.warnings.length ? (
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        ) : (
          <p>Sem avisos.</p>
        )}
      </section>
      <Provenance
        title="Origens da composição"
        entries={context.composition.parameterOrigins.map((item) => ({
          ...item,
          label: item.parameter,
        }))}
      />
      <Provenance
        title="Origens da configuração"
        entries={context.configuration.parameterOrigins.map((item) => ({
          ...item,
          label: item.parameter,
        }))}
      />
      <Provenance
        title="Origens dos componentes"
        entries={context.componentOrigins.map((item) => ({
          ...item,
          label: `Componente ${item.position}`,
        }))}
      />
      <Provenance
        title="Origens das deduções"
        entries={context.deductionOrigins.map((item) => ({
          ...item,
          label: `Dedução ${item.position}`,
        }))}
      />
    </div>
  );
}

export function PricingVersionsPanel({
  productId,
  createdVersionId,
  canAdopt,
  canAdoptBelowMinimum,
  onPriceMayHaveChanged,
}: {
  productId: string;
  createdVersionId?: string;
  canAdopt: boolean;
  canAdoptBelowMinimum: boolean;
  onPriceMayHaveChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adoptionVersion, setAdoptionVersion] = useState<PricingVersionList['data'][number] | null>(
    null,
  );
  const list = usePricingVersionsQuery(productId, page, 20, true);
  const detail = usePricingVersionDetailQuery(productId, selectedId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de versões</CardTitle>
        <CardDescription>
          Versões finalizadas, do cálculo mais recente ao mais antigo. A origem do preço atual é
          consultada dinamicamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {createdVersionId && (
          <p role="status">
            Versão criada: {createdVersionId}. Abra o detalhe para consultar o snapshot histórico.
          </p>
        )}
        {list.isPending ? (
          <p role="status">Carregando versões...</p>
        ) : list.isError ? (
          <div role="alert">
            <p>{list.error.message}</p>
            <Button
              type="button"
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : list.data.data.length === 0 ? (
          <p>Nenhuma versão finalizada.</p>
        ) : (
          <>
            <ol className="space-y-3">
              {list.data.data.map((version) => (
                <li key={version.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong>Versão {version.number}</strong> —{' '}
                      <DateText value={version.finalizedAt} />
                      <p>
                        {version.isAdopted
                          ? 'Preço atual originado desta versão'
                          : 'Não adotada atualmente'}
                      </p>
                      <p>
                        Mínimo {formatBrl(version.minimumPriceCommercial)} · sugerido{' '}
                        {formatBrl(version.suggestedPriceCommercial)} · analisado{' '}
                        {formatBrl(version.analyzedPrice)}
                      </p>
                      <p>
                        {version.classification} · {version.formulaVersion}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedId(version.id)}
                    >
                      Ver detalhe da versão {version.number}
                    </Button>
                    {canAdopt &&
                      (version.classification !== 'BELOW_MINIMUM' || canAdoptBelowMinimum) && (
                        <Button type="button" onClick={() => setAdoptionVersion(version)}>
                          Adotar versão {version.number}
                        </Button>
                      )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {list.data.pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= list.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        )}
        <Dialog.Root
          open={selectedId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
            <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
              <Dialog.Popup className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl outline-none">
                <Dialog.Title className="text-xl font-semibold">
                  Detalhe histórico da versão
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-muted-foreground">
                  Snapshot e projeções congelados; consulta somente leitura.
                </Dialog.Description>
                <div className="mt-5">
                  {detail.isPending ? (
                    <p role="status">Carregando detalhe...</p>
                  ) : detail.isError ? (
                    <div role="alert">
                      <p>{detail.error.message}</p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={detail.isFetching}
                        onClick={() => void detail.refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    <VersionDetail version={detail.data} />
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <Dialog.Close render={<Button type="button" variant="outline" />}>
                    Fechar
                  </Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
        {adoptionVersion && (
          <PricingAdoptionDialog
            key={`${productId}:${adoptionVersion.id}`}
            productId={productId}
            version={adoptionVersion}
            canAdopt={canAdopt}
            canAdoptBelowMinimum={canAdoptBelowMinimum}
            onClose={() => setAdoptionVersion(null)}
            onPriceMayHaveChanged={onPriceMayHaveChanged}
          />
        )}
      </CardContent>
    </Card>
  );
}
