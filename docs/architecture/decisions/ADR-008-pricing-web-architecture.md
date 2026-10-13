# ADR-008 — Arquitetura da interface web de precificação

## Estado

Aceita como direção para o Marco 4.

Aprovação humana registrada em 10/10/2026. Na data dessa aprovação, nenhuma
interface, dependência ou alteração de contrato havia sido implementada.

O Marco 4B.1 implementou a fundação compartilhada definida nesta ADR:
`@meinager/pricing-calculator` é um pacote ESM privado, compatível com Node e
navegador, fonte única da fórmula e dono de `decimal.js`. A API depende do
pacote pelo workspace e conserva reexports temporários. A web ainda não depende
do pacote, e o recálculo local e toda a interface permanecem pendentes.

## Contexto

Os Marcos 3B a 3D.2 entregaram configuração, perfis, composição, simulação,
versões, histórico, adoção, preço manual e resumo comercial na API. O Marco 4
deve expor esses casos de uso dentro do domínio de produtos sem duplicar a
fórmula, perder precisão decimal ou mostrar custos internos a `VIEWER`.

A aplicação web atual usa React 19, React Router, TanStack Query, React Hook
Form, Zod, Tailwind e testes Vitest com Testing Library em `jsdom`. As páginas
são carregadas com `lazy`, ficam sob `ProtectedRoute` e reutilizam um layout
autenticado horizontal. Formulários mantêm strings decimais, coleções dinâmicas
já usam `useFieldArray`, e páginas apresentam loading com `role="status"`, erros
com `role="alert"`, cartões, tabelas responsivas e ações condicionadas pelo
papel. Não há hoje abstração própria de diálogo, toast, bloqueio de navegação
com formulário sujo ou cliente tipado para os erros estáveis de precificação.

| Padrão atual          | Evidência inspecionada                                                               | Reuso/ajuste                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| rotas e layout        | `apps/web/src/App.tsx`, `components/layout/app-layout.tsx`                           | manter lazy loading, `ProtectedRoute` e navegação secundária dentro de Produtos      |
| sessão e papéis       | `features/auth/use-current-user-query.ts`, `lib/api.ts`                              | usar o papel da organização para apresentação, sem substituir autorização da API     |
| cadastro de produto   | `features/products/*`, `pages/product-page.tsx`, `pages/products-page.tsx`           | integrar resumo e acesso à precificação; corrigir projeções por papel e preço manual |
| formulários dinâmicos | `features/quotes/quote-form.tsx`, `features/order-workflows/order-workflow-form.tsx` | reutilizar React Hook Form, Zod, `useWatch`, `useFieldArray` e ordenação             |
| dados remotos         | hooks `use-*-query.ts`/`use-*-mutation.ts`                                           | manter TanStack Query e centralizar chaves do novo domínio                           |
| estados e layout      | páginas atuais, `components/ui/*`, `index.css`                                       | reutilizar cartões, campos, alertas, grids mobile-first e tabelas com overflow       |
| testes                | specs de páginas/features e `apps/web/vitest.config.ts`                              | manter Vitest, `jsdom`, Testing Library e mock de `fetch`                            |

A auditoria encontrou duas incompatibilidades legadas que devem ser corrigidas
antes dos formulários de precificação:

- o schema Zod de produto exige `directCost`, mas a API omite esse campo para
  `VIEWER` por decisão do Marco 3D.2;
- a edição comum de produto sempre reenvia `salePrice`. Para `OPERATIONS` isso
  causa `403`; para `OWNER` e `ADMIN` transforma uma edição sem intenção
  comercial em preço manual, limpa `adoptedPricingVersionId` e cria auditoria.

Os contratos implementados de precificação correspondem à ADR-007. A revisão
humana aprovou a extensão interna `isAdopted: boolean` para resolver
`PREC-CA-038`: o resumo comercial continua sem identificador de versão, enquanto
a listagem e o detalhe internos indicarão dinamicamente se cada versão é a
origem do preço atual. A implementação dessa extensão será uma etapa pequena,
com testes próprios, antes da interface de histórico do Marco 4D.

