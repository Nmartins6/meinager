# ADR-007 — Contrato e segurança da API de precificação

## Status

Aceita como direção para o Marco 3.

## Contexto

O motor puro `margin-divisor-v1` e o modelo de persistência definido na
[ADR-006](./ADR-006-pricing-persistence-model.md) estabelecem as regras
matemáticas, o histórico imutável e os guards do banco. Esta ADR define a
fronteira HTTP que coordenará configuração, perfis, composições, simulações,
versões e adoções sem confiar em resultados enviados pelo cliente nem expor
custos internos.

A API existente usa o prefixo global `/api`, autenticação por sessão,
`@OrganizationRoles(...)` com `OrganizationRolesGuard`, DTOs validados por `ValidationPipe` com
`whitelist`, `forbidNonWhitelisted` e `transform`, respostas diretas ou listas
com `{ data, pagination }`, transações Prisma e `AuditLog` gravado na mesma
transação da mutação. Os serviços usam locks explícitos `FOR UPDATE` quando a
operação exige serialização e convertem conflitos conhecidos em exceções HTTP.

Os endpoints atuais de produtos retornam `directCost` a qualquer usuário
autenticado. O Marco 3 restringirá explicitamente esse contrato: `OWNER`,
`ADMIN`, `OPERATIONS` e `FINANCE` continuam recebendo o campo; `VIEWER` não o
recebe. Essa alteração de compatibilidade é intencional, usa selects separados
no backend e exige testes próprios de não vazamento.

## Decisão

### Princípios da fronteira HTTP

1. `organizationId` e o usuário autor sempre vêm da sessão autenticada. Nenhum
   DTO de precificação aceitará esses campos.
2. O cliente envia somente intenções e entradas editáveis. Snapshot, resultados,
   totais, classificações, margens, números de versão e origens resolvidas são
   calculados ou carregados pelo backend.
3. Toda leitura consulta por `organizationId` junto com o identificador do
   recurso. Um identificador válido de outra organização produz o mesmo `404`
   de um identificador inexistente.
4. Contratos comerciais e contratos internos são separados. Respostas
   comerciais não incluem custo, lucro, margem, deduções, decomposição,
   snapshot nem identificadores internos de versões.
5. Decimais entram e saem como strings canônicas. `number`, `NaN`, `Infinity`,
   notação exponencial e truncamento silencioso são rejeitados.
6. Respostas de leitura histórica vêm do snapshot congelado. Elas não
   recalculam versões com os dados atuais.
7. O backend valida a versão do snapshot e da fórmula antes de ler detalhes
   internos, comparar ou adotar uma versão.

Totais, custo-base, preços mínimo e sugerido, lucro, margem efetiva,
classificação, valores individuais calculados das deduções, snapshot final e
número de versão não são ignorados silenciosamente: não pertencem aos DTOs e o
`ValidationPipe` rejeita sua presença.

### Endpoints iniciais

Todos os caminhos abaixo recebem o prefixo global `/api`.

| Método  | Caminho                                            | Entrada do cliente                                     | Resposta                                             | Status |
| ------- | -------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ------ |
| `GET`   | `/pricing/products/:productId/summary`             | parâmetro `productId`                                  | projeção comercial do preço atual                    | `200`  |
| `GET`   | `/pricing/configuration`                           | nenhuma                                                | configuração e revisão atuais                        | `200`  |
| `PATCH` | `/pricing/configuration`                           | campos editáveis, origens e `expectedRevision`         | configuração e nova revisão                          | `200`  |
| `GET`   | `/pricing/profiles`                                | `page`, `pageSize`, filtros de estado                  | `{ data, pagination }`, sem snapshots                | `200`  |
| `GET`   | `/pricing/profiles/:profileId`                     | parâmetro `profileId`                                  | perfil, revisão e deduções ordenadas                 | `200`  |
| `POST`  | `/pricing/profiles`                                | nome, parâmetros, deduções e origens                   | perfil e revisão inicial                             | `201`  |
| `PATCH` | `/pricing/profiles/:profileId`                     | campos editáveis, deduções e `expectedRevision`        | perfil e nova revisão                                | `200`  |
| `POST`  | `/pricing/profiles/:profileId/deactivate`          | `expectedRevision`                                     | perfil desativado                                    | `200`  |
| `GET`   | `/pricing/products/:productId/composition`         | parâmetro `productId`                                  | composição, revisão e componentes ordenados          | `200`  |
| `PUT`   | `/pricing/products/:productId/composition`         | composição completa e `expectedRevision`               | composição e nova revisão                            | `200`  |
| `POST`  | `/pricing/products/:productId/simulations`         | fonte persistida ou rascunho; `adoptedPrice` opcional  | resultado completo, sem persistência                 | `200`  |
| `POST`  | `/pricing/products/:productId/versions`            | `expectedCompositionRevision`; `adoptedPrice` opcional | versão finalizada e projeções                        | `201`  |
| `GET`   | `/pricing/products/:productId/versions`            | `page`, `pageSize`                                     | `{ data, pagination }`; cada item inclui `isAdopted` | `200`  |
| `GET`   | `/pricing/products/:productId/versions/:versionId` | parâmetros `productId` e `versionId`                   | versão com `isAdopted`, snapshot e projeções         | `200`  |
| `POST`  | `/pricing/products/:productId/adoptions`           | `versionId`, confirmação e justificativa condicionais  | produto e adoção efetiva                             | `200`  |
| `PATCH` | `/products/:productId`                             | DTO atual; `salePrice` explícito indica preço manual   | produto atualizado, sem ponteiro interno             | `200`  |

