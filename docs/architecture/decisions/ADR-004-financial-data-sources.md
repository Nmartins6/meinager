# ADR-004 — Fontes financeiras utilizadas pela precificação

- Status: aceito
- Data: 02/10/2026
- Domínio: precificação e financeiro
- Decisores: responsáveis pelo produto Meinager

## Contexto

O Meinager já possui funcionalidades financeiras para:

- categorias;
- contas;
- lançamentos a pagar e receber;
- baixas;
- períodos;
- resumos financeiros.

A precificação precisa utilizar valores como:

- custo fixo mensal;
- faturamento mensal médio;
- custo mensal de mão de obra;
- impostos;
- taxas;
- comissões.

Esses valores poderão ser informados manualmente ou derivados do módulo
financeiro.

Obrigar a existência de histórico financeiro impediria o uso da precificação
por organizações novas ou que ainda não utilizam todo o módulo financeiro.

Consultar dados financeiros atuais durante a leitura de um cálculo histórico
também faria o resultado mudar com o tempo.

Além disso, a precificação não deve criar dependência circular na qual:

1. o financeiro calcula a precificação;
2. a precificação cria lançamentos financeiros;
3. esses lançamentos alteram retroativamente a própria precificação.

## Decisão

O motor de precificação receberá valores já consolidados como entrada.

Ele não deverá consultar diretamente lançamentos financeiros durante a
execução da fórmula.

Uma camada de aplicação poderá obter agregados do módulo financeiro e
transformá-los em entradas para o motor.

Cada valor utilizado deverá preservar sua origem no snapshot.

## Origens suportadas

Cada parâmetro poderá possuir uma destas origens:

```text
MANUAL
FINANCIAL_AGGREGATE
COPIED
```

Significados:

- `MANUAL`: valor informado pelo usuário;
- `FINANCIAL_AGGREGATE`: valor calculado a partir do módulo financeiro;
- `COPIED`: valor copiado de uma configuração ou versão anterior.

Novas origens poderão ser adicionadas sem alterar as fórmulas.

## Primeira entrega

Na primeira entrega, todos os parâmetros necessários poderão ser informados
manualmente.

A integração automática com o financeiro poderá ser implementada no mesmo
ciclo ou em etapa posterior, desde que:

- a estrutura registre a origem;
- snapshots preservem os valores;
- contratos não assumam que todos os valores são manuais;
- o motor permaneça independente da fonte.

## Custo fixo mensal

Quando calculado a partir do financeiro, o custo fixo mensal deverá considerar
lançamentos de despesa:

- pertencentes à organização autenticada;
- não cancelados;
- classificados explicitamente como custo fixo;
- incluídos no período selecionado.

O sistema não deve inferir que uma categoria é fixa apenas por seu nome.

A categorização deverá possuir uma propriedade ou classificação explícita.

Despesas fixas registradas, mas ainda não pagas, poderão participar do custo
fixo, pois representam obrigações que o preço precisa cobrir.

O agregado deverá informar qual critério temporal foi utilizado, conforme o
modelo financeiro existente.

## Faturamento realizado

Quando calculado automaticamente, o faturamento realizado deverá considerar
somente valores de receita efetivamente recebidos.

Uma conta a receber criada, mas ainda não liquidada, não deve ser considerada
receita realizada.

Recebimentos parciais devem contribuir apenas com o valor efetivamente
recebido.

Lançamentos cancelados ou estornados devem respeitar as regras já existentes
do módulo financeiro.

## Faturamento mensal médio

O cálculo automático padrão utilizará os três últimos períodos mensais
concluídos.

\[
\text{FaturamentoMensalMédio}
=

\frac{\sum \text{ReceitasRecebidasNosPeríodos}}
{\text{QuantidadeDePeríodos}}
\]

O período mensal corrente e incompleto não deverá participar do padrão, pois
poderia reduzir artificialmente a média.

A configuração deverá preservar:

- data inicial;
- data final;
- quantidade de períodos;
- total recebido;
- média calculada;
- data do cálculo.

A arquitetura poderá permitir posteriormente a escolha entre 1 e 12 períodos.

## Organizações sem histórico suficiente

Quando não existirem três períodos concluídos, o sistema poderá:

1. calcular a média com os períodos concluídos disponíveis, mediante aviso; ou
2. solicitar valor manual.

Se não existir nenhum período concluído com receita válida, o sistema deverá
solicitar faturamento médio manual.

O sistema não deve assumir faturamento zero silenciosamente, pois isso
inviabilizaria o cálculo do percentual de custos fixos.

## Custos fixos sem histórico suficiente

Quando não houver dados financeiros confiáveis, o usuário poderá informar o
custo fixo mensal manualmente.

A interface deve identificar claramente quando um valor:

- veio do financeiro;
- foi informado manualmente;
- está desatualizado;
- precisa ser revisado.

## Atualização dos agregados

Atualizar um agregado financeiro poderá atualizar a configuração atual de
precificação somente mediante ação explícita do usuário.

A atualização não poderá:

- modificar versões salvas;
- alterar snapshots;
- atualizar preços comerciais automaticamente;
- recalcular orçamentos;
- recalcular pedidos.

## Custo de mão de obra

Na primeira versão, o custo mensal da mão de obra será um parâmetro próprio da
precificação.

O valor não será inferido automaticamente de lançamentos financeiros, pois uma
despesa de pessoal pode incluir valores não aplicáveis à mão de obra produtiva.

Uma integração futura poderá sugerir o valor, mas deverá exigir revisão antes
de utilizá-lo.

## Impostos, taxas e comissões

Na primeira versão, impostos, taxas de pagamento, comissões e marketplace serão
configurados em perfis de deduções.

O sistema não deverá tentar inferi-los automaticamente a partir dos
lançamentos financeiros.

Integrações futuras com vendas e recebimentos poderão calcular taxas
observadas, mas não poderão substituir silenciosamente os percentuais
configurados.

## Separação entre leitura e escrita

A integração deverá seguir esta direção:

```text
Financeiro
    -> agrega dados
    -> sugere entradas
    -> configuração de precificação
    -> motor de cálculo
```

A execução do motor não deverá produzir escrita no financeiro.

Uma venda, orçamento, pedido ou recebimento poderá gerar lançamentos por suas
próprias regras de domínio, não pelo simples fato de existir uma precificação.

## Snapshot da origem

Quando um valor derivado do financeiro for utilizado, o snapshot deverá
preservar:

- valor consolidado;
- origem;
- período;
- critérios de inclusão;
- data da apuração;
- identificador da configuração;
- usuário que confirmou sua utilização.

O snapshot não precisa copiar todos os lançamentos financeiros individuais,
desde que o agregado possa ser explicado e auditado.

## Permissões

A leitura de agregados deverá respeitar as permissões do módulo financeiro.

Proprietários e administradores poderão confirmar seu uso na configuração de
precificação.

A permissão para editar produtos não concede automaticamente permissão para
alterar a classificação de lançamentos financeiros.

## Falhas e indisponibilidade

Se o módulo financeiro não puder fornecer os agregados:

- o motor de cálculo manual deverá continuar disponível;
- o sistema deverá informar que os dados automáticos estão indisponíveis;
- nenhum valor antigo deverá ser apresentado como atualizado sem identificação;
- cálculos históricos deverão continuar acessíveis.

## Consequências positivas

- O motor permanece puro e testável.
- Organizações novas podem utilizar precificação manual.
- Dados financeiros podem ser integrados gradualmente.
- Snapshots continuam reproduzíveis.
- Evita-se dependência circular entre financeiro e precificação.
- A origem dos parâmetros fica auditável.

## Consequências e custos

- A configuração poderá duplicar agregados do financeiro.
- Será necessário indicar quando dados estiverem desatualizados.
- O usuário precisará confirmar atualizações.
- A classificação de custos fixos deverá ser explícita.
- Regime de caixa e critério temporal precisarão estar documentados nas
  consultas financeiras.

## Evoluções futuras

Poderão ser adicionados posteriormente:

- atualização assistida dos parâmetros;
- comparação entre valor configurado e realizado;
- sugestão de taxa média por meio de pagamento;
- previsão baseada em sazonalidade;
- média ponderada;
- alertas de parâmetros desatualizados;
- comparação de custo estimado e realizado;
- cálculo de ponto de equilíbrio.