### Contratos confirmados na implementação

A arquitetura web se baseia nos controllers, DTOs e retornos dos services, não
somente no desenho anterior da ADR-007:

| Endpoint real                                                   | Escrita/leitura                                       | Entrada e resposta relevante para a web                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET/PATCH /api/pricing/configuration`                          | leitura interna; escrita `OWNER`/`ADMIN`              | revisão atual e proveniências; patch parcial com `expectedRevision` e origens dos valores alterados                   |
| `GET/POST /api/pricing/profiles`                                | leitura interna; criação `OWNER`/`ADMIN`              | lista paginada; criação com nome e deduções ordenadas                                                                 |
| `GET/PATCH /api/pricing/profiles/:profileId`                    | leitura interna; escrita `OWNER`/`ADMIN`              | detalhe inclui deduções; patch usa `expectedRevision`                                                                 |
| `POST /api/pricing/profiles/:profileId/deactivate`              | `OWNER`/`ADMIN`                                       | `expectedRevision`; desativação versionada                                                                            |
| `GET/PUT /api/pricing/products/:productId/composition`          | leitura interna; escrita `OWNER`/`ADMIN`/`OPERATIONS` | estado completo, componentes na ordem do array e `expectedRevision` no `PUT`                                          |
| `POST /api/pricing/products/:productId/simulations`             | `OWNER`/`ADMIN`/`OPERATIONS`                          | fonte `PERSISTED` ou `DRAFT`, preço analisado opcional; devolve entradas resolvidas e resultado completo sem escrever |
| `POST /api/pricing/products/:productId/versions`                | `OWNER`/`ADMIN`/`OPERATIONS`                          | `expectedCompositionRevision` e preço analisado opcional; devolve versão finalizada                                   |
| `GET /api/pricing/products/:productId/versions` e `/:versionId` | leitura interna                                       | respostas atuais sem `isAdopted`; detalhe mantém snapshot/projeções congelados                                        |
| `POST /api/pricing/products/:productId/adoptions`               | `OWNER`/`ADMIN`/`OPERATIONS`                          | `versionId`; confirmação/justificativa condicionais; devolve produto e evento de adoção                               |
| `GET /api/pricing/products/:productId/summary`                  | cinco papéis                                          | somente `productId`, `currency`, `salePrice`, `priceOrigin` e `hasComposition`                                        |
| `PATCH /api/products/:productId`                                | papel do cadastro, com regra condicional              | `salePrice` omitido preserva origem; string ou `null` explícito é decisão manual exclusiva de `OWNER`/`ADMIN`         |

Neste quadro, “leitura interna” significa `OWNER`, `ADMIN`, `OPERATIONS` e
`FINANCE`. Os payloads de composição e rascunho materializam campos anuláveis,
mantêm componentes ordenados e usam strings para valores financeiros. A API
deriva organização e ator da sessão e não aceita resultados calculados pelo
cliente.

### Extensão interna aprovada: `isAdopted`

As respostas internas de
`GET /api/pricing/products/:productId/versions` e
`GET /api/pricing/products/:productId/versions/:versionId` receberão:

```ts
isAdopted: boolean;
```

O campo será calculado pelo backend no momento da consulta e será `true`
somente quando `Product.adoptedPricingVersionId === version.id`. Se o preço
atual for manual, o ponteiro estará nulo e todas as versões retornarão
`isAdopted: false`.

`isAdopted` aparece somente nesses contratos internos. `VIEWER` continua sem
acesso aos endpoints de versões, e o resumo comercial continua sem `versionId`,
snapshot ou qualquer detalhe interno. O campo não é recebido do cliente, não é
persistido e não exige schema ou migration. Ele não modifica snapshot,
projeções ou versões históricas e deve ser calculado somente depois de validar
a organização e o produto da sessão.

Os dados da versão são históricos e imutáveis. `isAdopted` é uma projeção
comercial dinâmica do estado atual do produto e pode mudar sem qualquer
alteração na versão. A implementação terá testes unitários e E2E próprios antes
da interface de histórico do Marco 4D.

## Decisão

### Integração, rotas e navegação

A precificação continuará dentro de Produtos. Não haverá aplicação paralela
nem nova entrada principal ao lado de Produtos.

| Rota                                           | Finalidade                                      | Acesso visual                                                                      |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/app/produtos/precificacao/configuracao`      | Configuração organizacional                     | `OWNER`/`ADMIN` editam; `OPERATIONS`/`FINANCE` leem                                |
| `/app/produtos/precificacao/perfis`            | Lista e manutenção de perfis                    | `OWNER`/`ADMIN` editam; `OPERATIONS`/`FINANCE` leem                                |
| `/app/produtos/precificacao/perfis/:profileId` | Detalhe e edição de um perfil                   | mesmos papéis e limites da lista                                                   |
| `/app/produtos/:productId/precificacao`        | Composição, prévia, versões e adoção do produto | contrato interno para os quatro papéis; `VIEWER` recebe somente o resumo comercial |
| `/app/produtos/:productId`                     | Cadastro atual e resumo comercial integrado     | todos os papéis autenticados, respeitando a projeção permitida                     |