`PUT` é usado para composição porque o comando substitui a coleção ordenada
completa. Configuração e perfil usam `PATCH` porque criam uma revisão a partir
de um agregado existente e aceitam somente os campos editáveis. Simulação usa
`POST` por ser um comando de cálculo, embora não persista estado.

O resumo comercial contém apenas `productId`, `currency`, `salePrice`,
`priceOrigin` (`MANUAL` ou `PRICING_VERSION`) e `hasComposition`. Ele não
expõe o snapshot ou o identificador da versão adotada. A listagem de versões
segue a convenção `{ data, pagination }` já usada pela API.

#### Extensão interna implementada no Marco 4D.1

Em 10/10/2026, a revisão humana aprovou acrescentar `isAdopted: boolean` às
respostas internas de listagem e detalhe de versões. O backend calcula o campo
no momento da consulta; ele é `true` somente quando
`Product.adoptedPricingVersionId === version.id`. Se o preço atual for manual,
todas as versões retornam `false`.

O campo não é recebido do cliente, não é persistido e não exige schema ou
migration. Ele não altera snapshot, projeções ou versões históricas. Os dados
históricos da versão continuam imutáveis; `isAdopted` é uma projeção comercial
dinâmica do estado atual do produto. A consulta deve manter os filtros de
organização e produto.

Essa extensão existe somente nos contratos internos de versões. `VIEWER`
continua sem acesso a ambos os endpoints, e o resumo comercial continua sem
`versionId` ou snapshot. O Marco 4D.1 a implementou em 22/10/2026 por projeção
relacional do ponteiro junto com cada versão, sem consulta adicional por item,
escrita ou auditoria. Testes unitários e E2E cobrem adoções sucessivas e a
limpeza do ponteiro pelo preço manual. A interface de histórico permanece
pendente.

A adoção abaixo do mínimo usa o mesmo endpoint de adoção. Ela é uma condição
do comando, com autorização, confirmação e justificativa adicionais, e não um
endpoint paralelo que pudesse divergir do fluxo normal. Consultar configuração
ausente retorna `PRICING_CONFIGURATION_NOT_FOUND`; tentar calcular sem a
configuração necessária retorna `PRICING_CONFIGURATION_REQUIRED`.

### Matriz de autorização

`OWNER`, `ADMIN`, `OPERATIONS`, `FINANCE` e `VIEWER` continuam sujeitos à
autenticação de sessão. A tabela define autorização adicional.

| Operação                                                                | OWNER | ADMIN | OPERATIONS | FINANCE | VIEWER |
| ----------------------------------------------------------------------- | ----- | ----- | ---------- | ------- | ------ |
| consultar resumo comercial                                              | sim   | sim   | sim        | sim     | sim    |
| consultar `Product.directCost` nos contratos legados                    | sim   | sim   | sim        | sim     | não    |
| consultar custos, configuração, perfis, composição, versões e snapshots | sim   | sim   | sim        | sim     | não    |
| alterar configuração ou perfis                                          | sim   | sim   | não        | não     | não    |
| alterar composição                                                      | sim   | sim   | sim        | não     | não    |
| simular ou criar versão                                                 | sim   | sim   | sim        | não     | não    |
| adotar preço igual ou superior ao mínimo                                | sim   | sim   | sim        | não     | não    |
| adotar preço abaixo do mínimo                                           | sim   | sim   | não        | não     | não    |
| informar `salePrice` manualmente no `PATCH` de produto                  | sim   | sim   | não        | não     | não    |

O papel `FINANCE` pode inspecionar os parâmetros e resultados internos para
conferência, mas não executa novos cálculos nem altera o estado. A autorização
da adoção abaixo do mínimo é verificada pelo backend depois do recálculo; não
depende de classificação enviada pelo cliente.

### Autoridade do backend por mutação

#### Configuração

O DTO aceita as entradas configuráveis, suas origens e `expectedRevision`.
Na criação inicial, `expectedRevision` é `null`; nas alterações, deve coincidir
com a revisão atual. O serviço trava a raiz existente ou a organização na
criação, recarrega o estado, valida os valores, cria uma revisão imutável,
move o ponteiro atual e grava auditoria na mesma transação.

