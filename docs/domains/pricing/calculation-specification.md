# Especificação dos cálculos de precificação

## 1. Finalidade

Este documento define as fórmulas oficiais do motor de precificação do
Meinager.

Backend, frontend e testes automatizados devem produzir resultados
equivalentes para as mesmas entradas.

Os percentuais utilizados nas fórmulas são representados internamente como
frações decimais:

| Percentual informado | Valor interno |
| -------------------- | ------------- |
| 5%                   | `0.05`        |
| 10%                  | `0.10`        |
| 25,5%                | `0.255`       |

Nenhuma fórmula deve utilizar aritmética binária de ponto flutuante para
valores monetários persistidos.

## 2. Símbolos

### 2.1 Custos em reais

| Símbolo | Significado                      |
| ------- | -------------------------------- |
| `CD`    | Custo direto ou de aquisição     |
| `CM`    | Custo de materiais e insumos     |
| `CE`    | Custo de embalagem               |
| `CMO`   | Custo de mão de obra             |
| `CFU`   | Custo de frete unitário          |
| `CT`    | Custo de terceirização           |
| `CP`    | Custo de perdas ou desperdícios  |
| `CO`    | Outros custos unitários em reais |
| `CB`    | Custo-base total                 |

### 2.2 Percentuais

| Símbolo | Significado                      |
| ------- | -------------------------------- |
| `PF`    | Percentual de custos fixos       |
| `PI`    | Percentual de impostos           |
| `PT`    | Percentual de taxas de pagamento |
| `PC`    | Percentual de comissões          |
| `PM`    | Percentual de marketplace        |
| `PO`    | Outras deduções percentuais      |
| `DV`    | Soma das deduções de venda       |
| `ML`    | Margem de lucro desejada         |
| `ME`    | Margem efetiva                   |

### 2.3 Preços e resultados

| Símbolo | Significado                                  |
| ------- | -------------------------------------------- |
| `PMIN`  | Preço mínimo exato                           |
| `PSUG`  | Preço sugerido exato                         |
| `PAD`   | Preço adotado                                |
| `LC`    | Lucro estimado                               |
| `DCF`   | Valor destinado à cobertura dos custos fixos |
| `DDV`   | Valor total das deduções de venda            |

## 3. Composição de componentes

Quando um componente possuir quantidade e custo unitário:

\[
\text{Custo do componente}
=

\text{Quantidade}
\times
\text{Custo unitário}
\]

Para `n` componentes:

\[
\text{Total dos componentes}
=

\sum_{i=1}^{n}
(\text{Quantidade}_{i} \times \text{CustoUnitário}_{i})
\]

Quantidade e custo unitário devem ser maiores ou iguais a zero.

## 4. Custo-base

O custo-base é formado somente por valores unitários em reais:

\[
CB = CD + CM + CE + CMO + CFU + CT + CP + CO
\]

Componentes não utilizados assumem valor zero.

O percentual de custos fixos não deve ser somado ao custo-base quando estiver
sendo utilizado no divisor da formação de preço.

## 5. Mão de obra

### 5.1 Custo mensal consolidado

Quando a organização informar os componentes separadamente:

\[
\text{CustoMensalMDO}
=

\text{Salário} +
\text{Encargos} +
\text{Benefícios} +
\text{Provisões} +
\text{OutrosCustosMDO}
\]

A organização também poderá informar diretamente o custo mensal consolidado.

### 5.2 Minutos produtivos mensais

\[
\text{MinutosProdutivosMensais}
=

\text{HorasProdutivasMensais}
\times 60
\]

As horas produtivas mensais devem ser maiores que zero.

### 5.3 Custo por hora

\[
\text{CustoMDOHora}
=

\frac{\text{CustoMensalMDO}}
{\text{HorasProdutivasMensais}}
\]

### 5.4 Custo por minuto

\[
\text{CustoMDOMinuto}
=

\frac{\text{CustoMensalMDO}}
{\text{MinutosProdutivosMensais}}
\]

Equivalentemente:

\[
\text{CustoMDOMinuto}
=

\frac{\text{CustoMDOHora}}{60}
\]

### 5.5 Tempo total do produto

Se a interface receber horas e minutos:

\[
\text{TempoTotalMinutos}
=

(\text{HorasProduto} \times 60) +
\text{MinutosProduto}
\]

### 5.6 Custo de mão de obra do produto

\[
CMO
=

\text{TempoTotalMinutos}
\times
\text{CustoMDOMinuto}
\]

O tempo deve ser armazenado em minutos como unidade canônica.