As rotas estáticas de configuração e perfis serão declaradas de forma explícita
junto às rotas de Produtos. A navegação principal continuará mostrando
Produtos. Uma navegação secundária da área apresentará Configuração e Perfis
somente a `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE`. O detalhe do produto terá
um cartão de resumo comercial para todos os papéis e um acesso ao espaço de
precificação somente para os quatro papéis internos. Se `VIEWER` abrir a rota
diretamente, a página deverá renderizar apenas o mesmo resumo comercial, sem
disparar queries internas.

Um produto sem composição continua editável e utilizável. O resumo informa o
preço atual, sua origem e que não há composição. `OWNER`, `ADMIN` e `OPERATIONS`
recebem uma ação para iniciar a composição; `FINANCE` recebe estado vazio de
leitura; `VIEWER` não recebe custos nem chamada para edição. Na ausência de
configuração, `OWNER`/`ADMIN` recebem acesso para configurá-la e os demais
papéis recebem orientação sem ação indevida.

### Divisão do Marco 4

#### Marco 4B.1 — Pacote compartilhado do motor

- concluído em 10/10/2026 em `packages/pricing-calculator` com a fronteira pura
  definida nesta ADR;
- motor e única suíte canônica completa de 77 testes movidos sem alteração das
  fórmulas ou expectativas;
- EX-001 a EX-012 preservados e aprovados nessa suíte;
- reexports temporários e três testes mínimos de compatibilidade mantidos na
  API;
- package, exports ESM, tipos gerados e scripts de build, typecheck, lint e
  teste integrados ao workspace e ao Turbo;
- equivalência de resultados e `formulaVersion` comprovada sem código web.

#### Marco 4B.2 — Fundação web e compatibilidade de produtos

- criar contratos Zod, `ApiError` estruturado, query key factory, hooks e mapa
  de permissões;
- aceitar ausência de `directCost` para `VIEWER`;
- impedir reenvio de `salePrice` em edição comum;
- criar ação de preço manual explícita somente para `OWNER`/`ADMIN`;
- integrar o resumo comercial ao detalhe do produto;
- implementar navegação, rotas-base e um diálogo acessível sobre
  `@base-ui/react`, já instalado, sem biblioteca nova de modal ou toast.

#### Marco 4B.3 — Configuração organizacional

- implementar consulta e formulário;
- oferecer leitura a `OPERATIONS`/`FINANCE` e edição a `OWNER`/`ADMIN`;
- tratar `expectedRevision`, proveniências, loading, estado vazio, erro e
  conflito.