#### Perfis e deduções

O DTO aceita nome, deduções ordenadas, origens e `expectedRevision`. Valores
calculados de dedução não são aceitos. O serviço
trava a raiz do perfil, valida unicidade e revisão, cria a revisão e suas
deduções, move o ponteiro e audita a mudança. Desativação preserva revisões e
versões históricas.

#### Composição

O DTO aceita `expectedRevision`, perfil, campos de mão de obra/frete e a lista
ordenada completa de componentes. Para `MANUAL` e `COPIED`, o cliente envia
`storedUnitCost`; para `CATALOG`, envia `sourceProductId` e não pode enviar
`storedUnitCost`.

O backend valida os identificadores, trava o perfil selecionado e depois o
produto, verifica a revisão e recarrega perfil, produto e produtos-fonte na
mesma organização. Então resolve `effectiveUnitCost`. Em
`CATALOG`, o valor vem do `Product.directCost` atual e nunca de um cache do
cliente. A troca inteira incrementa a revisão uma única vez e gera auditoria.

#### Simulação

O cliente pode escolher a composição persistida ou enviar um rascunho com os
mesmos campos editáveis da composição. Pode também informar `adoptedPrice`
para analisar um preço específico. O backend carrega configuração, perfil,
produto e fontes em uma visão consistente, resolve custos e origens, constrói
a entrada e chama o motor puro. Campos de resultado adicionais são rejeitados
pelo DTO. A simulação não persiste versão e não gera auditoria.

#### Criação de versão

O comando aceita `expectedCompositionRevision` e, opcionalmente,
`adoptedPrice`. O backend trava configuração, perfil e produto na ordem
definida nesta ADR, recarrega a composição persistida e todas as revisões
referenciadas, resolve os custos, executa o motor e cria o snapshot oficial,
as projeções relacionais e a versão numerada. A versão só é retornada depois
de `FINALIZED`. O cliente não pode definir número, estado, fórmula, snapshot,
resultados ou projeções.

#### Adoção

O comando aceita somente `versionId`, `belowMinimumConfirmed` e, quando
exigido, `justification`. O backend carrega uma versão `FINALIZED` da mesma
organização e produto, valida o snapshot, reconstrói a entrada congelada,
executa novamente o motor e confere snapshot e projeções. O `newPrice` é
obrigatoriamente o `analyzedPrice` dessa versão.

Se o preço estiver abaixo do mínimo, somente `OWNER` ou `ADMIN` podem seguir;
`belowMinimumConfirmed` deve ser `true` e a justificativa não vazia é
obrigatória. O serviço valida o intervalo de `Product.salePrice` antes de
persistir, atualiza preço e ponteiro, cria `PricingPriceAdoption` e grava
auditoria na mesma transação.

Uma versão existente só é reutilizada quando seu `analyzedPrice` é exatamente
o preço adotado. Outros preços, inclusive um `suggestedPriceCommercial`
diferente de `analyzedPrice`, exigem novo cálculo e nova versão. A versão
anterior nunca é modificada.

#### Alteração manual do preço do produto

O `PATCH /products/:productId` atual continua sendo a fronteira para preço
manual. Quando `salePrice` estiver explicitamente presente, inclusive se for
igual ao valor anterior ou `null`, o serviço deve travar o produto, validar o
intervalo, limpar `adoptedPricingVersionId` e auditar a alteração manual.
Quando o campo estiver ausente, preço e ponteiro são preservados.

Somente `OWNER` e `ADMIN` podem enviar `salePrice` explicitamente.
`OPERATIONS` continua autorizado a alterar os demais campos permitidos do
produto e a adotar versões com preço igual ou superior ao mínimo, mas não pode
definir preço manual. Essa restrição altera intencionalmente a compatibilidade
do `PATCH` atual e terá testes próprios de papéis, omissão, `null`, valor igual
ao atual e limpeza do ponteiro no Marco 3D.

### Snapshot oficial v1

`PricingCalculationVersion.snapshot` usa um documento JSON canônico e tipado.
O tipo de aplicação será `PricingSnapshotV1` e terá esta forma lógica:

```ts
type PricingMoneySnapshotV1 = {
  exact: DecimalString;
  display: DecimalString;
};

type PricingPriceSnapshotV1 = {
  exact: DecimalString;
  commercial: DecimalString;
};

type PricingComponentInputSnapshotV1 = {
  position: number;
  description: string;
  category: PricingComponentCategory;
  unit: string;
  quantity: DecimalString;
  unitCost: DecimalString;
  origin: 'MANUAL' | 'COPIED' | 'CATALOG';
  productId: string | null;
};

type PricingDeductionInputSnapshotV1 = {
  position: number;
  name: string;
  category: string;
  rate: DecimalString;
  origin: PricingParameterOrigin;
};

type PricingLaborInputSnapshotV1 = {
  monthlyCost: DecimalString;
  productiveHours: DecimalString;
  timeMinutes: DecimalString;
};

type PricingFreightInputSnapshotV1 =
  | { mode: 'MANUAL'; unitCost: DecimalString }
  | {
      mode: 'ALLOCATED';
      totalCost: DecimalString;
      quantity: DecimalString;
      consumedQuantity: DecimalString | null;
    };

type PricingFreightResultSnapshotV1 =
  | {
      mode: 'MANUAL';
      unitCost: DecimalString;
      costPerLotUnit: PricingMoneySnapshotV1;
      total: PricingMoneySnapshotV1;
    }
  | {
      mode: 'ALLOCATED';
      totalCost: DecimalString;
      quantity: DecimalString;
      consumedQuantity: DecimalString;
      costPerLotUnit: PricingMoneySnapshotV1;
      total: PricingMoneySnapshotV1;
    };

type PricingFixedCostsInputSnapshotV1 =
  | {
      mode: 'RATE';
      rate: DecimalString;
      origin: PricingParameterOrigin;
    }
  | {
      mode: 'MONTHLY';
      monthlyCost: DecimalString;
      averageRevenue: DecimalString;
      origin: PricingParameterOrigin;
    };

type PricingCalculatorInputSnapshotV1 = {
  currency: 'BRL';
  components: PricingComponentInputSnapshotV1[];
  labor: PricingLaborInputSnapshotV1 | null;
  freight: PricingFreightInputSnapshotV1 | null;
  fixedCosts: PricingFixedCostsInputSnapshotV1 | null;
  deductions: PricingDeductionInputSnapshotV1[];
  desiredMargin: DecimalString;
  adoptedPrice: DecimalString | null;
};

type PricingCalculatorResultSnapshotV1 = {
  formulaVersion: 'margin-divisor-v1';
  currency: 'BRL';
  components: Array<PricingComponentInputSnapshotV1 & { total: PricingMoneySnapshotV1 }>;
  labor:
    | (PricingLaborInputSnapshotV1 & {
        costPerHour: PricingMoneySnapshotV1;
        costPerMinute: PricingMoneySnapshotV1;
        total: PricingMoneySnapshotV1;
      })
    | null;
  freight: PricingFreightResultSnapshotV1 | null;
  fixedCosts: {
    input: PricingFixedCostsInputSnapshotV1 | null;
    rate: DecimalString;
  };
  deductions: PricingDeductionInputSnapshotV1[];
  totalDeductionRate: DecimalString;
  desiredMargin: DecimalString;
  baseCost: PricingMoneySnapshotV1;
  minimumPrice: PricingPriceSnapshotV1;
  suggestedPrice: PricingPriceSnapshotV1;
  adoptedPrice: DecimalString | null;
  analysis: {
    price: DecimalString;
    fixedCosts: PricingMoneySnapshotV1;
    deductions: Array<PricingDeductionInputSnapshotV1 & { amount: PricingMoneySnapshotV1 }>;
    totalDeductions: PricingMoneySnapshotV1;
    profit: PricingMoneySnapshotV1;
    effectiveMargin: DecimalString | null;
    differenceFromSuggestedExact: PricingMoneySnapshotV1;
    classification: PricingClassification;
  };
  maximumDiscountRate: DecimalString | null;
  warnings: Array<{
    code: 'BELOW_MINIMUM' | 'BELOW_DESIRED_MARGIN';
    message: string;
  }>;
};

type PricingProvenanceDetailsV1 = {
  source: string | null;
  referenceId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  criterion: string | null;
  measuredAt: string | null;
  confirmedByUserId: string | null;
};

type PricingParameterNameV1 =
  | 'fixedCostMode'
  | 'fixedCostRate'
  | 'monthlyFixedCost'
  | 'averageMonthlyRevenue'
  | 'monthlyLaborCost'
  | 'productiveHours'
  | 'defaultDesiredMargin'
  | 'desiredMargin'
  | 'laborEnabled'
  | 'timeMinutes'
  | 'freightMode'
  | 'freightUnitCost'
  | 'freightTotalCost'
  | 'freightQuantity'
  | 'freightConsumedQuantity';

type PricingParameterProvenanceV1 = PricingProvenanceDetailsV1 & {
  schemaVersion: 1;
  parameter: PricingParameterNameV1;
  origin: PricingParameterOrigin;
};

type PricingComponentProvenanceV1 = PricingProvenanceDetailsV1 & {
  schemaVersion: 1;
  position: number;
  origin: 'MANUAL' | 'COPIED' | 'CATALOG';
  sourceProductId: string | null;
  effectiveUnitCost: DecimalString;
};

type PricingDeductionProvenanceV1 = PricingProvenanceDetailsV1 & {
  schemaVersion: 1;
  position: number;
  origin: PricingParameterOrigin;
};

type PricingSnapshotV1 = {
  snapshotSchemaVersion: 1;
  formulaVersion: 'margin-divisor-v1';
  input: PricingCalculatorInputSnapshotV1;
  result: PricingCalculatorResultSnapshotV1;
  context: {
    organizationId: string;
    product: { id: string; type: string; name: string; unit: string };
    composition: {
      id: string;
      revision: number;
      parameterOrigins: PricingParameterProvenanceV1[];
    };
    configuration: {
      id: string;
      revisionId: string;
      revision: number;
      effectiveFrom: string;
      currency: 'BRL';
      fixedCosts:
        | { mode: 'RATE'; rate: DecimalString }
        | {
            mode: 'MONTHLY';
            monthlyCost: DecimalString;
            averageRevenue: DecimalString;
          }
        | null;
      monthlyLaborCost: DecimalString | null;
      productiveHours: DecimalString | null;
      defaultDesiredMargin: DecimalString | null;
      parameterOrigins: PricingParameterProvenanceV1[];
    };
    salesProfile: {
      id: string;
      revisionId: string;
      revision: number;
      name: string;
    } | null;
    effectiveDesiredMargin: {
      value: DecimalString;
      origin: PricingParameterOrigin;
      precedence: 'COMPOSITION' | 'CONFIGURATION';
    };
    componentOrigins: PricingComponentProvenanceV1[];
    deductionOrigins: PricingDeductionProvenanceV1[];
    calculatedAt: string;
    calculatedByUserId: string;
    decimalPolicy: {
      library: 'decimal.js';
      precision: 160;
      commercialRounding: 'ROUND_CEIL';
      informationalRounding: 'ROUND_HALF_UP';
    };
  };
};
```

