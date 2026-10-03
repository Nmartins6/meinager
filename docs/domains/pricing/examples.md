# Exemplos canônicos de precificação

## 1. Finalidade

Este documento contém cenários matemáticos oficiais para validar o motor de
precificação do Meinager.

Os resultados devem ser reproduzidos pelos testes automatizados sem o uso de
aritmética binária de ponto flutuante como fonte de verdade.

Os preços comerciais são arredondados para cima até o próximo centavo,
conforme `calculation-specification.md`.

## 2. Convenções

Nos exemplos:

- percentuais são representados internamente como frações;
- valores exatos mantêm precisão além de duas casas;
- preços comerciais são expressos em reais com duas casas;
- pequenas diferenças na margem comercial podem ocorrer pelo arredondamento
  para cima;
- componentes ausentes possuem valor zero.

---

## EX-001 — Precificação simples

### Entradas

```text
Custo-base:                       R$ 50,00
Percentual de custos fixos:           10%
Imposto:                                6%
Taxa de pagamento:                      4%
Margem desejada:                       25%
```

### Percentuais internos

```text
PF = 0,10
PI = 0,06
PT = 0,04
DV = 0,10
ML = 0,25
```

### Preço mínimo

\[
D_{mínimo}
=

1-(0,10+0,10)
=

0,80
\]

\[
PMIN
=

\frac{50}{0,80}
=

62,50
\]

```text
Preço mínimo exato:       R$ 62,500000
Preço mínimo comercial:   R$ 62,50
```

### Preço sugerido

\[
D_{sugerido}
=

1-(0,10+0,10+0,25)
=

0,55
\]

\[
PSUG
=

\frac{50}{0,55}
=

90,909090909...
\]

```text
Preço sugerido exato:       R$ 90,909090909...
Preço sugerido comercial:   R$ 90,91
```

### Decomposição do preço comercial

```text
Preço comercial:             R$ 90,91
Custo-base:                   R$ 50,00
Cobertura de custos fixos:    R$  9,091
Imposto:                      R$  5,4546
Taxa de pagamento:            R$  3,6364
Total das deduções:           R$  9,091
Lucro estimado exato:         R$ 22,728
Lucro estimado exibido:       R$ 22,73
Margem efetiva aproximada:       25,0005499945...%
Margem efetiva exibida:          25,0005%
```

A margem efetiva é `22.728 / 90.91 = 0.250005499945...`.
O percentual exibido utiliza `ROUND_HALF_UP` com quatro casas decimais;
essa formatação não altera o lucro ou a margem usados no cálculo.

### Desconto máximo teórico

\[
1-\frac{62,50}{90,909090909...}
=

0,3125
\]

```text
Desconto máximo teórico: 31,25%
```

---

## EX-002 — Precificação completa

### Materiais

```text
Quantidade:        2
Custo unitário:    R$ 12,50
Total:             R$ 25,00
```

### Embalagem e perdas

```text
Embalagem:         R$ 2,00
Perdas estimadas:  R$ 1,50
```

### Mão de obra

```text
Custo mensal da mão de obra:  R$ 3.300,00
Horas produtivas mensais:             165
Tempo utilizado no produto:     90 minutos
```

\[
\text{CustoMDOHora}
=

\frac{3300}{165}
=

20
\]

\[
\text{CustoMDOMinuto}
=

\frac{20}{60}
=

0,333333333...
\]

\[
CMO
=

90 \times 0,333333333...
=

30
\]

```text
Custo por hora:       R$ 20,00
Custo por minuto:     R$ 0,333333333...
Custo de mão de obra: R$ 30,00
```

### Frete

```text
Frete total do lote:  R$ 120,00
Quantidade do lote:           40
```

\[
CFU
=

\frac{120}{40}
=

3
\]

```text
Frete unitário: R$ 3,00
```

### Custo-base

\[
CB
=

25+2+1,50+30+3
=

61,50
\]

```text
Materiais:        R$ 25,00
Embalagem:        R$  2,00
Perdas:           R$  1,50
Mão de obra:      R$ 30,00
Frete:            R$  3,00
Custo-base:       R$ 61,50
```

### Custos fixos

```text
Custo fixo mensal:        R$ 3.000,00
Faturamento mensal médio: R$ 15.000,00
```

\[
PF
=

\frac{3000}{15000}
=

0,20
\]