#### Marco 4B.4 — Perfis de venda

- implementar lista paginada, detalhe, criação, edição e desativação;
- manter deduções ordenadas, proveniências, permissões e conflitos.

#### Marco 4C — Composição do produto

- implementar consulta e substituição completa da composição;
- selecionar perfil, editar componentes ordenados e resolver os modos
  `MANUAL`, `COPIED` e `CATALOG`;
- implementar mão de obra e frete manual/rateado;
- preservar proveniências, estado sujo e `expectedRevision`;
- disponibilizar a prévia local instantânea, com estados de validação e de
  configuração/composição ausentes.

#### Marco 4D — Simulação, versões e adoção

- confirmar o rascunho com `POST /simulations`, explicando que simular não
  altera o produto;
- criar versão, listar e detalhar snapshots históricos imutáveis;
- analisar o preço efetivamente escolhido e adotar a versão explicitamente;
- exigir confirmação e justificativa para preço abaixo do mínimo e somente
  exibir essa ação a `OWNER`/`ADMIN`;
- atualizar resumo e produto após adoção ou preço manual;
- usar `isAdopted` depois da implementação da extensão interna aprovada.

#### Marco 4E — Acabamento e validação integral

- consolidar layout responsivo, foco, teclado, mensagens anunciadas e contraste;
- validar estados de loading, vazio, erro, leitura e conflitos em todos os
  papéis;
- executar o fluxo completo de produto e os testes visuais nos tamanhos de tela
  suportados;
- confirmar ausência de vazamento de custos a `VIEWER` e preservar produtos,
  estoque, financeiro, orçamentos e pedidos.

### Prévia instantânea

As alternativas foram avaliadas assim:

| Alternativa                                  | Latência e precisão                                                      | Risco e impacto                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A. Extrair o motor para pacote compartilhado | cálculo local abaixo de 100 ms e o mesmo decimal exato nos dois runtimes | refactor controlado de imports e dependência de workspace; elimina duplicação                          |
| B. Reimplementar no frontend                 | pode atender a latência                                                  | duplica fórmula, arredondamentos, validações e manutenção; alto risco de divergência                   |
| C. Somente `POST /simulations` com debounce  | backend sempre autoritativo                                              | rede e debounce não garantem 100 ms; introduzem corridas e deixam a edição dependente de conectividade |
| D. Prévia local e confirmação pela API       | resposta imediata e decisão final autoritativa                           | exige compartilhar a implementação para que o lado local não se torne uma segunda fórmula              |

A decisão é **D, com o cálculo local fornecido pela extração A**. O navegador
calcula a prévia com o mesmo motor puro; `POST /simulations`, criação de versão
e adoção continuam autoritativos. Resultados do cliente nunca são enviados como
fonte de verdade nem persistidos diretamente.

O pacote será `packages/pricing-calculator` e conterá somente código independente
de Prisma, NestJS, React, HTTP, banco e estado global. Sua fronteira poderá
conter `pricing-calculator.ts`, `pricing-calculator.types.ts`,
`pricing-calculator.errors.ts`, `pricing-decimal.ts`, uma API pública ESM
explícita e os testes canônicos do motor.

Não serão movidos para o pacote `pricing-decimal-serialization.ts`, baseado em
`Prisma.Decimal`, contratos do snapshot persistido, DTOs HTTP, adapters Prisma
ou services da API. `serializePricingDecimal(Prisma.Decimal)` continuará em
`apps/api`. Se a API pública do pacote expuser serialização, ela operará somente
sobre o `Decimal.js` privado do motor ou sobre resultados textuais produzidos
pelo próprio motor, sem importar tipos Prisma.