`PricingCalculatorResultSnapshotV1` é o contrato persistido, independente das
opcionalidades convenientes de `PricingCalculatorResult` em memória. Ele é uma
serialização canônica e sem perda do retorno do motor, incluindo entradas
normalizadas, totais exatos, preços comerciais, análise, classificação, limite
de desconto e avisos. Toda propriedade opcional do contrato em memória é
materializada como `null` no snapshot.

Em `input.freight`, `consumedQuantity: null` preserva que o valor não foi
informado. Durante replay, o adaptador converte esse `null` em propriedade
omitida antes de chamar o motor. O motor então aplica seu padrão `"1"`, e
`result.freight` no modo `ALLOCATED` sempre persiste `consumedQuantity` como
`DecimalString` obrigatório e normalizado.

Os tipos de proveniência v1 são validados e não aceitam objetos JSON livres.
Eles comportam origem, fonte, referência, período inicial/final, critério, data
da apuração e usuário confirmador quando aplicáveis. Campos não aplicáveis são
`null`. `effectiveDesiredMargin` registra separadamente o valor selecionado,
sua origem e a precedência `COMPOSITION` ou `CONFIGURATION`; a margem efetiva do
preço analisado continua em `result.analysis.effectiveMargin`.

Regras de canonicalização:

- todo decimal é string simples, sem expoente ou sinal positivo; entradas e
  resultados exatos eliminam zeros insignificantes, com zero como `"0"`,
  enquanto valores `display` e preços `commercial` preservam exatamente duas
  casas conforme o retorno do motor;
- campos opcionais aparecem como `null`, e não são omitidos;
- posições de componentes e deduções começam em `1`, são inteiras, positivas e
  contíguas até o tamanho da coleção; não há posições duplicadas;
- proveniências de parâmetros são ordenadas por `parameter`; proveniências de
  componentes e deduções seguem `position` crescente;
- cada proveniência de componente e dedução corresponde exatamente a um item de
  mesma posição na respectiva coleção, sem registros ausentes ou excedentes;
- cada coleção `parameterOrigins` aceita somente nomes de
  `PricingParameterNameV1`, sem parâmetros duplicados;
- UUIDs são minúsculos e timestamps usam ISO 8601 em UTC;
- `snapshotSchemaVersion`, `formulaVersion` e
  `result.formulaVersion` devem coincidir com as colunas da versão;
- o futuro validador de runtime aplica a união fechada
  `PricingParameterNameV1`, posições e correspondências acima antes de persistir,
  ler detalhes ou adotar; versões desconhecidas falham de forma explícita;
- as projeções relacionais são derivadas do mesmo objeto na mesma transação e
  nunca são aceitas do cliente.

O snapshot híbrido mantém no JSON tudo que reproduz o cálculo e usa as tabelas
de projeção para consulta e integridade. Leituras históricas devolvem o JSON
congelado; o contexto atual serve somente para novas execuções.

### Contrato de erros

Erros esperados usam a forma:

```json
{
  "statusCode": 409,
  "code": "PRICING_REVISION_CONFLICT",
  "message": "A revisão de precificação foi alterada.",
  "field": "expectedRevision",
  "details": { "expectedRevision": 3, "currentRevision": 4 }
}
```