## 6. Frete

### 6.1 Rateio uniforme por quantidade

\[
CFU
=

\frac{\text{FreteTotalLote}}
{\text{QuantidadeTotalLote}}
\]

A quantidade total do lote deve ser maior que zero.

### 6.2 Frete por quantidade consumida

Se o produto consumir mais de uma unidade do lote:

\[
\text{FreteProduto}
=

CFU
\times
\text{QuantidadeConsumida}
\]

### 6.3 Frete manual

Quando o frete unitário for informado diretamente:

\[
CFU = \text{FreteUnitárioInformado}
\]

O cálculo deve registrar se o frete teve origem manual ou foi rateado.

## 7. Percentual de custos fixos

\[
PF
=

\frac{\text{CustoFixoMensal}}
{\text{FaturamentoMensalMédio}}
\]

O faturamento mensal médio deve ser maior que zero.

Exemplo de conversão:

````text
Custo fixo mensal:       R$ 2.000,00
Faturamento mensal:     R$ 10.000,00
Percentual interno:             0,20
Percentual apresentado:          20%

O `PF` deve participar do divisor do preço. Ele não deve ser multiplicado pelo
custo direto nem adicionado novamente ao custo-base.

## 8. Deduções de venda

A soma das deduções incidentes sobre o preço final é:

\[
DV = PI + PT + PC + PM + PO
\]

O sistema deve preservar cada dedução individualmente.

Uma implementação extensível poderá representar as deduções como uma coleção:

\[
DV
=
\sum_{i=1}^{n}
\text{Dedução}_{i}
\]

Cada dedução deve possuir pelo menos:

- nome;
- tipo ou categoria;
- percentual;
- origem;
- posição ou ordem de apresentação.

## 9. Validação do divisor

### 9.1 Preço mínimo

O divisor do preço mínimo é:

\[
D_{mínimo} = 1 - (PF + DV)
\]

Para que o cálculo seja válido:

\[
PF + DV < 1
\]

E:

\[
D_{mínimo} > 0
\]

### 9.2 Preço sugerido

O divisor do preço sugerido é:

\[
D_{sugerido} = 1 - (PF + DV + ML)
\]

Para que o cálculo seja válido:

\[
PF + DV + ML < 1
\]

E:

\[
D_{sugerido} > 0
\]

Se qualquer divisor for menor ou igual a zero, o cálculo deve falhar sem
produzir preço.

## 10. Preço mínimo

O preço mínimo exato é:

\[
PMIN
=
\frac{CB}
{1-(PF+DV)}
\]

Esse preço cobre o custo-base, os custos fixos percentuais e as deduções de
venda, sem margem de lucro adicional.

## 11. Preço sugerido

O preço sugerido exato é:

\[
PSUG
=
\frac{CB}
{1-(PF+DV+ML)}
\]

A margem desejada incide sobre o preço final, e não sobre o custo-base.

## 12. Decomposição de um preço

Para analisar qualquer preço `P`:

### 12.1 Cobertura dos custos fixos

\[
DCF = P \times PF
\]

### 12.2 Valor individual de uma dedução

\[
\text{ValorDedução}_{i}
=
P
\times
\text{PercentualDedução}_{i}
\]

### 12.3 Total das deduções

\[
DDV = P \times DV
\]

Ou, preservando os componentes:

\[
DDV
=
\sum_{i=1}^{n}
(P \times \text{Dedução}_{i})
\]

### 12.4 Lucro estimado

\[
LC
=
P
-
CB
-
DCF
-
DDV
\]

### 12.5 Margem efetiva

Para `P > 0`:

\[
ME
=
\frac{LC}{P}
\]

Quando `P = 0`, a margem efetiva não deve ser calculada.

No preço sugerido exato, desconsideradas diferenças de arredondamento:

\[
ME = ML
\]

No preço mínimo exato:

\[
LC = 0
\]

E:

\[
ME = 0
\]

## 13. Análise do preço adotado

Quando o usuário informar um preço adotado:

\[
\text{DiferençaSugerido}
=
PAD - PSUG
\]

O sistema deve recalcular `DCF`, `DDV`, `LC` e `ME` utilizando `PAD`.

Classificação recomendada:

| Condição             | Classificação                          |
| -------------------- | -------------------------------------- |
| `PAD < PMIN`         | Abaixo do preço mínimo                 |
| `PAD = PMIN`         | Ponto de cobertura                     |
| `PMIN < PAD < PSUG`  | Rentável, abaixo da margem desejada    |
| `PAD = PSUG`         | Margem desejada atendida               |
| `PAD > PSUG`         | Acima da margem desejada               |

