# ADR-001 — Alocação de custos fixos na precificação

- Status: aceito
- Data: 02/10/2026
- Domínio: precificação
- Decisores: responsáveis pelo produto Meinager

## Contexto

O levantamento inicial da precificação apresentou duas interpretações para o
rateio de custos fixos:

1. calcular a relação entre custos fixos mensais e faturamento mensal médio e
   multiplicar esse percentual pelo custo direto do produto;
2. calcular essa mesma relação e tratá-la como um percentual incidente sobre o
   preço final.

As duas interpretações produzem resultados diferentes.

Se o percentual representa quanto dos recursos obtidos com as vendas deve
cobrir os custos fixos da organização, ele representa uma parcela da receita.
Nesse caso, deve participar do divisor da formação do preço.

Aplicar esse percentual sobre o custo direto não garante que a parcela
correspondente do preço final seja destinada à cobertura dos custos fixos.

Também existe a possibilidade futura de distribuir o custo fixo como valor
unitário em reais, utilizando volume produzido, horas produtivas ou outro
direcionador. Essa é uma estratégia diferente e não deve ser combinada
automaticamente com o percentual sobre a receita.

## Decisão

A primeira versão do motor utilizará o percentual de custos fixos calculado
por:

\[
\text{PercentualCustosFixos}
=

\frac{\text{CustoFixoMensal}}
{\text{FaturamentoMensalMédio}}
\]

Esse percentual participará do divisor da formação do preço:

\[
\text{PreçoSugerido}
=

\frac{\text{CustoBase}}
{1-(\text{PercentualCustosFixos}+\text{Deduções}+\text{Margem})}
\]

O percentual não deverá:

- ser multiplicado pelo custo direto;
- ser adicionado ao custo-base;
- ser cobrado novamente como valor unitário;
- ser aplicado simultaneamente com outro rateio de custo fixo.

O custo-base conterá apenas componentes unitários expressos em reais.

## Estratégias alternativas

Uma futura versão poderá permitir custo fixo unitário em reais, calculado por
volume, tempo produtivo ou outro direcionador.

Quando essa estratégia existir, o motor deverá identificar explicitamente o
modo utilizado, por exemplo:

```text
REVENUE_PERCENTAGE
UNIT_AMOUNT
```

As estratégias serão mutuamente exclusivas dentro da mesma execução.

Uma mudança de estratégia deverá:

1. criar nova versão da fórmula;
2. preservar cálculos históricos;
3. registrar a estratégia no snapshot;
4. possuir exemplos e testes próprios;
5. passar por nova decisão arquitetural.

## Consequências positivas

- O preço reserva uma parcela explícita da receita para custos fixos.
- Custos fixos, deduções e margem utilizam a mesma base: o preço final.
- A decomposição do preço pode mostrar quanto da venda cobre custos fixos.
- O cálculo fica compatível com margem divisora ou markup por dentro.
- Evita-se cobrar o mesmo custo fixo duas vezes.

## Consequências e limitações

- O resultado depende de um faturamento médio confiável.
- Faturamento muito baixo pode gerar percentual elevado ou cálculo inviável.
- O percentual representa uma aproximação gerencial, não a atribuição contábil
  exata do custo fixo a cada produto.
- Produtos com estruturas operacionais muito diferentes podem exigir
  direcionadores de custo mais específicos no futuro.
- A organização deverá revisar periodicamente custos fixos e faturamento médio.

## Validações

O cálculo deve ser rejeitado quando:

- o faturamento médio for menor ou igual a zero;
- o custo fixo mensal for negativo;
- o percentual calculado for inválido;
- a soma de custos fixos, deduções e margem for igual ou superior a 100%.

Custo fixo mensal igual a zero é válido e resulta em percentual igual a zero.

## Compatibilidade histórica

Alterações no custo fixo ou faturamento médio não poderão modificar cálculos
já salvos.

Cada versão deve preservar:

- custo fixo mensal;
- faturamento médio;
- percentual calculado;
- origem dos valores;
- período ou janela considerada;
- versão da fórmula;
- data do cálculo.
