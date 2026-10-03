# ADR-002 — Representação monetária, precisão e arredondamento

- Status: aceito
- Data: 02/10/2026
- Domínio: precificação e financeiro
- Decisores: responsáveis pelo produto Meinager

## Contexto

O motor de precificação realiza somas, multiplicações e divisões envolvendo:

- dinheiro;
- quantidades fracionárias;
- tempo;
- custos unitários;
- percentuais;
- margens;
- divisores com dízimas;
- preços comerciais com duas casas decimais.

O tipo `number` do JavaScript utiliza ponto flutuante binário e pode produzir
resultados inadequados para cálculos financeiros, como:

```text
0.1 + 0.2 = 0.30000000000000004
```

Também é necessário diferenciar:

- precisão interna;
- precisão persistida;
- preço efetivamente adotado;
- formatação apresentada ao usuário.

Arredondar todos os valores para duas casas durante o cálculo acumularia erros
e poderia produzir preço abaixo do mínimo ou margem inferior à desejada.

## Decisão

Cálculos financeiros persistidos devem utilizar aritmética decimal.

O tipo `number` não poderá ser usado como fonte de verdade para:

- dinheiro;
- percentuais;
- margens;
- custos;
- preços;
- quantidades utilizadas em cálculos persistidos.

A implementação deverá usar uma biblioteca decimal explicitamente declarada
pelo projeto ou uma abstração decimal compatível com Prisma e PostgreSQL.

O motor de cálculo deve permanecer independente da interface.

## Representação na API

Dinheiro e percentuais devem ser transmitidos pela API como strings decimais
quando houver risco de perda de precisão.

Exemplos:

```json
{
  "baseCost": "61.500000",
  "fixedCostRate": "0.20000000",
  "desiredMargin": "0.25000000",
  "suggestedPrice": "141.380000"
}
```

O backend não deve aceitar como resultado autoritativo totais calculados pelo
frontend.

## Representação no banco de dados

Novos campos monetários do domínio de precificação devem suportar, no mínimo:

```text
19 dígitos totais
6 casas decimais
```

Novos campos percentuais devem suportar, no mínimo:

```text
12 dígitos totais
8 casas decimais
```

Campos que preservam resultados exatos de divisões poderão utilizar escala
superior quando necessário.

A definição final de cada coluna deverá considerar:

- intervalo possível;
- compatibilidade com o Prisma;
- operações realizadas;
- necessidade de histórico;
- comportamento dos campos monetários já existentes.

O preço comercial adotado continuará sendo expresso em centavos, mas o cálculo
que o originou deverá preservar maior precisão.

## Precisão intermediária

O motor deve manter precisão suficiente durante toda a execução.

Requisitos mínimos:

- valores monetários intermediários: 6 casas decimais;
- percentuais: 8 casas decimais;
- divisões: precisão adicional suficiente para formar corretamente o preço
  comercial.

Nenhum valor intermediário deve ser reduzido para duas casas antes da formação
do preço comercial.

## Modos de arredondamento

### Valores monetários informativos

Valores como custos, deduções, lucro e decomposição exibidos ao usuário devem
utilizar arredondamento decimal `half-up` para duas casas.

### Preço mínimo

O preço mínimo comercial deve ser arredondado para cima até o próximo centavo.

Esse comportamento impede que o preço comercial fique abaixo do valor exato
necessário para cobrir os custos.

### Preço sugerido

O preço sugerido comercial deve ser arredondado para cima até o próximo
centavo.

Esse comportamento impede que o preço comercial fique abaixo da margem
desejada em razão do arredondamento.

### Preço adotado

O preço adotado deve possuir duas casas decimais.

Depois de sua definição, lucro, margem efetiva, custos fixos e deduções devem
ser recalculados utilizando esse preço.

## Ordem do arredondamento

A ordem obrigatória é:

1. validar as entradas;
2. executar todos os cálculos com precisão decimal;
3. obter os preços exatos;
4. formar os preços comerciais;
5. escolher ou receber o preço adotado;
6. recalcular a decomposição com o preço adotado;
7. arredondar valores informativos para apresentação.

## Reconciliação visual

O resultado exato é a fonte de verdade.

Ao arredondar separadamente os componentes exibidos, poderá surgir diferença
de um centavo entre:

- preço apresentado;
- soma visual dos componentes apresentados.

Quando essa diferença ocorrer e a interface precisar fechar visualmente o
total, deverá ser apresentada uma linha identificada como:

```text
Ajuste de arredondamento
```

O ajuste é apenas de apresentação e não altera o resultado exato ou o snapshot
do cálculo.

## Comparações

Comparações entre valores monetários devem utilizar valores decimais
normalizados.

Não devem ser utilizadas comparações aproximadas baseadas em tolerância de
ponto flutuante para decidir se um preço:

- está abaixo do mínimo;
- atingiu a margem;
- é igual ao preço sugerido;
- produz prejuízo.

A classificação comercial deve considerar os valores monetários efetivamente
adotados.

## Moeda

A primeira versão do domínio utilizará BRL como moeda operacional.

Os dados e contratos devem evitar nomes que impeçam suporte futuro a outras
moedas.

Snapshots deverão preservar o código da moeda utilizada, mesmo que inicialmente
o único valor permitido seja:

```text
BRL
```

## Testes obrigatórios

Os testes devem cobrir:

- `0.1 + 0.2` sem erro binário;
- quantidades fracionárias;
- custo por minuto com dízima;
- divisor com dízima;
- preço exato com mais de duas casas;
- arredondamento do mínimo para cima;
- arredondamento do sugerido para cima;
- margem efetiva após arredondamento;
- preço adotado abaixo do mínimo;
- valores nos limites das escalas persistidas.

Os testes devem comparar valores decimais normalizados ou suas representações
textuais.

## Consequências positivas

- Resultados financeiros determinísticos.
- Compatibilidade entre backend, banco e testes.
- Redução do risco de vender abaixo do mínimo por arredondamento.
- Memória de cálculo reproduzível.
- Possibilidade de auditar diferenças de centavos.

## Consequências e custos

- Será necessário converter dados nas fronteiras da API.
- A interface deverá formatar strings decimais.
- Desenvolvedores não poderão aplicar operadores aritméticos comuns diretamente
  sobre os valores.
- A biblioteca decimal deverá ser dependência explícita e atualizada.
- Testes deverão evitar conversões desnecessárias para `number`.

## Compatibilidade com dados existentes

A implementação deverá inspecionar os campos monetários atuais antes de criar
migrations.

Nenhum campo existente deve ter sua escala reduzida.

Alterações de escala deverão:

1. preservar os dados existentes;
2. possuir migration explícita;
3. ser testadas em banco com dados;
4. não modificar valores históricos silenciosamente.