```text
Percentual de custos fixos: 20%
```

### Deduções e margem

```text
Imposto:                6,0%
Taxa de pagamento:      3,5%
Comissão:               2,0%
Total de deduções:     11,5%
Margem desejada:       25,0%
```

```text
PI = 0,06
PT = 0,035
PC = 0,02
DV = 0,115
ML = 0,25
```

### Preço mínimo

\[
D_{mínimo}
=

1-(0,20+0,115)
=

0,685
\]

\[
PMIN
=

\frac{61,50}{0,685}
=

89,781021897...
\]

```text
Preço mínimo exato:       R$ 89,781021897...
Preço mínimo comercial:   R$ 89,79
```

### Preço sugerido

\[
D_{sugerido}
=

1-(0,20+0,115+0,25)
=

0,435
\]

\[
PSUG
=

\frac{61,50}{0,435}
=

141,379310344...
\]

```text
Preço sugerido exato:       R$ 141,379310344...
Preço sugerido comercial:   R$ 141,38
```

### Decomposição do preço comercial

```text
Preço comercial:             R$ 141,38
Custo-base:                   R$  61,50
Cobertura de custos fixos:    R$  28,2760
Imposto:                      R$   8,4828
Taxa de pagamento:            R$   4,9483
Comissão:                     R$   2,8276
Total das deduções:           R$  16,2587
Lucro estimado:               R$  35,3453
Margem efetiva aproximada:        25,000212194...%
Margem efetiva exibida:           25,0002%
```

A margem efetiva é `35.3453 / 141.38 = 0.250002121940...`.
O percentual exibido utiliza `ROUND_HALF_UP` com quatro casas decimais;
o lucro exato permanece `35.3453`.

---

## EX-003 — Preço adotado abaixo do sugerido

Este cenário utiliza as entradas do `EX-002`.

### Entrada

```text
Preço adotado: R$ 120,00
```

### Decomposição

\[
DCF
=

120 \times 0,20
=

24
\]

\[
DDV
=

120 \times 0,115
=

13,80
\]

\[
LC
=

120-61,50-24-13,80
=

20,70
\]

\[
ME
=

\frac{20,70}{120}
=

0,1725
\]

```text
Preço mínimo comercial:      R$  89,79
Preço sugerido comercial:    R$ 141,38
Preço adotado:                R$ 120,00
Custos fixos:                 R$  24,00
Deduções:                     R$  13,80
Lucro estimado:               R$  20,70
Margem efetiva:                   17,25%
Classificação: Rentável, abaixo da margem desejada
```

---

## EX-004 — Preço adotado abaixo do mínimo

Este cenário utiliza as entradas do `EX-002`.

### Entrada

```text
Preço adotado: R$ 80,00
```

### Decomposição

\[
DCF
=

80 \times 0,20
=

16
\]

\[
DDV
=

80 \times 0,115
=

9,20
\]

\[
LC
=

80-61,50-16-9,20
=

-6,70
\]

\[
ME
=

\frac{-6,70}{80}
=

-0,08375
\]

```text
Preço mínimo comercial: R$ 89,79
Preço adotado:           R$ 80,00
Prejuízo estimado:       R$  6,70
Margem efetiva:             -8,375%
Classificação: Abaixo do preço mínimo
Aviso obrigatório: preço insuficiente para cobrir os custos
```

---

## EX-005 — Produto sem custos fixos nem deduções

### Entradas

```text
Custo-base:                  R$ 100,00
Percentual de custos fixos:          0%
Deduções de venda:                   0%
Margem desejada:                    20%
```

### Preço mínimo

\[
PMIN
=

\frac{100}{1}
=

100
\]

### Preço sugerido

\[
PSUG
=

\frac{100}{1-0,20}
=

125
\]

```text
Preço mínimo comercial:    R$ 100,00
Preço sugerido comercial:  R$ 125,00
Lucro estimado:            R$  25,00
Margem efetiva:                   20%
Desconto máximo:                  20%
```

---

## EX-006 — Soma de percentuais igual a 100%

### Entradas

```text
Custo-base:                 R$ 50,00
Custos fixos:                     10%
Deduções de venda:                20%
Margem desejada:                  70%
Soma:                            100%
```

\[
D_{sugerido}
=

1-(0,10+0,20+0,70)
=

0
\]