`field` e `details` são opcionais. `details` nunca contém custos, snapshot,
SQL, stack, dados de outra organização ou valores não autorizados. O log
interno recebe o erro original e um identificador de correlação.

| HTTP  | Códigos estáveis                                                                                                                                                                                                                                    | Uso                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `400` | `VALIDATION_ERROR`, `INVALID_DECIMAL_VALUE`, `NEGATIVE_VALUE`, `INVALID_PRICING_DIVISOR`, `INVALID_AVERAGE_REVENUE`, `INVALID_PRODUCTIVE_HOURS`, `INVALID_FREIGHT_QUANTITY`, `UNSUPPORTED_CURRENCY`, `JUSTIFICATION_REQUIRED`, `PRICE_OUT_OF_RANGE` | DTO, motor ou limite do campo de destino inválido        |
| `401` | `AUTHENTICATION_REQUIRED`                                                                                                                                                                                                                           | sessão ausente ou inválida                               |
| `403` | `PRICING_FORBIDDEN`, `BELOW_MINIMUM_FORBIDDEN`                                                                                                                                                                                                      | papel sem permissão ou adoção excepcional não autorizada |
| `404` | `PRODUCT_NOT_FOUND`, `PRICING_CONFIGURATION_NOT_FOUND`, `PRICING_PROFILE_NOT_FOUND`, `PRICING_COMPOSITION_NOT_FOUND`, `PRICING_VERSION_NOT_FOUND`                                                                                                   | recurso inexistente, inclusive de outra organização      |
| `409` | `PRICING_CONFIGURATION_REQUIRED`, `PRICING_PROFILE_INACTIVE`, `PRICING_REVISION_CONFLICT`, `PRICING_VERSION_NOT_FINALIZED`, `PRICING_CONCURRENT_MODIFICATION`, `PRICING_VERSION_ALREADY_ADOPTED`                                                    | estado ou concorrência incompatível com o comando        |
| `500` | `INTERNAL_ERROR`                                                                                                                                                                                                                                    | falha inesperada sem detalhes internos na resposta       |

`PRICING_VERSION_ALREADY_ADOPTED` fica reservado para um futuro comando que
exija criar uma nova transição apesar do mesmo estado. O endpoint de adoção
definido nesta ADR trata a repetição normal como sucesso idempotente e não
emite esse erro. Conflitos Prisma conhecidos, inclusive unicidade e falha de
serialização, são traduzidos para códigos estáveis, sem expor `P2002`, `P2034`
ou nomes de constraints.

### Idempotência da adoção

Dentro da transação, o serviço trava o produto e compara o estado atual. Se
`adoptedPricingVersionId` já for a versão solicitada e `salePrice` for igual ao
`analyzedPrice`, retorna o estado existente com `200`, sem novo evento ou
auditoria. Duas requisições concorrentes, portanto, produzem uma única adoção.

Se houve uma transição intermediária, adotar novamente a versão é uma nova
decisão comercial e cria novo evento. Essa é a semântica idempotente adotada
para o Marco 3: repetição do estado atual não duplica efeitos; uma repetição
depois de outro estado é uma nova transição.

Idempotência de transporte que reconheça uma requisição antiga depois de
transições intermediárias exigiria `Idempotency-Key`, persistência do token e
do hash do comando e uma restrição única por organização. O Marco 3 não adotará
essa alternativa: sua garantia oficial é somente a comparação do estado atual
sob lock do produto. Não será criado `Idempotency-Key`, tabela ou migration
adicional para esse fim.

### Concorrência e ordem de locks

Operações que travem mais de uma raiz seguem sempre:

1. configuração da organização;
2. perfis, em ordem crescente de UUID;
3. produtos, em ordem crescente de UUID.

A criação inicial da configuração trava a organização. Alterações de
configuração e perfil verificam `expectedRevision`; composição verifica
`expectedRevision`; criação de versão verifica `expectedCompositionRevision`.
O produto-alvo permanece travado durante a alocação do próximo número de
versão e durante uma adoção.

Simulação usa transação `REPEATABLE READ`, sem locks de escrita. Configuração,
perfil, composição, produto-alvo e produtos-fonte `CATALOG` são lidos na mesma
visão, e o resultado transitório usa somente esse conjunto consistente.

Na criação de versão, o serviço faz uma leitura preliminar para determinar a
configuração, o perfil e o conjunto de produtos envolvidos. Dentro da transação
`REPEATABLE READ`, trava a raiz de configuração, a raiz do perfil quando houver
e todos os produtos necessários — alvo e fontes `CATALOG` — em ordem crescente
de UUID. Depois dos locks, relê configuração, perfil, composição, componentes e
produtos; compara novamente `expectedCompositionRevision` e confirma que o
conjunto de fontes não mudou. Se a releitura exigir outro lock fora do conjunto
ou da ordem, a tentativa é abortada e reiniciada de forma controlada.