`decimal.js` é dependência direta do pacote compartilhado. A API depende desse
pacote pelo workspace; a web passará a depender dele somente quando usar a
prévia local. O pacote possui `package.json`, exports ESM, `tsconfig` e scripts
de build, typecheck, lint e testes compatíveis com Turbo. O bundle do navegador
não poderá receber dependências exclusivas de Node. O clone decimal continua
local e nenhuma fórmula, limite, arredondamento ou `formulaVersion` será
alterado.

A migração será incremental:

1. criar a estrutura do pacote e mover apenas os arquivos puros definidos
   acima, sem alterar fórmula ou contrato;
2. manter arquivos de compatibilidade em `apps/api/src/pricing/calculator/`
   que reexportem o pacote, preservando inicialmente todos os imports atuais;
3. mover os 77 testes, incluindo EX-001 a EX-012, para a única suíte canônica
   completa do pacote;
4. manter na API somente testes mínimos dos reexports e das integrações;
5. migrar imports internos da API somente depois da equivalência comprovada;
6. executar testes do pacote, da API e da web no pipeline, provando resultados
   e `formulaVersion` idênticos;
7. conectar a web ao pacote e manter a confirmação autoritativa pela API.

A migração pode passar temporariamente por etapas, mas o estado final não
manterá duas cópias completas dos 77 testes.

O Marco 4B.1 concluiu os passos 1 a 4 e a validação de pacote, API e web do
passo 6. A migração opcional dos imports internos e o consumo pela web
permanecem nos passos 5 e 7.

### Representação decimal na web

- Valores financeiros e percentuais continuam como strings decimais canônicas
  nos contratos HTTP e no estado de domínio. `number` fica restrito a paginação,
  posição, contadores e apresentação que não seja fonte financeira.
- Inputs mantêm a string digitada enquanto possuem foco. Aceita-se ponto ou uma
  única vírgula como separador decimal, sem separador de milhares; a vírgula é
  convertida em ponto somente no adaptador de formulário, antes da validação e
  chamada HTTP.
- Inputs percentuais mostram a unidade humana, por exemplo `25`, e convertem de
  forma decimal exata para a fração canônica `0.25` no limite do formulário.
  Nunca usam divisão ou multiplicação com `number`.
- A canonicalização remove zeros irrelevantes e proíbe expoente. Exibição em
  BRL/percentual é uma projeção separada; ela não substitui a string canônica
  nem volta ao cálculo.
- `''` existe somente durante a edição. `undefined` significa campo omitido;
  `null` representa remoção explícita apenas quando o contrato a admite. Essa
  distinção é especialmente obrigatória no `PATCH` de produto: uma edição
  comum omite `salePrice`, enquanto a ação manual envia string ou `null`.
- Zod valida sinal, casas, escala e intervalo antes do HTTP. A resposta também
  é validada e não aceita `NaN`, `Infinity` ou notação exponencial.

### Estado, queries e invalidações

Uma factory central define chaves estáveis:

```text
['pricing']
['pricing', 'configuration']
['pricing', 'profiles', 'list', filtros]
['pricing', 'profiles', 'detail', profileId]
['pricing', 'products', productId, 'summary']
['pricing', 'products', productId, 'composition']
['pricing', 'products', productId, 'versions', 'list', pagina]
['pricing', 'products', productId, 'versions', 'detail', versionId]
```

Simulações são mutations transitórias e seus resultados pertencem ao estado da
página, sem cache histórico. O estado persistido fica no cache do TanStack
Query, o rascunho fica no React Hook Form e a prévia local/resultado da
simulação fica separado de ambos. O rascunho nunca substitui silenciosamente o
cache persistido.

| Mutação      | Atualizações e invalidações                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------- |
| configuração | configuração; marcar prévias abertas como desatualizadas, sem invalidar versões históricas         |
| perfil       | lista/detalhe do perfil; marcar rascunhos que o usam como desatualizados                           |
| composição   | composição e resumo do produto; descartar prévia/simulação transitória daquele produto             |
| versão       | lista de versões e detalhe criado; preservar detalhes históricos existentes                        |
| adoção       | lista de versões; detalhes da versão anterior e da nova; resumo; lista/detalhe legado do produto   |
| preço manual | lista de versões; detalhe da versão anteriormente adotada; resumo; lista/detalhe legado do produto |