### Resultado esperado

```text
Cálculo válido: não
Preço sugerido: ausente
Código esperado: INVALID_PRICING_DIVISOR
Mensagem: A soma dos percentuais de custos, taxas e margem deve ser
menor que 100%. Revise os valores para calcular um preço válido.
```

---

## EX-007 — Soma de percentuais superior a 100%

### Entradas

```text
Custo-base:                 R$ 50,00
Custos fixos:                     30%
Deduções de venda:                25%
Margem desejada:                  50%
Soma:                            105%
```

\[
D_{sugerido}
=

1-1,05
=

-0,05
\]

### Resultado esperado

```text
Cálculo válido: não
Preço sugerido: ausente
Código esperado: INVALID_PRICING_DIVISOR
```

---

## EX-008 — Faturamento médio igual a zero

### Entradas

```text
Custo fixo mensal:         R$ 2.000,00
Faturamento mensal médio:  R$ 0,00
```

### Resultado esperado

```text
Cálculo válido: não
Percentual de custos fixos: ausente
Código esperado: INVALID_AVERAGE_REVENUE
Mensagem: O faturamento mensal médio deve ser maior que zero.
```

---

## EX-009 — Horas produtivas iguais a zero

### Entradas

```text
Custo mensal da mão de obra: R$ 3.300,00
Horas produtivas mensais:             0
```

### Resultado esperado

```text
Cálculo válido: não
Custo por hora: ausente
Custo por minuto: ausente
Código esperado: INVALID_PRODUCTIVE_HOURS
Mensagem: As horas produtivas mensais devem ser maiores que zero.
```

A validação somente é necessária quando o cálculo automático de mão de obra
estiver ativo.

---

## EX-010 — Quantidade de frete igual a zero

### Entradas

```text
Frete total:        R$ 120,00
Quantidade do lote:          0
```

### Resultado esperado

```text
Cálculo válido: não
Frete unitário: ausente
Código esperado: INVALID_FREIGHT_QUANTITY
Mensagem: A quantidade utilizada no rateio do frete deve ser maior que zero.
```

A validação somente é necessária quando o rateio de frete estiver ativo.

---

## EX-011 — Arredondamento para o próximo centavo

### Entradas

```text
Custo-base:                 R$ 1,00
Custos fixos:                    0%
Deduções:                        0%
Margem desejada:                33%
```

\[
PSUG
=

\frac{1}{1-0,33}
=

1,492537313...
\]

### Resultado esperado

```text
Preço sugerido exato:      R$ 1,492537313...
Preço sugerido comercial:  R$ 1,50
```

O preço não deve ser arredondado para `R$ 1,49`, pois esse valor produziria
margem efetiva inferior a 33%.

---

## EX-012 — Componentes opcionais ausentes

### Entradas

```text
Custo direto:        R$ 40,00
Materiais:           ausente
Embalagem:           ausente
Mão de obra:         ausente
Frete:               ausente
Terceirização:       ausente
Perdas:              ausente
Outros custos:       ausente
Custos fixos:        0%
Deduções:            0%
Margem desejada:     0%
```

### Resultado esperado

```text
Custo-base:                R$ 40,00
Preço mínimo comercial:    R$ 40,00
Preço sugerido comercial:  R$ 40,00
Lucro estimado:            R$  0,00
```

A ausência dos componentes opcionais não deve gerar erro.

---

## 3. Transformação em testes

Cada cenário deverá gerar pelo menos um teste automatizado.

Mapeamento inicial:

| Exemplo | Comportamento principal                 |
| ------- | --------------------------------------- |
| EX-001  | Precificação simples                    |
| EX-002  | Precificação completa                   |
| EX-003  | Preço adotado rentável abaixo da margem |
| EX-004  | Preço adotado abaixo do mínimo          |
| EX-005  | Cálculo sem custos fixos ou deduções    |
| EX-006  | Divisor igual a zero                    |
| EX-007  | Divisor negativo                        |
| EX-008  | Faturamento inválido                    |
| EX-009  | Horas produtivas inválidas              |
| EX-010  | Quantidade de frete inválida            |
| EX-011  | Arredondamento comercial                |
| EX-012  | Componentes opcionais                   |

Os testes devem comparar valores decimais, e não aproximações obtidas por
`number`.