Os custos `CATALOG` usados pelo motor são os `directCost` relidos sob esses
locks. A versão congela exatamente essa visão. Conflitos de revisão,
serialização ou disputa detectados pelo serviço ou pelo banco revertem a
operação inteira e são traduzidos para `409`.

### Auditoria

Toda auditoria é gravada na mesma transação da mutação. Os eventos iniciais são:

| Ação                                  | Quando                                | Metadados mínimos                                                        |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `pricing_configuration.updated`       | criação ou nova revisão               | operação, configuração, revisões anterior/nova e campos alterados        |
| `pricing_sales_profile.created`       | perfil inicial                        | perfil e revisão                                                         |
| `pricing_sales_profile.updated`       | nova revisão                          | revisões anterior/nova e campos alterados                                |
| `pricing_sales_profile.deactivated`   | desativação                           | perfil, revisão atual e estado anterior                                  |
| `product_pricing_composition.updated` | nova composição/revisão               | produto, revisões anterior/nova, perfil e quantidade de componentes      |
| `pricing_calculation_version.created` | versão finalizada                     | produto, versão, número, fórmula, schema e revisão da composição         |
| `product_price.adopted`               | preço igual ou acima do mínimo        | `adoptionId`, produto, versão, classificação, confirmação, preços e ator |
| `product_price.adopted_below_minimum` | preço abaixo do mínimo                | `adoptionId`, produto, versão, classificação, confirmação, preços e ator |
| `product_price.manually_changed`      | preço informado no `PATCH` de produto | preço anterior/novo, versão anterior e ponteiro limpo                    |

Em toda adoção, `PricingPriceAdoption` é o registro imutável da decisão; quando
o preço fica abaixo do mínimo, ele contém confirmação e justificativa. O
`AuditLog` não duplica o texto da justificativa: registra `adoptionId`, produto,
versão, classificação, confirmação, preços e ator. O evento de adoção e o
`AuditLog`, vinculados pelo `adoptionId`, formam conjuntamente a trilha exigida
por `PREC-CA-033` e `PREC-CA-059`.

Snapshots, decomposições completas e custos unitários não entram nos metadados
de auditoria. O evento `pricing_calculation.simulated` não será criado porque
simulações não alteram estado.

### Estrutura inicial do módulo

O domínio continuará usando o calculador puro já existente e um único módulo
NestJS, sem introduzir uma camada genérica de repositórios:

```text
apps/api/src/pricing/
  calculator/
  contracts/pricing-snapshot-v1.ts
  dto/
  errors/
  pricing.module.ts
  pricing-locks.ts
  controllers/
    pricing-configuration.controller.ts
    pricing-profiles.controller.ts
    product-pricing.controller.ts
  services/
    pricing-configuration.service.ts
    pricing-profiles.service.ts
    pricing-compositions.service.ts
    pricing-calculations.service.ts
    pricing-adoptions.service.ts
```

DTOs ficam separados dos contratos persistidos. O tipo e o validador de
snapshot não dependem de NestJS e podem ser testados isoladamente. Consultas
Prisma usam `select` explícito, especialmente nas respostas comerciais.

## Plano de implementação do Marco 3

### Marco 3B — Configuração, perfis e base HTTP

Arquivos: módulo, controllers e services de configuração/perfis, DTOs, erros e
registro em `AppModule`.

Endpoints: configuração e perfis, incluindo desativação.

Testes unitários: validação e tradução de erros, revisão esperada, seleção de
campos e autorização condicional.

Testes e2e: autenticação, matriz de papéis, isolamento organizacional,
criação/revisão atômica, auditoria e conflitos concorrentes.

Concluído quando os contratos retornarem somente campos autorizados, todas as
mutações forem transacionais e os testes diretos, API completa e build passarem.
Parar se o schema ou guards da migration não representarem o contrato, se a
aplicação em banco descartável divergir do histórico aplicado ou se uma correção
exigir novo modelo persistente.

### Marco 3C — Composição, cálculo, snapshot e histórico

Arquivos: controller de produto, services de composição e cálculo, DTOs,
`pricing-locks.ts`, contrato e validador `PricingSnapshotV1`.

Endpoints: resumo comercial, composição, simulação, criação e leitura de
versões.

Testes unitários: resolução `MANUAL`/`COPIED`/`CATALOG`, adaptação ao motor,
canonicalização e validação do snapshot, rejeição de resultados do cliente e
ordenação determinística.

Testes e2e: papéis, isolamento, ausência de custos para `VIEWER`, simulação sem
efeitos, snapshot/projeções coerentes, imutabilidade, revisão concorrente e
numeração concorrente de versões.

Concluído quando uma versão puder ser reproduzida somente com seu snapshot e
os contratos comerciais não vazarem dados internos. Parar se o snapshot v1
não couber no modelo aprovado, se um guard SQL bloquear o fluxo transacional
ou se for necessária uma alteração de fórmula.

### Marco 3D — Adoção e alteração manual