Assim, toda adoção invalida a lista de versões, o detalhe em cache da versão
anteriormente adotada, o detalhe da nova versão, o resumo comercial e a lista e
o detalhe legados do produto. O preço manual invalida os mesmos estados
aplicáveis, sem detalhe de nova versão porque ele limpa o ponteiro.

Formulários carregam `expectedRevision` do estado persistido. Um `409` com
`PRICING_REVISION_CONFLICT` ou `PRICING_CONCURRENT_MODIFICATION` mantém o
rascunho e oferece recarregar/comparar; não faz retry cego de uma mutação. A
composição é relida antes de criar versão conforme o contrato. Formulários
sujos usam bloqueio do React Router e `beforeunload`, com confirmação acessível
antes de descartar alterações.

Loading preserva a estrutura principal; ausência esperada usa estado vazio com
ação permitida pelo papel; erros recuperáveis oferecem retry; `404` não revela
organização externa. Sucesso e falha usam regiões `aria-live`/`role="alert"`.
Versões e snapshots são imutáveis no cache: nenhuma mutação reescreve seus
dados históricos.

### Permissões da interface

| Capacidade                   | OWNER                  | ADMIN                  | OPERATIONS | FINANCE | VIEWER |
| ---------------------------- | ---------------------- | ---------------------- | ---------- | ------- | ------ |
| resumo comercial             | sim                    | sim                    | sim        | sim     | sim    |
| configuração/perfis internos | editar                 | editar                 | ler        | ler     | oculto |
| composição                   | editar                 | editar                 | editar     | ler     | oculto |
| simular/criar versão         | sim                    | sim                    | sim        | não     | oculto |
| histórico interno            | ler                    | ler                    | ler        | ler     | oculto |
| adotar no mínimo ou acima    | sim                    | sim                    | sim        | não     | oculto |
| adotar abaixo do mínimo      | confirmar e justificar | confirmar e justificar | não        | não     | oculto |
| preço manual                 | sim                    | sim                    | não        | não     | oculto |

A interface oculta ações impossíveis e usa estados somente leitura onde existe
consulta autorizada. A API continua sendo a autoridade; `403` ainda deve ser
tratado porque o papel ou o estado pode mudar entre renderização e envio.
`VIEWER` não dispara queries de configuração, perfil, composição, simulação,
versão ou histórico, e nunca recebe `directCost`, custos, margem, lucro,
decomposição ou snapshot.

### Fluxo do produto

O detalhe mostra preço atual, origem `MANUAL` ou `PRICING_VERSION` e existência
de composição. O usuário interno abre Precificação, cria ou edita a composição,
seleciona o perfil, informa componentes, mão de obra e frete e vê a prévia local.
A página explica junto ao resultado que simular não altera o produto.

Antes de salvar uma versão, o rascunho é validado pela simulação autoritativa.
A versão salva congela a análise; o usuário inspeciona mínimo, sugerido,
analisado, decomposição, deduções, lucro, margem, classificação e avisos. A
adoção é uma ação separada e atualiza o produto somente após confirmação. Abaixo
do mínimo, o diálogo exige confirmação e justificativa de `OWNER`/`ADMIN`.

O histórico lista versões e abre o snapshot sem reinterpretá-lo. A alteração
manual de preço fica em ação própria de `OWNER`/`ADMIN`, informa que string ou
`null` explícito limpará a origem versionada e refaz resumo/produto após sucesso.

### Árvore de componentes

