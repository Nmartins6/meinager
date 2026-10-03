# ADR-005 — Representação decimal do motor puro de precificação

- Status: aceito para o Marco 1
- Data: 02/10/2026
- Domínio: precificação
- Decisores: implementação técnica no escopo autorizado do Marco 1

## Contexto

A ADR-002 exige aritmética decimal, mas deixa biblioteca, precisão interna e
contratos concretos para a implementação. Importar o cliente Prisma traria
dependências de persistência ao motor puro. Centavos inteiros, isoladamente,
não representam custos fracionários nem divisões periódicas.

`decimal.js` 10.6.0 já estava no lockfile transitivamente. A versão possui
export ESM e tipos TypeScript, conforme seu `package.json` e `decimal.d.ts`.
A tarefa autoriza declará-la diretamente na API e usar clone local.

## Decisão

- Declarar `decimal.js` 10.6.0 como dependência direta de `@meinager/api`.
- Usar um clone novo e privado por execução, com `defaults: true`, precisão
  de **160 dígitos significativos** e `ROUND_HALF_UP` explícito. Não chamar
  `Decimal.set` ou expor instâncias decimais nos resultados. Configurações
  globais alteradas por outros módulos não afetam o motor.
- Receber e devolver dinheiro, taxas, quantidades e tempo como strings.
  Taxas são frações (`0.06` representa 6%). Aceitar somente notação decimal
  com ponto, sem expoentes, espaços, vírgulas, NaN ou Infinity. Normalizar
  zeros e casas finais; saídas exatas usam texto sem expoentes.
- Limites técnicos de entrada: valores/quantidades/tempo com até 13 dígitos
  inteiros e 6 casas; taxas com até 4 dígitos inteiros e 8 casas; preço adotado
  com até 13 dígitos inteiros e 2 casas. Esses limites cobrem os mínimos
  `(19, 6)` e `(12, 8)` da ADR-002 e o catálogo atual. Não são uma escolha de
  novas colunas nem uma autorização de adoção no produto. Excesso de precisão
  é rejeitado como `INVALID_DECIMAL_VALUE`, sem truncamento.
- Valores de entrada negativos retornam `NEGATIVE_VALUE` com campo.
  Negativos de saída, como prejuízo, são válidos. A primeira moeda é BRL;
  moeda diferente retorna erro tipado `UNSUPPORTED_CURRENCY`.
- Manter numeradores e denominadores finitos de mão de obra, frete e custos
  fixos até formar preços e lucro. Essa avaliação algebricamente equivalente
  evita que uma divisão periódica intermediária altere um centavo exato.
  Totais de componentes não são arredondados antes de somar.
- Campos `exact` preservam a precisão de trabalho; dízimas são aproximações
  decimais determinísticas de 160 dígitos significativos, não expansões
  infinitas. A soma de componentes finitos e os produtos dos denominadores
  dentro dos limites de entrada cabem com folga nessa precisão. Testes
  incluem limites monetários, divisores pequenos e cancelamento de dízimas.
- Campos monetários `display` usam duas casas e `ROUND_HALF_UP`, sem voltar
  ao cálculo; preços `commercial` usam duas casas e `ROUND_CEIL`. Decomposição
  e margem usam o preço adotado ou, quando ausente, o sugerido comercial.
- Classificar o preço por comparação decimal com mínimo/sugerido comerciais,
  conforme a especificação. No mínimo comercial, a classificação é
  `COST_COVERAGE`, mesmo que arredondar para cima deixe lucro residual.
  O cálculo de lucro continua independente dessa classificação.
- Desconto máximo é **teórico**, calculado dos preços exatos, como EX-001.
  Cancelar algebricamente o custo-base evita artefatos da divisão entre
  dízimas. A futura validação promocional deve analisar o preço final.
- Margem efetiva com preço zero e desconto com sugerido zero são `null`.
  Preço adotado ausente também é `null`, sem adoção implícita do sugerido.
- Preservar a ordem dos arrays de componentes/deduções e copiar os dados
  utilizados para o resultado, sem mutar entradas ou consultar cadastros.
  Parâmetros opcionais ausentes são zero; campos inválidos presentes não são
  tratados como ausência. Margem desejada é obrigatória, sem padrão comercial.
- Custo fixo pode entrar como percentual já consolidado (`RATE`, como EX-001)
  ou valores mensais (`MONTHLY`, como EX-002). Ambos usam exclusivamente
  incidência percentual sobre receita, conforme ADR-001. Frete manual e
  rateado são alternativas; consumo omitido no rateio significa uma unidade.

## Precisão e intervalo na persistência futura

Resultados exatos do motor podem ultrapassar a escala e o intervalo de
`Decimal(19,6)`, assim como o limite atual de `Product.salePrice`
(`Decimal(14,2)` em `apps/api/prisma/schema.prisma`). Os limites de entrada
do motor não garantem que os resultados caibam nesses campos; divisores
próximos de zero podem gerar preços com magnitude elevada.

O Marco 2 deverá definir precisão e representação por campo persistido,
considerando valores exatos, aproximações periódicas e preços comerciais.
É proibido truncar silenciosamente resultados para acomodá-los no banco.
Qualquer conversão de precisão deve ser explícita e seguir as regras de
arredondamento aplicáveis. A adoção do preço deverá validar o intervalo
suportado pelo campo de destino antes de gravá-lo, rejeitando valores fora
desse intervalo sem alterar silenciosamente o preço.

## Limites de responsabilidade

O motor não contém autorização, organização, configuração persistente,
vigência, relógio, perfis persistidos, adoção de produto ou snapshots salvos.
IDs de insumos são dados opacos de rastreabilidade; validação de posse/origem
e auditoria pertencem à camada de aplicação dos marcos seguintes. Tempo já
entra em minutos; conversão de campos de horas/minutos da interface é futura.

Esta decisão não define leitura de custos, retenção, migrations, política de
preço manual ou compartilhamento com a web. Não altera as fórmulas oficiais.

## Validação

`apps/api/src/pricing/calculator/pricing-calculator.spec.ts` cobre EX-001 a
EX-012 e casos adicionais de precisão, arredondamento, ausência tipada,
entradas inválidas, ordem, independência da configuração global e memória
de cálculo sem referências mutáveis às entradas.