Arquivos: service de adoções, extensão do controller de produto de precificação,
integração pontual no `ProductsController`, `ProductsService` e selects de
produto, além dos respectivos testes.

Endpoints: adoção de versão e contrato existente de atualização de produto.

Testes unitários: recálculo e comparação, faixa do destino, justificativa,
autorização abaixo do mínimo, idempotência, autorização condicional de
`salePrice`, limpeza do ponteiro manual e projeções com/sem `directCost`.

Testes e2e: adoção normal e abaixo do mínimo, papéis, isolamento, concorrência,
retry sem duplicação, nova adoção após transição, auditoria atômica, snapshot
desconhecido, alteração manual explícita/omitida e ausência de `directCost` para
`VIEWER` nas listagens e detalhes legados de produto.

Concluído quando preço, ponteiro, evento e auditoria mudarem atomicamente e um
retry do estado atual não criar duplicatas. Parar se uma versão não puder ser
validada sem reinterpretar o histórico ou se o contrato aprovado exigir uma
alteração persistente não prevista.

## Consequências

- A API tem uma fronteira comercial pequena e contratos internos explícitos.
- O backend permanece a autoridade sobre custos resolvidos, cálculo, snapshot,
  histórico, classificação e adoção.
- A forma canônica do snapshot permite reprodução e validação sem consultar o
  estado atual.
- A idempotência da adoção usa somente estado atual e lock do produto; não
  deduplica uma requisição depois de transições intermediárias.
- O contrato legado de produtos passa a ocultar `directCost` de `VIEWER` por
  decisão explícita de compatibilidade e com testes de não vazamento.
- Os códigos de erro estáveis exigem uma tradução local do domínio de
  precificação antes de qualquer filtro global compartilhado.

## Decisões posteriores ao Marco 3

Nenhuma decisão essencial permanece aberta para iniciar os Marcos 3B, 3C ou 3D.

- A ADR-008 aprovou a estratégia de compartilhar a prévia decimal com a web e
  a extensão interna `isAdopted` para o histórico do Marco 4.
- A semântica de origem do preço em itens comerciais editáveis foi definida
  para o Marco 5 em 01/11/2026, conforme a seção seguinte.

## Complemento aprovado para o Marco 5 — origem do preço comercial

Cada item de orçamento e pedido guarda `priceOrigin` anulável (`CATALOG` ou
`MANUAL`) e `pricingVersionId` anulável. Nulo em ambos significa origem não
registrada, inclusive nos documentos anteriores à migration. `CATALOG` exige
produto; `MANUAL` nunca referencia versão. A referência opcional usa chave
composta de organização, produto e versão; o backend só captura uma versão
`FINALIZED` que esteja adotada naquele produto no momento da escolha. Uma
versão posteriormente substituída continua válida no documento histórico.

Na criação de orçamento, a escolha explícita `CATALOG_NOW` recebe o preço
observado, `expectedProductUpdatedAt` e a referência adotada observada
(`expectedAdoptedPricingVersionId`, anulável) apenas para detectar mudança entre
a tela e o salvamento. A lista e o detalhe internos de produtos expõem a
referência somente aos papéis que já podem consultar custos; o resumo comercial
e a resposta para `VIEWER` não a expõem. Dentro da mesma transação, o backend
bloqueia os produtos em ordem crescente, lê `salePrice` e
`adoptedPricingVersionId` atuais, compara preço, timestamp e referência
observados e grava os valores do banco. A confirmação protege tanto o valor
quanto a origem versionada observada, inclusive quando o preço permanece igual.
Divergência retorna conflito
para nova confirmação; preço nulo exige preço manual ou regularização do
produto. `MANUAL` usa o valor informado, inclusive quando igual ao preço de
catálogo, e não guarda referência de versão. Não se oferece versão não adotada
como fonte direta nesta entrega.

Na edição de rascunho, `PRESERVE` exige `sourceItemId` pertencente ao orçamento
e produto/preço unitário iguais ao item anterior; cada `sourceItemId` pode ser
usado uma única vez por atualização, inclusive após reordenação. Quantidade,
descrição e desconto podem mudar sem recapturar preço ou origem.
`CATALOG_NOW` é uma atualização explícita
do preço atual. Trocar produto invalida a preservação anterior. Desconto não
altera a procedência do preço unitário nem certifica que o total líquido
esteja acima do mínimo.

Requisições legadas que enviam apenas `unitPrice` continuam aceitas. Elas
gravam origem desconhecida e nenhuma versão; nunca recebem associação
versionada por coincidência numérica. Atualização legada sem `items` preserva
os itens; ao substituir a coleção sem decisão explícita, os novos itens ficam
com origem desconhecida. A conversão copia preço e origem dos itens do
orçamento aprovado sem consultar produto, versão ou motor. Os contratos
comerciais expõem apenas os campos de origem, sem custos, margens, deduções ou
snapshot interno.