As comparações devem considerar os preços monetários efetivamente adotados,
depois da regra de arredondamento.

## 14. Desconto máximo

O desconto máximo teórico sobre o preço sugerido é:

\[
\text{DescontoMáximo}
=
1
-
\frac{PMIN}{PSUG}
\]

A fórmula somente deve ser aplicada quando:

```text
PSUG > 0
PMIN >= 0
PMIN <= PSUG
````

O resultado deve ser apresentado como percentual.

Para validar um preço promocional, o sistema deve analisar o preço final
resultante, e não somente o percentual informado.

## 15. Arredondamento

### 15.1 Cálculos intermediários

Valores intermediários não devem ser arredondados para duas casas durante a
execução.

O motor deve manter pelo menos:

- 6 casas decimais para valores monetários intermediários;
- 8 casas decimais para percentuais;
- precisão adicional durante divisões, quando suportada pela biblioteca
  decimal utilizada.

### 15.2 Exibição de valores

Valores monetários informativos devem ser exibidos com duas casas decimais
utilizando arredondamento decimal `half-up`.

Percentuais poderão ser exibidos com até quatro casas decimais quando
necessário.

### 15.3 Preço mínimo comercial

O preço mínimo apresentado para utilização comercial deve ser arredondado para
cima até o próximo centavo.

Isso evita que o arredondamento coloque o valor comercial abaixo do preço
mínimo exato.

### 15.4 Preço sugerido comercial

O preço sugerido para utilização comercial deve ser arredondado para cima até o
próximo centavo.

Isso evita que o arredondamento reduza a margem efetiva abaixo da margem
desejada.

### 15.5 Resultados após arredondamento

Depois de formar o preço comercial, lucro e margem efetiva devem ser
recalculados utilizando o preço efetivamente apresentado ou adotado.

O sistema poderá exibir uma margem efetiva ligeiramente superior à desejada em
razão do arredondamento para centavos.

## 16. Precisão e representação numérica

Valores monetários e percentuais não devem utilizar `number` do JavaScript como
fonte de verdade para cálculos persistidos.

A implementação deve utilizar uma biblioteca decimal ou tipo decimal
compatível com a persistência utilizada pelo projeto.

Conversões para `number` somente podem ocorrer em contextos de apresentação nos
quais não sejam realizados novos cálculos financeiros.

Valores recebidos ou enviados pela API devem utilizar representação textual
decimal quando necessário para preservar precisão, seguindo o padrão já
adotado pelo Meinager.

## 17. Ordem determinística de cálculo

O motor deve seguir esta ordem:

1. validar as entradas básicas;
2. calcular os componentes por quantidade;
3. calcular a mão de obra;
4. calcular ou aplicar o frete unitário;
5. formar o custo-base;
6. calcular o percentual de custos fixos;
7. somar as deduções de venda;
8. validar os divisores;
9. calcular o preço mínimo exato;
10. calcular o preço sugerido exato;
11. formar os preços comerciais;
12. analisar o preço adotado, quando informado;
13. gerar a decomposição;
14. produzir a memória de cálculo.

## 18. Resultado mínimo do motor

O resultado do motor deve conter, no mínimo:

```text
custo-base
componentes de custo
percentual de custos fixos
valor de custos fixos no preço
deduções individuais
total de deduções
margem desejada
preço mínimo exato
preço mínimo comercial
preço sugerido exato
preço sugerido comercial
preço adotado, quando informado
lucro estimado
margem efetiva
desconto máximo
avisos
versão da fórmula
```

## 19. Condições de erro

O motor deve rejeitar:

- valores negativos;
- faturamento médio igual a zero quando necessário;
- horas produtivas iguais a zero quando necessário;
- quantidade de rateio igual a zero quando necessário;
- deduções percentuais negativas;
- margem negativa;
- soma de custos fixos, deduções e margem igual ou superior a 100%;
- preço adotado negativo;
- valores decimais inválidos;
- valores não finitos;
- entradas pertencentes a outra organização.

A ausência de um componente opcional não deve ser considerada erro; seu valor
deve ser zero.

## 20. Versionamento da fórmula

Cada cálculo salvo deve registrar um identificador da versão da fórmula.

A primeira versão deverá utilizar um identificador equivalente a:

```text
margin-divisor-v1
```

Uma mudança que altere resultados para as mesmas entradas deve criar uma nova
versão da fórmula e não pode reinterpretar snapshots anteriores.