```text
ProductsPricingNavigation
PricingConfigurationPage
  PricingConfigurationView
  PricingConfigurationForm
PricingProfilesPage
  PricingProfileList
  PricingProfileForm
    PricingDeductionFieldArray
ProductPage
  ProductCommercialSummary
  ManualProductPriceDialog
ProductPricingPage
  ProductCommercialSummary
  PricingEmptyState | PricingErrorState | PricingConflictAlert
  PricingCompositionEditor
    PricingSalesProfileSelect
    PricingComponentFieldArray
      PricingComponentRow
      CatalogProductSelect
    PricingLaborSection
    PricingFreightSection
  PricingPreviewPanel
    PricingPriceCards
    PricingBreakdown
    PricingWarnings
  PricingVersionHistory
    PricingVersionList
    PricingVersionDetail
  PricingAdoptionDialog
    BelowMinimumConfirmation
```

Serão reutilizados `Button`, `Card`, `Field`, `FieldError`, `FieldSet`, `Input`,
`Label` e `Separator`; os padrões de `useFieldArray` dos formulários de
orçamento e fluxo; os hooks atuais de autenticação; cartões, tabelas com
`overflow-x-auto`, grids mobile-first e estados de página. Um wrapper de
diálogo será criado com `@base-ui/react`, que já é dependência. Não se adiciona
toast: feedback inicial será inline e anunciado. O seletor de catálogo reutiliza
a consulta de produtos depois de corrigido seu contrato por papel.

### Erros estáveis da API

`ApiError` será estendido de forma compatível para preservar `statusCode`,
`code`, `field` e `details`, além de `message`. O mapa usa apenas códigos
implementados:

| Tratamento                           | Códigos                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| erro de campo/grupo                  | `VALIDATION_ERROR`, `INVALID_DECIMAL_VALUE`, `NEGATIVE_VALUE`, `JUSTIFICATION_REQUIRED`, `PRICE_OUT_OF_RANGE`, `INVALID_AVERAGE_REVENUE`, `INVALID_PRODUCTIVE_HOURS`, `INVALID_FREIGHT_QUANTITY` |
| moeda/divisor e bloqueio do cálculo  | `UNSUPPORTED_CURRENCY`, `INVALID_PRICING_DIVISOR`, `PRICING_CONFIGURATION_REQUIRED`                                                                                                              |
| estado vazio configurável            | `PRICING_CONFIGURATION_NOT_FOUND`, `PRICING_COMPOSITION_NOT_FOUND`                                                                                                                               |
| recurso ausente/inválido             | `PRODUCT_NOT_FOUND`, `PRICING_PROFILE_NOT_FOUND`, `PRICING_PROFILE_INACTIVE`, `PRICING_VERSION_NOT_FOUND`, `PRICING_VERSION_NOT_FINALIZED`                                                       |
| conflito com opção de recarregar     | `PRICING_REVISION_CONFLICT`, `PRICING_CONCURRENT_MODIFICATION`                                                                                                                                   |
| permissão/autenticação               | `PRICING_FORBIDDEN`, `BELOW_MINIMUM_FORBIDDEN`, `AUTHENTICATION_REQUIRED`                                                                                                                        |
| erro de página sem detalhes internos | `INTERNAL_ERROR`                                                                                                                                                                                 |

Mensagens de campo usam `field` quando ele corresponder ao formulário. Recurso
ausente de outra organização recebe o mesmo estado de não encontrado. O cliente
não mostra stack, SQL, código Prisma ou detalhes desconhecidos. Códigos não
reconhecidos caem na mensagem genérica e são observáveis somente pelos meios
operacionais do servidor.

### Estratégia de testes

- testes de contratos Zod cobrem todas as respostas, erros estruturados,
  ausência de `directCost` para `VIEWER` e strings canônicas sem expoente;
- testes de hooks cobrem query keys, mutations e cada invalidação;
- testes de página cobrem a matriz de papéis e comprovam que `VIEWER` não faz
  requests internos nem renderiza custos;
- configuração ausente, perfil inativo, produto sem composição, composição
  simples/completa e conflitos de revisão têm estados próprios;
- componentes dinâmicos cobrem adicionar, remover, reordenar, catálogo,
  proveniência, mão de obra e os modos de frete;
- a única suíte canônica completa de 77 testes do motor, incluindo EX-001 a
  EX-012, roda no pacote compartilhado; a API mantém somente testes mínimos dos
  reexports e das integrações, e a web compara a prévia local à resposta
  autoritativa;
- o pipeline executa pacote, API e web e prova que resultados e
  `formulaVersion` permanecem idênticos;
- simular comprova ausência de alteração do resumo/produto; versão, detalhe,
  adoção normal, abaixo do mínimo, preço manual e histórico cobrem invalidações
  e mensagens;
- testes com Testing Library verificam nome acessível, associação de erros,
  `aria-live`, teclado, foco inicial/retorno do diálogo e confirmação de saída;
- responsividade é verificada nos layouts estreito e amplo no Marco 4E, com
  teste visual manual obrigatório. A suíte existente permanece Vitest/jsdom;
  qualquer ferramenta de navegador ou regressão visual exigirá decisão e
  dependência separadas antes de ser adicionada.

## Consequências

- A arquitetura permite atender ao limite de 100 ms sem transformar o cliente
  em autoridade; o Marco 4C deverá comprovar a latência.
- Uma única implementação preserva fórmula, precisão, EX-001 a EX-012,
  `formulaVersion` e compatibilidade do snapshot.
- O Marco 4B.1 isola o refactor do motor; 4B.2 trata a fundação e a
  compatibilidade de produtos; 4B.3 e 4B.4 entregam configuração e perfis.
- Histórico permanece imutável e não é invalidado por mudanças atuais.
- Permissões reduzem exposição visual, mas todas as decisões continuam
  verificadas pela API.
- Não foi necessária reestruturação global do frontend: a organização atual por
  features, pages, hooks e componentes comporta o novo domínio.

## Decisão não essencial ainda aberta

A única decisão ainda aberta para o Marco 4 é a eventual adoção de uma
ferramenta automatizada de browser ou regressão visual no Marco 4E. Isso não
bloqueia 4B, 4C ou 4D e afeta somente a automação adicional ao baseline
Vitest/jsdom e ao teste visual manual obrigatório.

## Alternativas descartadas

- manter duas implementações matemáticas foi descartado pelo risco de
  divergência e custo de testes duplicados;
- depender somente de simulação remota foi descartado por não garantir a
  resposta local inferior a 100 ms;
- usar `number` ou `Intl.NumberFormat` como fonte de cálculo foi descartado por
  perda de precisão;
- criar uma área principal independente de Produtos foi descartado porque a
  composição, as versões e o preço adotado pertencem ao produto;
- adicionar biblioteca de estado, modal ou toast foi descartado porque as
  dependências e padrões atuais atendem à primeira entrega.

## Mapeamento

| Decisão                                          | Requisitos e ADRs atendidos                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| pacote puro compartilhado e confirmação pela API | ADR-002, ADR-005, ADR-007, `PREC-RN-034`, `PREC-CA-027`, `PREC-CA-050` |
| contratos como strings e formatação separada     | ADR-002, ADR-005, ADR-007, `PREC-CA-050` a `PREC-CA-053`               |
| histórico somente leitura                        | ADR-003, ADR-006, ADR-007, `PREC-CA-035` a `PREC-CA-038`               |
| `isAdopted` como projeção dinâmica interna       | ADR-003, ADR-007, `PREC-CA-034`, `PREC-CA-038`                         |
| integração ao produto e ação explícita           | ADR-003, ADR-007, `PREC-CA-034`, `PREC-CA-039`                         |
| matriz visual sem vazamento                      | ADR-006, ADR-007, `PREC-CA-045` a `PREC-CA-049`                        |
| estados, acessibilidade e responsividade         | `PREC-CA-054` a `PREC-CA-057`                                          |
