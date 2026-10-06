# Implementar o motor de precificação do Meinager

Este documento é um plano vivo. As seções `Progresso`, `Descobertas`,
`Decisões tomadas` e `Resultados` devem ser atualizadas durante a
implementação.

O plano deve permanecer compreensível para alguém que possua apenas o
repositório atual e os documentos versionados nele.

## Objetivo

Ao concluir este plano, um usuário autorizado poderá configurar a precificação
da organização, compor os custos de um produto ou serviço, calcular preço
mínimo e sugerido, adotar um preço comercial e consultar versões anteriores.

Orçamentos e pedidos deverão preservar a origem comercial do preço sem expor
automaticamente os custos internos.

O comportamento poderá ser demonstrado pelo fluxo:

1. acessar um produto;
2. abrir sua precificação;
3. informar ou selecionar seus componentes;
4. visualizar custo-base, mínimo e sugerido;
5. adotar um preço;
6. criar um orçamento com esse produto;
7. alterar posteriormente sua precificação;
8. confirmar que o orçamento e o pedido anteriores permanecem inalterados.

## Fontes de verdade

Antes de implementar cada parte, consulte somente os documentos relevantes:

- regras de negócio:
  `docs/domains/pricing/business-rules.md`;
- fórmulas:
  `docs/domains/pricing/calculation-specification.md`;
- exemplos:
  `docs/domains/pricing/examples.md`;
- critérios:
  `docs/domains/pricing/acceptance-criteria.md`;
- decisões:
  `docs/architecture/decisions/`;
- escopo:
  `docs/product/scope-and-roadmap.md`;
- rastreabilidade:
  `docs/product/requirements-traceability.md`.

O material em `docs/product/sources/` é histórico e não pode substituir as
fontes oficiais.

## Progresso

- [x] Preservar os requisitos originais.
- [x] Consolidar as regras oficiais.
- [x] Definir as fórmulas.
- [x] Criar exemplos canônicos.
- [x] Criar critérios de aceitação.
- [x] Registrar as decisões arquiteturais iniciais.
- [x] Criar a matriz inicial de rastreabilidade.
- [x] Realizar a auditoria técnica do repositório (02/10/2026; somente Marco 0).
- [x] Implementar e testar o motor matemático (Marco 1 concluído em
      03/10/2026, após correção validada dos exemplos EX-001/EX-002).
- [x] Registrar a direção arquitetural da persistência (Marco 2A, 03/10/2026;
      ADR-006, somente documentação).
- [x] Revisar, antes da aplicação, schema e migration e validar guards em
      PostgreSQL descartável (Marco 2B.1, 04/10/2026; estado histórico daquela
      execução).
- [x] Versionar a fundação de persistência no commit `9427866` e validar a
      migration no banco local de desenvolvimento (04/10/2026; 16 migrations e
      banco local atualizado).
- [x] Definir o contrato e a segurança da API (Marco 3A, 04/10/2026; ADR-007,
      somente documentação).
- [x] Implementar base HTTP, erros locais e configuração organizacional
      versionada (Marco 3B.1, 05/10/2026).
- [ ] Implementar os services e endpoints da API de precificação (Marcos 3B a
      3D).
- [ ] Implementar perfis de deduções e concluir o Marco 3B.
- [ ] Implementar composição e simulação.
- [ ] Implementar versões, histórico e adoção de preço.
- [ ] Implementar a interface web.
- [ ] Integrar snapshots com orçamentos e pedidos.
- [ ] Executar validação completa.
- [ ] Atualizar a matriz de rastreabilidade.
- [ ] Registrar os resultados finais.

## Descobertas

Registre nesta seção fatos identificados durante a implementação que não eram
evidentes no início.

Cada descoberta deve conter:

- data;
- descrição;
- evidência;
- impacto no plano.

### Auditoria técnica — 02/10/2026

As evidências abaixo descrevem o código em `1bbe5f8`, que sucede `13a3eb3`.
A árvore estava limpa no início. Foram lidos integralmente `AGENTS.md` e este
plano. Não existe módulo, contrato, interface ou modelo específico de
precificação em `apps/api/src/app.module.ts`, `apps/web/src/App.tsx` ou
`apps/api/prisma/schema.prisma`.

#### 1. Persistência e serialização decimal

- Evidência: `apps/api/prisma/schema.prisma`, modelos `Product`,
  `StockMovement`, `FinancialQuoteItem`, `SalesOrderItem` e financeiros.
  Custos diretos, quantidades e estoque mínimo usam `Decimal(18, 6)`;
  `Product.salePrice`, preços unitários, totais, descontos, receitas manuais,
  saldos iniciais, lançamentos e baixas usam `Decimal(14, 2)`.
- Evidência: `apps/api/src/quotes/quotes.service.ts`, métodos `create` e
  `update`, usam `Prisma.Decimal` a partir de strings, multiplicação decimal,
  soma dos totais de itens e `ROUND_HALF_UP` somente no total de cada item.
  Produtos, orçamentos e pedidos retornam valores Prisma selecionados;
  o JSON decimal é textual, sem garantir zeros finais. O teste
  `apps/api/test/products.e2e-spec.ts`, caso de criação com precisão decimal,
  exige `directCost: '0.123456'` e `salePrice: '29.9'`; o teste de orçamento
  exige `total: '23'`. Não há interceptor global de serialização decimal em
  `apps/api/src/app.setup.ts`.
- Evidência: `apps/api/src/inventory/inventory.service.ts`, `toResponse` e
  `calculateTotals`, convertem explicitamente com `toString()`. Financeiro
  também usa centavos `bigint` e `toFixed(2)` em
  `apps/api/src/finance/summary/summary.service.ts` e
  `apps/api/src/finance/settlements/settlements.service.ts`.
- Evidência: `apps/web/src/features/products/products-api.ts` e
  `apps/web/src/features/quotes/quotes-api.ts` validam decimais como strings
  com Zod. `product-form.tsx` usa campos textuais com `inputMode="decimal"`.
  `apps/web/src/features/quotes/quote-form.tsx` calcula prévias com inteiros
  `bigint` escalados (quantidade em seis casas e dinheiro em centavos).
- Impacto: reutilizar strings nas fronteiras e aritmética decimal; não copiar
  o arredondamento dos totais de orçamento para os preços mínimo/sugerido,
  que exigem arredondamento para cima. Os centavos do financeiro não bastam
  para divisões e intermediários do motor. A ADR-002 exige novos campos de
  precificação com pelo menos `(19, 6)` e percentuais `(12, 8)`; os campos
  existentes têm limites menores e devem ser preservados.
- Evidência estrutural: modelos usam UUID com `@default(uuid())`/`@db.Uuid`,
  nomes camelCase mapeados para colunas/tabelas snake_case (`@map`/`@@map`),
  timestamps `Timestamptz(3)` e `@updatedAt` em entidades editáveis.
  Reutilizar essas convenções e revisar também SQL de migrations, pois
  restrições `CHECK` e índices parciais podem não aparecer no schema.

#### 2. Criação e atualização do preço comercial

- Evidência: `apps/api/src/products/products.controller.ts`, `create` e
  `update`, expõem `POST /api/products` e `PATCH /api/products/:productId`.
  `dto/create-product.dto.ts` aceita `salePrice` textual não negativo, até
  12 dígitos inteiros e duas casas; `dto/update-product.dto.ts` diferencia
  ausência de campo de `null` (inclusive texto vazio normalizado para `null`).
- Evidência: `apps/api/src/products/products.service.ts`, `create`, grava o
  preço ou `null`; `update` altera o preço somente quando fornecido, dentro
  de transação e após `lockProduct`. Histórico de estoque bloqueia mudanças
  de unidade/tipo/controle, mas permite atualizar preço e custo direto.
  `apps/api/src/products/products.service.spec.ts` cobre alteração do preço
  mesmo com histórico de estoque.
- Evidência: a migration
  `apps/api/prisma/migrations/20260910182458_add_product_sale_price/migration.sql`
  adiciona coluna anulável e `CHECK` de preço não negativo e diferente de NaN.
- Impacto: manter `Product.salePrice` como preço comercial. Adoção futura
  precisará atualizar preço, referência opcional e auditoria atomicamente;
  o `PATCH` atual não é um caso de uso de adoção e não calcula margens.

#### 3. Papéis, autenticação e isolamento organizacional

- Evidência: `apps/api/src/products/products.controller.ts` permite criação
  e alteração por `OWNER`, `ADMIN`, `OPERATIONS`. Listagem e detalhe não têm
  restrição adicional de papel: todos os cinco papéis autenticados,
  incluindo `FINANCE` e `VIEWER`, podem consultar.
  `apps/api/test/products.e2e-spec.ts`, caso de permissões por papel,
  comprova escrita permitida e leitura dos papéis sem escrita.
- Evidência: `apps/api/src/auth/session/session-auth.guard.ts` autentica
  cookie e preenche `request.auth`; `session.service.ts`, `findAuthenticated`,
  exige sessão válida, usuário ativo, vínculo ativo e organização ativa.
  A organização vem do primeiro vínculo ativo por `createdAt`, não de um
  identificador enviado pelo cliente. Não existe seleção organizacional
  explícita nesse fluxo. `OrganizationRolesGuard` em
  `apps/api/src/auth/authorization/organization-roles.guard.ts` retorna `403`
  quando um papel não está na lista; sessão inválida retorna `401`.
- Evidência: controllers passam `request.auth.organization.id` e usuário
  separadamente ao service. `ProductsService.findOne`, consultas de
  `QuotesService` e `OrdersService` filtram ID e organização. Recursos
  individuais ausentes/externos retornam `404`; coleções de produtos inválidos
  em orçamento retornam `400` genérico. Updates por ID são precedidos pela
  validação do recurso dentro da transação.
- Evidência: o schema possui unicidade composta `[organizationId, id]` e
  FKs compostas para produtos, clientes, orçamentos, pedidos e fluxos.
  Relações de lançamentos/baixas com período/categoria/conta usam IDs simples;
  nesses casos a verificação organizacional depende também dos serviços,
  como `SettlementsService.create` e validações de `EntriesService`.
  `PrismaService` não possui filtro automático por organização.
- Impacto: aplicar os guards e verificações explícitas a todos os recursos
  novos; preferir relações compostas nos novos modelos. A política de custos
  não pode ser deduzida apenas da permissão atual de leitura de produtos.

#### 4. Auditoria

- Evidência: `AuditLog` em `apps/api/prisma/schema.prisma` guarda organização,
  ator opcional, ação, tipo/ID da entidade, metadata JSON, IP opcional e data.
  Existem índices por organização/data, ator e entidade. Não há módulo ou
  serviço central de auditoria: os services chamam
  `transaction.auditLog.create` na mesma transação da mutação.
- Evidência: `ProductsService` grava `product.created` e `product.updated`
  sem metadata de preço anterior/novo; `QuotesService.update` grava estados
  anterior/atual e decimais como strings; `OrdersService.createFromQuote`
  grava `order.created` com origem, fluxo e total. Esses serviços não
  preenchem IP em todas as ações.
- Impacto: reutilizar o modelo e a atomicidade, mas acrescentar os metadados
  exigidos por `PREC-CA-059` e ADR-003, inclusive versão, preço anterior/novo
  e justificativa. A simulação isolada dispensa auditoria conforme ADR-003;
  criação de versão salva deve ser auditada.

#### 5. Snapshots de orçamento

- Evidência: `FinancialQuoteItem` guarda `productId` opcional, posição,
  descrição, unidade, quantidade, preço unitário, total e notas. Em
  `apps/api/src/quotes/quotes.service.ts`, `create`/`update` recebem descrição,
  unidade e preço do DTO; consultam somente IDs de produtos ativos da
  organização. O backend recalcula totais e desconto, mas não busca
  `Product.salePrice` como preço autoritativo do item.
- Evidência: `apps/web/src/features/quotes/quote-form.tsx` copia nome, unidade
  e `salePrice` ao selecionar produto, mantendo campos editáveis. O snapshot
  fica persistido no item, sem leitura dinâmica do preço atual. Em edição
  somente `DRAFT` é aceito: itens enviados são substituídos por
  `deleteMany`/`create`; sem novos itens, os snapshots existentes são usados.
  `apps/api/test/quotes.e2e-spec.ts` cobre snapshots, recálculo e bloqueio de
  campos protegidos e de edição fora de rascunho.
- Impacto: preservar preço manual comercial e itens livres; não assumir que
  `productId` comprova origem do preço. A referência futura de precificação
  precisa ser validada no backend e não pode ser anexada automaticamente a
  qualquer preço arbitrário recebido. Edição de rascunho deve preservar ou
  substituir essa origem de forma explícita.

#### 6. Conversão de orçamento em pedido

- Evidência: `apps/api/src/orders/orders.service.ts`, `createFromQuote`,
  bloqueia a organização, retorna pedido já existente para o orçamento e,
  quando novo, exige orçamento `APPROVED`. Seleciona fluxo ativo explícito
  ou padrão e sua primeira etapa ativa. Copia subtotal, desconto, total,
  notas e todos os campos comerciais dos itens em ordem, sem cálculo e sem
  consultar preço/custo atual do produto. Cria transição `CREATED` e auditoria.
- Evidência: `apps/api/test/orders.e2e-spec.ts` cobre preservação dos snapshots,
  isolamento, conversões concorrentes, permissões, etapas e fluxos.
  `OrderWorkflowsService.update` em
  `apps/api/src/order-workflows/order-workflows.service.ts` impede editar
  fluxos já usados; transições usam atualização condicional de estado/etapa.
- Impacto: acrescentar futuramente apenas a referência opcional ao snapshot
  copiado, mantendo o motor fora da conversão e dos fluxos operacionais.

#### 7. Concorrência e unicidade

- Evidência: `apps/api/src/products/lock-product.ts` executa SQL parametrizado
  `FOR UPDATE` com organização/UUID. Produtos e estoque compartilham esse
  bloqueio. SKU e código de barras são únicos por organização; `P2002` vira
  `409` em `ProductsService`. Nome de produto é indexado, não único.
- Evidência: `QuotesService.create` e `OrdersService.createFromQuote` usam
  bloqueio da organização antes de `max(number) + 1`. O schema também garante
  `[organizationId, number]`, um pedido por `[organizationId, quoteId]` e
  posições únicas por documento. Alterações/transições de orçamento usam
  bloqueio do orçamento; avanço/cancelamento de pedido usam `updateMany`
  condicionado ao estado e à etapa lidos, com `409` se outra operação venceu.
- Evidência: `OrderWorkflowsService` usa bloqueio organizacional para mudanças
  de fluxo padrão, com índice único parcial definido em
  `apps/api/prisma/migrations/20260923004913_enforce_one_default_order_workflow/migration.sql`;
  esse índice não é representado pelo `@@index` do schema. Períodos são únicos
  por organização/ano/mês; reversão de estoque usa `reversalOfId @unique`.
- Evidência: `apps/api/test/quotes.e2e-spec.ts`,
  `apps/api/test/orders.e2e-spec.ts` e `apps/api/test/inventory.e2e-spec.ts`
  usam `Promise.all` para exercitar disputas de numeração, conversão, etapas,
  saídas e reversões. `finance-settlements.e2e-spec.ts` cobre baixas concorrentes.
- Impacto: para versões, recomendar bloqueio por produto e unicidade por
  organização/produto/sequência. Não usar `max + 1` sem bloqueio. Adoção deve
  coordenar com o bloqueio usado pelo `PATCH`; transação isolada não impede
  todos os conflitos. Definir ordem de bloqueios antes de integrar múltiplos
  insumos, evitando deadlocks e contenção organizacional desnecessária.

#### 8. Padrões de API e frontend reutilizáveis

- Evidência: `apps/api/src/products/products.module.ts` importa `AuthModule`,
  registra controller/service; `DatabaseModule` é global. Controllers usam
  decorators Nest, `ParseUUIDPipe({ version: '4' })`, DTOs concretos e guards.
  DTOs usam `class-validator`/`class-transformer`, strings decimais com regex,
  trim e `ValidateIf` para campos anuláveis. Coleções usam `ValidateNested`
  e `Type` em `apps/api/src/quotes/dto/create-quote.dto.ts`.
  `app.setup.ts` aplica prefixo `/api`, transformação e rejeição de campos
  não declarados (`whitelist`/`forbidNonWhitelisted`).
- Evidência: services usam `PrismaService`, `select` explícito com
  `satisfies Prisma.*Select`, `Prisma.*GetPayload`, transações e exceções Nest
  `400`/`404`/`409`. `dto/list-products-query.dto.ts` normaliza filtros,
  booleanos e paginação (20 por padrão no service, máximo 100 no DTO).
- Evidência: `apps/web/src/lib/api.ts` centraliza fetch com cookie,
  `ApiError` e mensagens; arquivos `features/*/*-api.ts` validam respostas Zod.
  `features/products/use-product-query.ts` usa chave
  `['products', 'detail', productId]` e `enabled`; `use-update-product-mutation.ts`
  invalida `['products']` e atualiza o cache do detalhe.
- Evidência: reutilizar `Button`, `Input`, `Label`, `Card` e `Field` em
  `apps/web/src/components/ui/`; `ProductForm` como padrão de formulário
  textual validado, não como contêiner obrigatório de toda a precificação.
  `quote-form.tsx` oferece `useFieldArray`, seleção de catálogo, `useWatch` e
  prévia; `features/order-workflows/order-workflow-form.tsx` oferece
  adicionar/remover/reordenar coleções. Formulários usam React Hook Form e
  `zodResolver`; páginas usam `role="status"`/`role="alert"` e permissões da
  sessão. Não existe componente decimal ou editor de composição pronto.
- Impacto: seguir essas convenções e criar contratos específicos de
  precificação; não generalizar todos os módulos. `ApiError` atualmente não
  conserva código de erro/campo tipado, apenas mensagem/status: planejar a
  adaptação necessária para erros do motor no Marco 3.

#### 9. Rota e configuração organizacional

- Evidência: `apps/web/src/App.tsx` usa páginas lazy sob `/app`, protegidas por
  `ProtectedRoute`, e já possui `/app/produtos/:productId`.
  `apps/web/src/pages/product-page.tsx` reúne edição, preço e estoque.
  Não há página de configurações gerais da organização nem parâmetros de
  precificação no modelo `Organization` (que já possui moeda/timezone).
- Impacto: recomendar acesso a `/app/produtos/:productId/precificacao` a partir
  do detalhe, mantendo o preço atual visível. Configuração/perfis pertencem
  ao domínio `pricing` e à organização, não a `finance` ou ao produto.
  Recomendar `/app/produtos/precificacao/configuracao`, acessível pelo catálogo
  e pela precificação do produto, com escrita `OWNER`/`ADMIN`. São rotas
  propostas, ainda inexistentes; não criar área genérica de configurações
  como pré-requisito.

#### 10. Limites do financeiro e proteção de custos

- Evidência: `FinancialCategory.type` já distingue `FIXED_EXPENSE`,
  `VARIABLE_EXPENSE`, `REVENUE`; `CategoriesService` persiste essa classificação.
  Não é necessário inferir custo fixo pelo nome. `FinancialPeriod` já tem
  mês/ano/status e receita manual; `FinancialSettlement` possui valor,
  data e estorno. São bases para integração futura, não entradas obrigatórias.
- Evidência: `SummaryService.aggregateEntries` soma `FinancialEntry.amount`
  não cancelado, inclusive pendente; não soma recebimentos. O resumo pode usar
  `MANUAL_TOTAL`. Logo `totals.revenue` não é o agregado de receita realizada
  exigido pela ADR-004; um adaptador futuro deve considerar baixas ativas de
  receitas e a janela oficial, com origem/critério temporal registrado.
- Evidência: `quoteItemSelect`, `orderItemSelect` e `sourceQuoteSelect` limitam
  respostas aos campos comerciais. Não incluem `directCost` nem relação com
  o produto completo. Não há contrato público de compartilhamento/exportação
  comercial identificado nos controllers e APIs web desses módulos.
  Em contraste, `productSelect` inclui `directCost` para qualquer papel de
  leitura; ocultar custos apenas no React não restringe a API.
- Impacto: manter seleções comerciais explícitas e referência de versão
  opcional, sem expandir composição/resultados internos nas respostas de
  orçamento/pedido. Detalhes internos devem vir de endpoints de precificação
  autorizados. A política de leitura detalhada/histórico por papel ainda
  precisa ser definida, sem alterar silenciosamente a consulta de produtos.

#### 11. Testes, lacunas e documentação

- Evidência: `apps/api/vitest.config.ts` inclui `*.spec.ts` e
  `vitest.config.e2e.ts` inclui `*.e2e-spec.ts`. Unitários de produtos usam
  `Test.createTestingModule`, Prisma/transação simulados e `vi.fn`.
  E2e de produtos/orçamentos/pedidos/estoque usam aplicação Nest real,
  `configureApp`, Supertest, cookie, PostgreSQL e UUIDs descartáveis.
  Alteração de papel durante testes é restaurada em `finally`; limpeza é
  filtrada pelas organizações criadas, respeitando FKs e `AuditLog Restrict`.
  Não supor limpeza global ou paralelizar casos que compartilham sessão/papel.
- Evidência: `apps/web/vitest.config.ts` usa jsdom e setup; testes de página
  usam Testing Library/user-event, fetch simulado, MemoryRouter e QueryClient
  com retries desabilitados. `product-page.spec.tsx` cobre edição, `VIEWER`
  e estoque; `new-quote-page.spec.tsx` cobre cópia do catálogo e item vazio.
- Impacto: o motor terá specs puros próximos aos arquivos, sem aplicação Nest,
  banco ou mocks de PrismaService; e2e ficam para os marcos com persistência/API.
  Inspecionar testes existentes não equivale a executá-los nesta auditoria.
- Evidência: a matriz inicial marca `PREC-CA-042`/`043` como implementados por
  não haver precificação; também considera `PREC-CA-044` e `PREC-RN-045`
  concluídos pela existência de fluxos. Não existe operação de precificação
  testável para essas garantias. A matriz foi corrigida somente nesses estados
  e nas evidências comprovadamente imprecisas (auditoria e classificação fixa).
- Evidência: `docs/domains/pricing/calculation-specification.md` abre uma cerca
  de quatro crases no exemplo da seção 7 e fecha na seção 14, deixando seções
  intermediárias dentro do bloco de código no Markdown. O texto das fórmulas
  existe e foi inspecionado, mas a renderização precisa de revisão separada;
  a fonte oficial não foi alterada nesta tarefa.

### Marco 1 — Implementação e bloqueio dos exemplos — 02/10/2026 (histórico)

O bloqueio registrado abaixo foi resolvido em 03/10/2026, conforme a
descoberta seguinte. Os resultados da execução inicial são mantidos para
rastreabilidade; não representam o estado atual do marco.

- Estado inicial: `git status --short` sem saída, HEAD `71302b6`. Foram lidos
  integralmente AGENTS.md e todos os documentos exigidos para o marco antes
  das alterações. A correção da cerca Markdown da especificação já está
  presente nesse HEAD; a descoberta do Marco 0 descreve o estado anterior.
- Evidência técnica: `apps/api/tsconfig.json` usa TypeScript estrito,
  `nodenext` e ES2023; módulos internos usam extensão `.js`. Specs usam
  Vitest com globals e ficam junto ao código. O motor e seus testes em
  `apps/api/src/pricing/calculator/` não importam Nest ou Prisma.
- Representação: dependência direta `decimal.js` 10.6.0, clone privado por
  execução com configuração explícita e 160 dígitos significativos, strings
  nas fronteiras. Limites, arredondamento e resultados não aplicáveis estão
  registrados na ADR-005.
- Descoberta numérica: calcular o total a partir do custo periódico por
  minuto/frete pode introduzir resíduos na fronteira de um centavo. O motor
  mantém numeradores/denominadores finitos até formar base, preços e lucro;
  testes verificam cancelamento de dízimas, grandes produtos e divisores
  mensais próximos de zero. Nenhum valor de apresentação volta ao cálculo.
- **Bloqueio EX-001:** a especificação exige
  `LC = P - CB - DCF - DDV`. Os próprios valores do exemplo dão
  `90.91 - 50 - 9.091 - 9.091 = 22.728`, mas o exemplo exige `22.729`.
  A margem derivada é aproximadamente `25.00054999%`, enquanto o exemplo
  registra `25.0011%`. Não é possível cumprir ambos sem alterar fórmula ou
  fonte oficial. O teste conserva o lucro esperado da fonte e falha.
- **Bloqueio EX-002:** o lucro `35.3453` coincide com a fórmula, mas
  `35.3453 / 141.38 * 100 = 25.00021219...%`, ou `25.0002%` em quatro casas,
  não `25.0001%` como registrado no exemplo. O teste usa exatamente o
  percentual apresentado no documento, após arredondamento decimal de
  apresentação, e falha. A expectativa inicial de teste em oito casas foi
  substituída pela precisão apresentada na fonte, sem alterar o motor.
- Confirmação independente: cálculo em Node com clone de Decimal de 80
  dígitos, aplicando diretamente as subtrações e divisão da especificação,
  confirmou ambos os resultados acima sem chamar `calculatePricing`.
- Impacto: implementação afetada interrompida, exemplos e fórmulas oficiais
  preservados, sem escolher silenciosamente qual resultado deve prevalecer.
  Marco 1 **não concluído**. A revisão deve autorizar a resolução das
  divergências antes de ajustar expectativas ou considerar os exemplos
  aprovados. Marcos 2 em diante não foram iniciados.

### Marco 1 — Correção canônica validada — 03/10/2026

- A revisão matemática independente confirmou o motor e identificou erros
  documentais em EX-001/EX-002. O usuário autorizou corrigir exclusivamente
  as expectativas oficiais, preservando fórmula e implementação.
- Os resultados oficiais de EX-001 e EX-002 estão em
  `docs/domains/pricing/examples.md` e são verificados pelos testes em
  `apps/api/src/pricing/calculator/pricing-calculator.spec.ts`.
- EX-001: lucro exato `22.728`, exibido `22.73`; margem
  `22.728 / 90.91 = 0.250005499945...`, percentual
  `25.0005499945...%`, exibido `25.0005%` com quatro casas e `ROUND_HALF_UP`.
- EX-002: lucro exato permanece `35.3453`; margem
  `35.3453 / 141.38 = 0.250002121940...`, percentual
  `25.000212194...%`, exibido `25.0002%` com quatro casas e `ROUND_HALF_UP`.
- Os testes verificam lucro, prefixos decimais das margens sem tolerância de
  ponto flutuante e apresentação percentual com arredondamento explícito.
  Não foi introduzido arredondamento intermediário.
- Impacto: os 77 testes do motor e todos os 98 testes unitários da API
  passaram. Typecheck e lint também passaram. Somente após esses resultados
  o bloqueio foi removido e o Marco 1 foi marcado como concluído.
  ADR-005, dependências e o restante da implementação foram preservados.

### Marco 2A — Direção de persistência aprovada — 03/10/2026

- Baseline confirmado: `main`, commit `00b4cd8`, árvore limpa. A auditoria da
  proposta inspecionou schema, migrations, motor e padrões existentes; esta
  etapa registra a revisão aprovada, sem executar banco ou implementar código.
- Evidência: `docs/architecture/decisions/ADR-006-pricing-persistence-model.md`
  consolida as decisões de revisões, precedência, custos, snapshots, adoção,
  precisão, isolamento, finalização e autorização futura.
- Componentes `CATALOG` precisam resolver `Product.directCost` atual; um custo
  persistido obrigatório na composição seria uma fonte ambígua. A composição
  passa a prever `costSource`, `sourceProductId` e `storedUnitCost` condicionais;
  versões congelam `effectiveUnitCost`, resolvido pelo backend. Para `CATALOG`,
  vem do `Product.directCost` atual; `storedUnitCost` fica nulo e nunca é cache.
- `PricingPriceAdoption.previousPrice`/`newPrice` devem acompanhar
  `Product.salePrice` em `Decimal(14,2)`. Resultados maiores continuam válidos
  em Text/JSONB, mas não são adotáveis nesse campo; não ampliar nem truncar.
- E2E de produtos possuem limpeza filtrada; os de orçamentos/pedidos apenas
  encerram a aplicação. Imutabilidade SQL exige bancos de teste descartáveis
  e credenciais separadas, sem bypass de produção para remover histórico.
- Impacto: a proposta foi aprovada como direção arquitetural. Persistência e
  critérios relacionados continuam pendentes; README atualizado para refletir
  a entrega do motor no Marco 1. Fórmulas, exemplos e rastreabilidade preservados.

### Marco 2B.1 — Guards transacionais e PostgreSQL real — 04/10/2026

- Evidências: `apps/api/prisma/schema.prisma`,
  `apps/api/prisma/migrations/20261003181002_add_pricing_persistence/migration.sql`
  e `apps/api/test/pricing/persistence-postgres.cjs`. Os 11 modelos e sete enums
  conceituais são preservados. A migration permanece não aplicada no banco normal.
- A revisão identificou que guards independentes não garantiam a atomicidade de
  adoção e revisão. A migration captura o estado anterior real do produto sob
  lock e exige, no fechamento da transação, evento, versão finalizada e estado
  final compatíveis. As duas ordens de escrita passam; preço manual com ponteiro
  final nulo continua permitido. `AuditLog` permanece responsabilidade do serviço.
- Revisões novas devem tornar-se atuais na mesma transação; ponteiros históricos
  não podem ser restaurados arbitrariamente. Deduções só podem ser inseridas
  durante a construção da revisão. Duas tabelas técnicas privadas em
  `pricing_internal`, distintas dos modelos de domínio, registram o trabalho
  transacional e são esvaziadas pelos guards diferidos. A estratégia substitui
  `xmin`/`pg_xact_status`, usa o identificador da transação principal e preserva
  rollback de savepoints. A ADR-006 registra explicitamente essa decisão.
- A identidade e os metadados de criação da composição são imutáveis; edição
  legítima exige incremento da revisão. O guard de catálogo rejeita explicitamente
  custo negativo, além dos demais critérios aprovados.
- O contrato oficial ainda não define um caminho JSON para `snapshotSchemaVersion`.
  Não foi inventado um caminho. O banco exige coluna positiva e coerência das
  projeções previstas; correspondência completa e validação runtime do contrato
  continuam no Marco 3. A migration não garante essa parte.
- A suíte realizou 198 verificações em dois bancos exclusivos descartáveis:
  replay completo vazio e baseline com organizações, usuários, produtos,
  orçamento e pedido. Deploy normal do Prisma aplica a migration uma única vez;
  snapshots comerciais existentes permanecem inalterados. Foram comprovados
  bloqueios de mutações históricas, adoções inconsistentes, revisões sem ponteiro,
  deduções tardias, alterações de identidade e catálogo inválido, incluindo
  savepoints. O custo negativo também é rejeitado pelo CHECK existente de Product.
- Todas as funções da migration usam `search_path = pg_catalog, public, pg_temp`
  e qualificam explicitamente relações e funções próprias. Sessões novas da role
  da aplicação criaram tabelas temporárias homônimas antes da primeira chamada e
  não conseguiram desviar os guards de versão `BUILDING`, projeções, adoção,
  catálogo ou preço analisado das relações reais em `public`.
- Alterações de componentes agora participam do controle transacional da
  composição: criação inicial permanece na revisão 1; inserção, atualização ou
  exclusão posterior exige exatamente um incremento do pai, em qualquer ordem e
  também quando há várias alterações. Identidade, organização, composição pai e
  data de criação do componente são imutáveis. Savepoints não deixam estado
  privado residual.
- Testes com duas conexões independentes comprovaram serialização de revisões da
  mesma configuração sem órfãos, duas adoções concorrentes como transições reais
  sucessivas e apenas uma edição de composição vencedora para a mesma revisão
  esperada. Idempotência de retry de adoção permanece decisão do Marco 3; não foi
  criada unicidade nova nesta migration.
- O baseline anterior já impede custo direto negativo por CHECK. Essa limitação
  foi comprovada sem enfraquecer migrations antigas; o teste mais direto mantém
  custo real zero, cria uma origem temporária homônima com custo negativo e prova
  que o guard consulta `public.products`, além de verificar sua condição explícita.
- Credenciais separadas da aplicação não têm DDL nem acesso às tabelas técnicas;
  tentativas de acesso e desativação de triggers são rejeitadas. Os bancos criados
  foram removidos após conferir nome exclusivo e marcador de propriedade.
- Impacto: registrar evidências SQL sem declarar persistência/API/interface
  concluídas. A matriz de rastreabilidade permanece preservada; serviços,
  autorização por papel, auditoria e contrato runtime ainda não foram entregues.

### Fundação de persistência versionada — 05/10/2026

- O commit `9427866` versionou o schema e a migration
  `20261003181002_add_pricing_persistence` revisados no Marco 2B.1; o commit não
  representa a aplicação da migration em qualquer banco.
- Em 04/10/2026, a migration foi aplicada somente ao banco local de
  desenvolvimento. Essa validação local mostrou 16 migrations e banco
  atualizado e sucede os relatos anteriores daquela execução nos quais a
  migration ainda aparecia pendente. O estado de outros ambientes não foi
  verificado.
- A fundação contém modelos, relações, constraints e guards transacionais. Não
  existem ainda services, endpoints ou interface de precificação; esses casos
  de uso continuam nos Marcos 3 e 4.

### Marco 3A — Contrato e segurança da API — 04/10/2026

- A API existente usa sessão, `@OrganizationRoles(...)`, DTOs com rejeição de
  campos desconhecidos, respostas diretas, transações Prisma e auditoria na
  mesma transação. Não existe hoje um filtro global com códigos estáveis de
  domínio.
- `GET` de produtos atualmente inclui `directCost` para qualquer usuário
  autenticado. O Marco 3 restringirá explicitamente o endpoint legado:
  `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE` recebem o campo; `VIEWER` não.
  Selects separados e testes de não vazamento cobrirão essa compatibilidade.
- O banco já fornece raízes/revisões, snapshots, projeções e guards, mas a API
  precisa construir e validar o snapshot v1, recalcular no backend e traduzir
  conflitos para um contrato HTTP estável.
- Simulação não altera estado e não será auditada. Versões, revisões, composição,
  adoção e mudança manual de preço terão auditoria atômica e metadados mínimos.
- Adoção repetida enquanto produto, versão e preço já coincidirem é idempotente
  e não cria novo evento. O Marco 3 usará somente estado atual e lock do produto,
  sem `Idempotency-Key` ou nova persistência.
- Impacto: a ADR-007 fixa endpoints, permissões, autoridade do backend, snapshot,
  erros, locks e a divisão 3B/3C/3D antes de qualquer código funcional.

### Marco 3B.1 — Configuração organizacional — 05/10/2026

- `PricingModule` passou a expor somente `GET` e `PATCH`
  `/api/pricing/configuration`. O contrato usa os guards existentes e um filtro
  local para códigos estáveis, sem modificar respostas dos demais domínios.
- `PATCH` cria a raiz, a primeira revisão e o ponteiro corrente na mesma
  transação, ou cria uma revisão imutável depois de bloquear a raiz e comparar
  `expectedRevision`. A criação inicial bloqueia a organização. Testes com duas
  requisições independentes comprovaram um único vencedor em ambas as disputas.
- Strings decimais são validadas quanto a sintaxe, sinal, precisão e escala
  antes de chegarem ao Prisma. Não há coerção de `number`, expoente,
  arredondamento ou truncamento. A resposta converte explicitamente todos os
  campos decimais para string.
- `parameterOrigins` é um patch parcial por parâmetro. Origens de valores
  inalterados são preservadas; valores criados ou alterados exigem a origem
  correspondente, cujo confirmador é sempre o ator da sessão. Valores
  removidos e campos que deixam de se aplicar ao modo de custo fixo perdem
  também a origem. Origens desconhecidas, incompatíveis ou com confirmador
  enviado pelo cliente são rejeitadas.
- Decimais são comparados por valor canônico e proveniências por JSON com chaves
  ordenadas. Depois do lock e da validação da revisão esperada, um estado
  resolvido idêntico retorna a revisão atual sem nova revisão ou auditoria;
  revisão esperada obsoleta continua retornando conflito.
- Cada revisão confirmada gera exatamente um
  `pricing_configuration.updated` na mesma transação. O metadata contém somente
  operação, configuração, revisões e nomes dos campos alterados, sem valores
  financeiros.
- A execução direcionada aprovou 18 testes unitários e 16 testes E2E. Os E2E
  cobrem autenticação, todos os papéis, isolamento, validação, merge e remoção
  de proveniência, no-op, preservação histórica, auditoria, rollback e
  concorrência. Um runner exclusivo cria um banco PostgreSQL, aplica as 16
  migrations pelo Prisma e remove o banco em `finally`; uma prova separada
  confirma a remoção também quando a execução interna falha. Perfis,
  composição, cálculo HTTP, snapshots, versões, histórico, adoção, produtos e
  web permanecem fora desta subetapa.

## Decisões tomadas

### Custos fixos

O percentual de custos fixos participa do divisor da formação do preço,
conforme `ADR-001`.

### Dinheiro e arredondamento

Cálculos usam representação decimal. Preços mínimo e sugerido comerciais são
arredondados para cima até o próximo centavo, conforme `ADR-002`.

### Histórico

Cálculos salvos são versões imutáveis e documentos comerciais preservam
snapshots, conforme `ADR-003`.

### Dados financeiros

O motor recebe valores consolidados e não consulta diretamente lançamentos
durante a fórmula, conforme `ADR-004`.

Novas decisões estruturais devem ser registradas em ADR antes de serem
aplicadas.

### Representação do motor puro — Marco 1

`docs/architecture/decisions/ADR-005-pure-pricing-decimal.md` registra a escolha
técnica autorizada de decimal.js, clone local, precisão, limites de entrada,
avaliação de frações, strings e arredondamento. Dados monetários exatos e de
apresentação são separados. Margem efetiva para preço zero e desconto para
sugerido zero são `null`; não se cria preço adotado quando ele está ausente.
Arrays preservam a ordem de entrada. O motor analisa preços e devolve avisos,
mas não adota preços, grava histórico ou autoriza usuários.

Em 03/10/2026, a revisão independente e a autorização explícita do usuário
confirmaram a fórmula existente e a correção documental de EX-001/EX-002,
sem mudança de regra de negócio ou de precisão intermediária.
Precisão e representação antes abertas no Marco 0 estão tratadas pela ADR-005.
As decisões posteriores de persistência e leitura interna estão registradas
na ADR-006, abaixo; origem dos itens comerciais e prévia web continuam
para os marcos correspondentes.

### Persistência aprovada — Marco 2A

A [ADR-006](../architecture/decisions/ADR-006-pricing-persistence-model.md)
registra a direção aprovada em 03/10/2026. As decisões abaixo complementam o
Marco 1 e resolvem os pontos correspondentes da auditoria histórica:

- Ativação explícita e imediata; `effectiveFrom` definido pelo backend, sem
  agendamento. Alterações criam revisões imutáveis e movem `currentRevisionId`
  atomicamente, com numeração sob bloqueio da raiz.
- Margem da composição sobrescreve a global; ausência nos dois níveis rejeita
  cálculo. Perfil selecionado fornece deduções; snapshot preserva precedência
  e origem dos valores efetivos.
- `MANUAL`/`COPIED` exigem `storedUnitCost` e `sourceProductId` nulo.
  `CATALOG` exige `storedUnitCost` nulo e `sourceProductId` obrigatório, com
  item ativo da mesma organização, custo atual presente e unidade compatível;
  rejeitar autorreferência. `effectiveUnitCost` é resolvido pelo backend e
  congelado no snapshot e em `PricingVersionComponent`; para `CATALOG`, vem
  do `Product.directCost` atual, sem cache em `storedUnitCost`. Não converter
  unidades automaticamente.
- `PATCH` que informe `salePrice`, inclusive igual ou nulo, passa a origem a
  manual e limpa a referência; omissão preserva origem e valor. Implementação
  e auditoria dessa integração permanecem para a API posterior.
- Adoção aceita somente versão finalizada do mesmo produto/organização, com
  fórmula e contrato suportados, reexecução das entradas congeladas e
  consistência verificada. Reutilizar versão somente quando o preço escolhido
  for exatamente igual ao `analyzedPrice` congelado. Sem preço manual, esse
  valor normalmente corresponde a `suggestedPriceCommercial`. Se o sugerido
  diferir de `analyzedPrice`, sua adoção exige nova execução com esse preço
  como `adoptedPrice` e nova versão; qualquer outro preço também exige novo
  cálculo e versão. Classificação, decomposição, deduções, lucro e margem
  congelados devem corresponder ao preço efetivamente adotado.
  `PricingPriceAdoption` referencia a versão que contém a análise de `newPrice`;
  nunca modificar a versão anterior para acomodar outra adoção.
- Entradas `Decimal(19,6)`, taxas `Decimal(12,8)`, resultados em Text/JSONB;
  eventos de adoção usam `Decimal(14,2)`. Preservar limite do catálogo, proibir
  truncamento e restringir moeda a BRL com check na migration versionada.
- Snapshot JSONB canônico com `input`, `result`, `context` e contrato validado
  em runtime; todos os decimais são strings. Projeções e colunas-resumo são
  criadas do mesmo objeto e não substituem o snapshot.
- Versão nasce `BUILDING`, recebe snapshot/projeções e finaliza uma única vez
  na mesma transação. Counts/posições/correspondência são verificados; SQL
  impede alterações e novas projeções após `FINALIZED` e commit com `BUILDING`.
- FKs comprovam organização/raiz/revisão nos ponteiros e organização/produto/
  versão na adoção. Raiz, primeira revisão e ponteiro são criados juntos.
- Bloqueios seguem configuração, perfis por UUID e produtos por UUID.
  Composição exige `expectedRevision`; versões/adoção bloqueiam produto.
- Raízes são desativadas e histórico usa `Restrict`, sem exclusão física.
  Testes/migrations usam bancos descartáveis e administração separada;
  nenhum endpoint ou bypass de produção para limpeza.
- Para o Marco 3: `OWNER`/`ADMIN` têm leitura/escrita completas; `OPERATIONS`
  têm leitura completa e escrita operacional permitida; `FINANCE` tem leitura
  interna completa sem escrita; `VIEWER` vê somente dados comerciais, sem
  custos/margens/lucro/decomposição/histórico interno. Abaixo do mínimo somente
  `OWNER`/`ADMIN`, com confirmação e justificativa.

O contrato atual de `Product` ainda expõe `directCost` ao `VIEWER`. A ADR-007
aprovou sua restrição explícita no Marco 3, com selects por autorização e testes
de não vazamento. Origem comercial de itens, prévia web e integrações financeiras
futuras continuam abertas nos marcos correspondentes.

### Contrato e segurança da API — Marco 3A

A [ADR-007](../architecture/decisions/ADR-007-pricing-api-contract.md) define a
fronteira HTTP antes da implementação:

- rotas sob `/api/pricing`, separando o resumo comercial dos contratos internos;
- leitura interna para `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE`, escrita de
  configuração/perfis para `OWNER`/`ADMIN`, escrita operacional para
  `OWNER`/`ADMIN`/`OPERATIONS` e adoção abaixo do mínimo somente para
  `OWNER`/`ADMIN`;
- `salePrice` manual somente para `OWNER`/`ADMIN`; `OPERATIONS` pode adotar uma
  versão igual ou superior ao mínimo, mas não informar preço manual;
- organização e ator sempre derivados da sessão, entradas recarregadas e motor
  executado pelo backend em todo salvamento ou adoção;
- `PricingSnapshotV1` canônico com tipos persistidos próprios, opcionais
  materializados como `null`, proveniência v1 validada, margem selecionada e
  contexto congelado;
- erros HTTP estáveis, sem dados internos, e `404` indistinguível para recurso
  inexistente ou pertencente a outra organização;
- retry do estado já adotado retorna sucesso sem duplicar evento; uma nova
  adoção depois de transição intermediária é uma decisão comercial nova;
- ordem de locks configuração, perfis por UUID e produtos por UUID, com revisões
  esperadas e conflitos convertidos em `409`;
- eventos de auditoria definidos para revisões, composição, versão, adoção e
  preço manual; a justificativa fica somente em `PricingPriceAdoption`, e o
  `AuditLog` referencia a adoção sem duplicar o texto; simulações não geram
  auditoria;
- implementação dividida em 3B (configuração/perfis), 3C
  (composição/cálculo/snapshot/histórico) e 3D (adoção/preço manual).

Não há decisão essencial pendente para os Marcos 3B a 3D. A ADR-007 consolidou
idempotência por estado, restrição de `directCost`, preço manual e separação da
justificativa entre `PricingPriceAdoption` e `AuditLog`. As decisões ainda
abertas bloqueiam somente a prévia web do Marco 4 e a origem comercial dos itens
do Marco 5.

### Configuração HTTP versionada — Marco 3B.1

- O contrato de erros de precificação é traduzido por filtro aplicado somente ao
  controller do domínio. Erros inesperados retornam `INTERNAL_ERROR` sem stack,
  SQL, constraint ou código Prisma; autenticação e autorização reutilizam os
  guards existentes.
- A criação usa lock da organização; atualizações usam lock da raiz da
  configuração. `expectedRevision: null` identifica somente a criação inicial,
  e revisão positiva identifica atualização. Estado desatualizado retorna
  `PRICING_REVISION_CONFLICT`; falhas concorrentes conhecidas do Prisma retornam
  `PRICING_CONCURRENT_MODIFICATION`.
- `effectiveFrom` e o confirmador da proveniência são definidos pelo backend.
  Campos de custo fixo que não se aplicam ao modo escolhido são persistidos como
  `null`; custo mensal de mão de obra e horas produtivas formam um par.
- Proveniências são mescladas por parâmetro. Uma mudança de valor exige origem
  na mesma requisição; a confirmação anterior nunca é atribuída a um valor
  novo. Remoção do valor e mudança do modo de custo fixo eliminam origens
  inaplicáveis. Metadados adicionais permanecem opcionais porque os documentos
  do domínio não os tornam obrigatórios por tipo de origem.
- A comparação de estado ocorre após normalização decimal e canonicalização de
  JSON. No-op confirmado sob lock retorna `200` sem revisão nem `AuditLog`, mas
  não contorna a validação de `expectedRevision`.
- A implementação usa a raiz e as revisões já aprovadas, sem alterar schema,
  migration, fórmula ou configuração decimal global.

### Diretrizes confirmadas na auditoria — 02/10/2026

- Manter os contratos financeiros como strings decimais; `number` fica
  restrito a paginação e outros dados não financeiros. Reutilizar o padrão
  decimal existente sem copiar seus modos de arredondamento indiscriminadamente.
- Manter `Product.salePrice` e o cadastro manual, conforme ADR-003. Salvar
  composição, simular e salvar versão não atualizam esse campo. Adoção exige
  transação que una preço, origem e auditoria, coordenada com `lockProduct`.
- Reutilizar `SessionAuthGuard`, `OrganizationRolesGuard`, DTOs validados,
  seleções explícitas e auditoria na transação. Não adicionar um sistema novo
  de autenticação ou uma camada genérica de repositórios para o domínio.
- Aplicar a matriz já oficial: configuração/perfis por `OWNER`/`ADMIN`;
  composição, simulação, versões e adoção acima/igual ao mínimo também por
  `OPERATIONS`; abaixo do mínimo somente `OWNER`/`ADMIN`, com confirmação e
  justificativa. `FINANCE` não possui escrita. `OPERATIONS` não informa
  `salePrice` manualmente. A ADR-007 resolveu a leitura dos contratos novos e
  legados: `FINANCE` pode consultar dados internos; `VIEWER` recebe somente
  projeção comercial e produtos sem `directCost`, decomposição, custos ou
  histórico financeiro.
- Preservar os snapshots comerciais e copiar a origem opcional na conversão,
  sem motor em `OrdersService` e sem expansão automática de custos internos.
- Na primeira entrega utilizar parâmetros manuais com origem registrada;
  agregados financeiros permanecem evolução posterior conforme escopo/ADR-004.
  Não reutilizar receita do resumo atual como receita efetivamente recebida.

Essas diretrizes confirmam regras/ADRs existentes e padrões do repositório.
As recomendações de arquivos, módulos e rotas abaixo são planejamento técnico,
não novos contratos implementados ou decisões de negócio aprovadas.

### Recomendações de limites e caminhos

Recomenda-se um módulo `pricing`, como os demais domínios, com pastas internas
por responsabilidade. Não há necessidade comprovada de vários módulos Nest
ou de um novo pacote compartilhado no Marco 1. O motor recebe valores
consolidados; autenticação, organização, carga de insumos/configuração e
transações pertencem à aplicação. Identificadores podem acompanhar entradas
para rastreabilidade, mas o motor puro não consulta nem valida posse no banco.

| Limite                                | Responsabilidade                                                        | Caminhos atuais ou planejados                                                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motor puro — Marco 1                  | `margin-divisor-v1`, validação matemática, memória e erros tipados      | `apps/api/src/pricing/calculator/pricing-calculator.ts`, `pricing-calculator.types.ts`, `pricing-calculator.errors.ts`, `pricing-calculator.spec.ts`; adaptador `pricing-decimal.ts` somente se necessário                                                      |
| Aplicação — Marco 3                   | Orquestrar configuração/perfis, composição, simulação, versões e adoção | Estrutura aprovada na ADR-007: `pricing.module.ts`, `contracts/`, `dto/`, `errors/`, `controllers/`, `services/` e `pricing-locks.ts`                                                                                                                           |
| Configuração organizacional — Marco 2 | Parâmetros com vigência/origem e perfis organizacionais                 | Modelos implementados em `apps/api/prisma/schema.prisma`: `OrganizationPricingConfiguration`, revisões, `PricingSalesProfile`, revisões e `PricingDeduction`; services planejados na ADR-007                                                                    |
| Composição e histórico — Marco 2      | Composição editável, componentes e versões autossuficientes/imutáveis   | Modelos implementados `ProductPricingComposition`, `PricingComponent`, `PricingCalculationVersion`, projeções e `PricingPriceAdoption`; referência opcional do produto implementada, casos de uso ainda pendentes                                               |
| Web — Marco 4                         | Contratos Zod, queries/mutations e formulários específicos              | `apps/web/src/features/pricing/pricing-api.ts`, `use-*-query.ts`, `use-*-mutation.ts`, `pricing-composition-form.tsx`, `pricing-configuration-form.tsx`, `pricing-history.tsx`; `apps/web/src/pages/product-pricing-page.tsx`, `pricing-configuration-page.tsx` |
| Integração comercial — Marco 5        | Validar/capturar origem e copiar snapshot sem custos                    | Extensões localizadas em `apps/api/src/quotes/quotes.service.ts`, `apps/api/src/orders/orders.service.ts`, DTOs e `apps/web/src/features/quotes/`; sem alterações nos fluxos                                                                                    |
| Validação posterior                   | Permissões, isolamento, imutabilidade, concorrência e não regressão     | `apps/api/test/pricing.e2e-spec.ts`, testes existentes de produtos/orçamentos/pedidos; specs web próximos às páginas/features                                                                                                                                   |

Configuração deve ser recurso de precificação associado à organização, com
vigência, origem, ator e data; não acrescentar parâmetros financeiros soltos
à sessão ou ao cadastro do produto. Recomenda-se separar configuração atual
das cópias completas em versões, sem determinar nesta auditoria a modelagem
de todas as revisões de configuração. Para a API, a ADR-007 aprovou caminhos
sob `/api/pricing/configuration`, `/api/pricing/profiles` e
`/api/pricing/products/:productId/...`; o controller recebe organização da
sessão, nunca do corpo.

### Decisões abertas e riscos antes da implementação

Os itens abaixo registram a auditoria de 02/10/2026. Para o estado atual,
consultar a representação do Marco 1 (ADR-005) e a direção aprovada do Marco 2A
(ADR-006): leitura interna por papel, vigência, fonte de custos, limites na
adoção, preço manual e concorrência da composição já possuem decisões.
A origem dos itens comerciais e a revisão do contrato atual de produtos
permanecem trabalhos posteriores; preservar o registro histórico não os
reabre nem significa implementação.

1. **Leitura de custos e histórico — resolvida no Marco 3A:** `FINANCE` terá
   leitura interna e `VIEWER` somente projeção comercial. O Marco 3 também
   removerá `directCost` das respostas legadas para `VIEWER`, mantendo o campo
   para `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE`, com selects separados e
   testes de compatibilidade.
2. **Precisão e biblioteca decimal:** a API usa `Prisma.Decimal`, sem
   configuração explícita de precisão identificada no código funcional;
   `apps/api/package.json`/`apps/web/package.json` não declaram biblioteca
   decimal autônoma. Há `decimal.js` transitiva no lockfile, o que não a torna
   contrato de dependência do projeto. Antes de codificar o Marco 1, definir
   representação, precisão significativa, limites de entrada, serialização
   dos resultados de divisões e estratégia decimal sem estado global.
   Recomenda-se um adaptador local restrito que não importe PrismaService,
   tipos de entidades ou cliente de banco; avaliar o custo de dependência
   do export gerado de Decimal versus biblioteca explícita. O arquivo
   `apps/api/src/generated/prisma/client.ts` importa a classe do cliente e
   `internal/prismaNamespace.ts` reexporta `runtime.Decimal`; importar o
   cliente gerado inteiro não é uma dependência puramente matemática.
   Não importar arquivos internos gerados como atalho. Não houve
   instalação nem escolha definitiva de biblioteca nesta auditoria.
3. **Prévia local única:** a web não possui biblioteca decimal própria nem
   pacote compartilhado existente. Os helpers `bigint` de orçamento são
   adequados ao contrato atual, mas não substituem o motor de margem divisora.
   Antes do Marco 4, decidir extração do motor para pacote puro ou estratégia
   equivalente testada, preservando `PREC-CA-027` (100 ms) e sem manter duas
   fórmulas manuais. Não criar pacote compartilhado antecipadamente.
4. **Limite do preço adotado:** novos resultados podem exceder os 12 dígitos
   inteiros de `Product.salePrice`/itens comerciais. Definir rejeição explícita
   por faixa na adoção ou migration justificada posterior; nunca truncar,
   reduzir escala nem alterar campos existentes nesta auditoria. O motor
   precisa de casos de borda para divisores próximos de zero e valores grandes.
5. **Origem comercial:** definir como um orçamento editável reconhece preço
   proveniente de versão quando há preço manual, desconto, seleção antiga no
   navegador ou mudança concorrente do produto. Igualdade de preço isolada
   não prova origem. A referência deve representar uma versão válida da mesma
   organização/produto e o significado comercial escolhido, sem invalidar
   itens livres ou preços manuais atuais. Também definir tratamento explícito
   da referência atual quando o preço for substituído via `PATCH` manual,
   inclusive remoção com `null`, conforme a distinção exigida pela ADR-003.
6. **Vigência e adoção de versão:** as regras exigem vigência e imutabilidade,
   mas não detalham agendamento futuro/sobreposição de configurações nem toda
   a seleção de versão antiga para adoção. ADR-003 exige recálculo ao salvar
   ou adotar e admite criar/identificar versão. Definir contrato que preserve
   snapshots e preço adotado sem editar versão antiga ou substituí-la
   silenciosamente por parâmetros atuais. Revisar no desenho da persistência/API.
7. **Custos referenciados:** o catálogo fornece `directCost` opcional, unidade
   livre e ativação; não fornece conversão de unidades ou custo médio de
   estoque. Definir tratamento de insumo sem custo/inativo, custo manual de
   referência e referências ao próprio produto/ciclos antes da composição.
   Não interpretar custo ausente como zero nem implementar explosão recursiva
   de composições sem regra aprovada. O Marco 1 só opera valores consolidados.
8. **Imutabilidade e concorrência:** definir proteção de versões contra
   atualização/exclusão, unicidade, ordem de bloqueios e comportamento de
   adoções concorrentes antes do Marco 2. O padrão atual serializa updates,
   mas não possui controle geral de formulário desatualizado. ADR-003 exige
   consistência integral da versão vencedora; política adicional de conflito
   para edição desatualizada não deve ser inventada silenciosamente.
9. **Casos matemáticos sem resultado definido:** a especificação determina
   não calcular margem em preço zero e restringe desconto a sugerido positivo;
   decidir representação tipada dessa ausência (por exemplo, valor anulável)
   no contrato do Marco 1. Não retornar NaN/Infinity nem inventar margem zero.
   Campos financeiros negativos são proibidos na entrada; lucro/margem de
   resultado podem ser negativos e precisam de representação compatível.
10. **Evidência de auditoria:** a auditoria atual de produto não comprova
    preço anterior/novo. Novas adoções e substituições deverão acrescentar
    esse conteúdo sem duplicar ações indevidamente. Não transportar custos
    internos para metadata exposta em contratos comerciais.

As decisões de negócio abertas precisam de revisão explícita no marco que
depende delas. Não bloqueiam a conclusão da auditoria; nenhuma foi resolvida
por alteração funcional. Decisões estruturais novas exigem ADR antes de
aplicação, conforme a regra deste plano.

## Estado atual do repositório

A API NestJS está localizada em `apps/api`.

A aplicação React está localizada em `apps/web`.

A persistência utiliza Prisma e PostgreSQL.

Existem módulos de API para:

- autenticação;
- clientes;
- produtos;
- estoque;
- financeiro;
- orçamentos;
- pedidos;
- fluxos de pedidos.

Existem funcionalidades web equivalentes.

O schema possui a fundação de precificação definida na ADR-006 e versionada no
commit `9427866`. A migration correspondente foi aplicada somente ao banco local
de desenvolvimento na validação de 04/10/2026; não há afirmação sobre outros
ambientes. O módulo funcional, os services, os endpoints e a interface ainda não
existem.

Produtos, orçamentos e pedidos existentes devem permanecer válidos após as
migrations.

## Restrições de execução

Durante a implementação:

- preserve alterações do usuário não relacionadas;
- não reescreva módulos existentes sem necessidade;
- não utilize `number` como fonte de verdade financeira;
- não confie em totais calculados pelo frontend;
- valide todos os relacionamentos pela organização autenticada;
- não recalcule documentos históricos;
- não crie lançamentos financeiros a partir de uma simulação;
- não gere movimentações de estoque durante a precificação;
- não altere fluxos configuráveis de pedidos;
- não invente requisitos ausentes;
- registre decisões materiais neste plano ou em ADR;
- mantenha migrations compatíveis com dados existentes.

Não faça commits automaticamente, salvo quando isso for solicitado
explicitamente. Ao concluir um marco, deixe as mudanças prontas, validadas e
informe os arquivos modificados.

## Marco 0 — Auditoria técnica

### Objetivo

Confirmar os padrões existentes antes de definir modelos e contratos.

### Inspeções obrigatórias

Inspecione:

- `apps/api/prisma/schema.prisma`;
- módulos de produtos;
- módulos de estoque;
- módulos financeiros;
- módulos de orçamentos;
- módulos de pedidos;
- módulos de fluxos;
- autenticação e autorização;
- auditoria;
- serialização decimal;
- schemas e APIs equivalentes no frontend;
- formulários e componentes reutilizáveis;
- testes unitários e e2e relacionados.

### Perguntas que a auditoria deve responder

1. Como valores decimais são persistidos e serializados?
2. Como o preço atual do produto é atualizado?
3. Quais papéis podem alterar produtos?
4. Como a API valida recursos de outra organização?
5. Como as ações são gravadas em `AuditLog`?
6. Como itens de orçamento preservam snapshots?
7. Como esses itens são copiados para pedidos?
8. Quais restrições protegem criação concorrente?
9. Quais componentes de formulário podem ser reutilizados?
10. Qual rota de interface oferece a melhor integração com produtos?

### Resultado

Atualize:

- `Descobertas`;
- `Decisões tomadas`;
- caminhos e nomes propostos neste plano;
- matriz de rastreabilidade.

Não implemente migration antes de concluir essa auditoria.

### Respostas e critério de encerramento — 02/10/2026

| Pergunta                 | Resposta e evidência registrada em Descobertas                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Decimais              | PostgreSQL `Decimal`, Prisma.Decimal/centavos bigint, JSON textual com normalização variável; descoberta 1                      |
| 2. Preço atual           | POST/PATCH de produto com string ou null, update sob bloqueio e auditoria, sem cálculo; descoberta 2                            |
| 3. Papéis                | Escrita OWNER/ADMIN/OPERATIONS; leitura dos cinco papéis autenticados; descoberta 3                                             |
| 4. Outra organização     | Organização da sessão, consultas filtradas e validação de relações, FKs compostas onde existentes; descoberta 3                 |
| 5. AuditLog              | Criação explícita no service na transação, sem serviço central; metadata monetária textual; descoberta 4                        |
| 6. Snapshot de orçamento | Campos comerciais recebidos e totais recalculados; itens persistidos independentes do cadastro, rascunho editável; descoberta 5 |
| 7. Cópia para pedido     | `OrdersService.createFromQuote` copia itens/totais de orçamento aprovado, sem recálculo; descoberta 6                           |
| 8. Concorrência          | Bloqueios por produto/organização/documento, restrições únicas e updates condicionais, testes com disputas; descoberta 7        |
| 9. Formulários           | React Hook Form/Zod, componentes UI, `useFieldArray`/`useWatch` em orçamento e fluxos; descoberta 8                             |
| 10. Rota                 | Recomendada `/app/produtos/:productId/precificacao`, ligada ao detalhe existente; descoberta 9                                  |

Auditoria concluída com evidências estáticas, limites, riscos e caminhos
propostos. Correções na matriz refletem a inspeção, sem marcar requisitos novos
como entregues. Não foi iniciada implementação do Marco 1. O próximo passo é
revisar este resultado; só depois, em tarefa própria, definir os contratos e
a precisão do motor e implementar os exemplos oficiais.

## Marco 1 — Motor matemático puro

### Objetivo

Implementar `margin-divisor-v1` sem depender de banco, HTTP ou React.

### Localização esperada

A auditoria do Marco 0 recomenda manter o motor puro no domínio de
precificação da API, seguindo arquivos de teste próximos ao código:

```text
apps/api/src/pricing/
  calculator/
    pricing-calculator.ts
    pricing-calculator.types.ts
    pricing-calculator.errors.ts
    pricing-calculator.spec.ts
```

Usar imports ESM com extensão `.js`, conforme o backend atual. Tipos e erros
não dependem de Nest, DTOs, entidades Prisma, HTTP, React ou persistência.
O motor recebe e devolve valores financeiros textuais ou por representação
decimal definida explicitamente no contrato; normalização é determinística.
Um adaptador decimal local pode ser acrescentado se necessário, após decidir
precisão e dependência. Não modificar a configuração global de Decimal usada
por outros módulos. Exigir todos os exemplos e limites relevantes antes de
discutir colunas ou criar modelos. Os nomes podem ser ajustados mantendo
essa separação; nenhum desses arquivos foi criado no Marco 0.

### Contrato de entrada

A entrada deve representar:

- moeda;
- componentes em reais;
- mão de obra;
- frete;
- custos fixos;
- deduções;
- margem desejada;
- preço adotado opcional.

Todos os valores financeiros e percentuais devem possuir representação
decimal.

### Contrato de saída

A saída deve representar:

- custo-base;
- componentes calculados;
- custos fixos;
- deduções;
- mínimo exato e comercial;
- sugerido exato e comercial;
- preço adotado;
- lucro;
- margem efetiva;
- desconto máximo;
- avisos;
- versão da fórmula.

### Erros

Utilize erros ou resultados tipados para, no mínimo:

```text
INVALID_PRICING_DIVISOR
INVALID_AVERAGE_REVENUE
INVALID_PRODUCTIVE_HOURS
INVALID_FREIGHT_QUANTITY
INVALID_DECIMAL_VALUE
NEGATIVE_VALUE
```

### Testes

Transforme `EX-001` até `EX-012` em testes automatizados.

Inclua testes adicionais para:

- coleções de deduções;
- componentes fracionários;
- preço adotado;
- arredondamento;
- valores opcionais;
- limites decimais;
- ordem determinística.

### Validação do marco

Execute:

```text
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
```

Atualize o progresso antes de iniciar persistência.

## Marco 2 — Persistência

### Objetivo

Persistir configurações, perfis, composições e versões sem alterar dados
históricos existentes.

### Direção arquitetural — Marco 2A

A proposta foi revisada e registrada na
[ADR-006](../architecture/decisions/ADR-006-pricing-persistence-model.md).
Ela orienta entidades, precisão por campo, snapshot canônico, finalização,
FKs, bloqueios, adoção, retenção e autorização do futuro Marco 3.
O Marco 2A terminou na documentação. A etapa posterior versionou schema e
migration no commit `9427866`. A aplicação comprovada ocorreu somente no banco
local de desenvolvimento durante a validação de 04/10/2026. Services e contratos
de aplicação permanecem para o Marco 3.

### Modelos conceituais

A modelagem deve representar, mesmo que os nomes finais sejam diferentes:

- configuração de precificação da organização;
- perfil de venda;
- dedução do perfil;
- composição atual do produto;
- componente da composição;
- versão de cálculo;
- componente copiado para a versão;
- dedução copiada para a versão;
- referência opcional do produto para a versão adotada.

### Requisitos estruturais

Os modelos devem possuir:

- UUID válido;
- `organizationId` quando necessário para isolamento explícito;
- índices de consulta;
- restrições de unicidade;
- timestamps;
- escala decimal adequada;
- relações consistentes;
- política de ativação ou desativação;
- proteção de versões imutáveis.

### Concorrência

A numeração de versões por produto deve impedir duplicidade.

A adoção de preço deve ser transacional.

### Migration

A migration deve:

- preservar produtos existentes;
- aceitar referência nula para produtos antigos;
- não criar cálculos retroativos;
- não alterar orçamentos existentes;
- não alterar pedidos existentes;
- ser aplicável mais de uma vez somente pelo mecanismo normal do Prisma;
- possuir SQL revisável e não depender de dados locais específicos.

### Validação do marco

Execute:

```text
pnpm --filter @meinager/api exec prisma validate
pnpm --filter @meinager/api exec prisma generate --no-hints
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api build
pnpm db:status
```

Teste a migration em banco compatível com dados existentes antes de concluir.

## Marco 3 — API

### Objetivo

Expor os casos de uso sem permitir que o cliente determine os resultados
financeiros.

### Casos de uso

Implemente casos de uso equivalentes a:

- consultar configuração;
- atualizar configuração;
- listar perfis;
- criar perfil;
- atualizar ou desativar perfil;
- consultar composição de produto;
- salvar composição;
- simular cálculo;
- salvar versão;
- listar histórico;
- consultar versão;
- adotar preço;
- confirmar adoção abaixo do mínimo.
- alterar preço manual com limpeza explícita da versão adotada.

A ADR-007 aprova um único módulo `pricing`, com controllers de configuração,
perfis e produto e services separados por responsabilidade. O contrato completo
de rotas, respostas, snapshot e erros está nessa ADR.

### Autorização

Aplique os critérios `PREC-CA-045` até `PREC-CA-049` e a matriz da ADR-007.

Todos os identificadores relacionados devem ser verificados contra a
organização autenticada.

No `PATCH` de produto, somente `OWNER` e `ADMIN` podem enviar `salePrice`.
`OPERATIONS` preserva as demais alterações já permitidas, mas não define preço
manual. Omissão de `salePrice` preserva preço e ponteiro; presença explícita,
inclusive `null` ou valor igual ao atual, limpa `adoptedPricingVersionId` e
gera auditoria. O Marco 3D cobrirá essa compatibilidade com testes próprios.

### Backend autoritativo

Em operações de salvamento ou adoção:

1. receba as entradas;
2. valide os recursos;
3. carregue valores necessários;
4. execute novamente o motor;
5. ignore totais calculados pelo cliente;
6. persista entradas e resultados;
7. grave auditoria.

Organização e ator vêm exclusivamente da sessão. DTOs rejeitam resultados,
snapshots, origens resolvidas, números de versão e campos desconhecidos.

### Divisão de execução

- **Marco 3B:** base HTTP, erros, configuração e perfis;
- **Marco 3C:** composição, simulação, snapshot v1, versões e histórico;
- **Marco 3D:** adoção, idempotência do estado atual e alteração manual do preço.

Cada subetapa possui arquivos, endpoints, testes, critério de conclusão e
condições de parada detalhados na ADR-007. Não avançar quando a solução exigir
mudança de modelo persistente, reinterpretação histórica ou alteração da fórmula
sem uma nova decisão aprovada.

### Testes e2e

Cubra:

- autenticação;
- papéis;
- isolamento entre organizações;
- entradas inválidas;
- fluxo completo;
- imutabilidade;
- concorrência;
- preço abaixo do mínimo;
- auditoria;
- produtos antigos.

### Validação do marco

Execute:

```text
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
pnpm --filter @meinager/api test:e2e
pnpm --filter @meinager/api build
```

## Marco 4 — Interface web

### Objetivo

Permitir o uso da precificação a partir do domínio de produtos.

### Experiência esperada

A interface deverá possuir:

- acesso à configuração organizacional;
- seleção de perfil de venda;
- edição da composição;
- componentes dinâmicos;
- mão de obra;
- frete;
- prévia instantânea;
- preço mínimo;
- preço sugerido;
- preço adotado;
- decomposição;
- alertas;
- histórico;
- estados de carregamento e erro.

### Integração com o produto

O preço atual deve permanecer visível.

A interface deve explicar que simular não altera o produto.

Atualizar o preço exige uma ação explícita.

Produtos sem composição devem continuar editáveis e utilizáveis.

### Cálculo local

A prévia local pode reutilizar uma implementação compartilhada ou equivalente
ao motor, desde que:

- produza os mesmos resultados;
- não substitua a validação do backend;
- possua testes;
- não use `number` como fonte financeira.

Evite manter duas fórmulas manuais divergentes.

### Permissões

- `OWNER` e `ADMIN`: configuração e todos os casos de uso;
- `OPERATIONS`: composição, simulação e adoção permitida;
- `FINANCE`: leitura interna, sem escrita de precificação;
- `VIEWER`: somente projeção comercial, sem `directCost`, decomposição, custos,
  margem, lucro ou histórico financeiro;
- preço abaixo do mínimo: somente `OWNER` e `ADMIN`, com justificativa.

### Testes

Cubra:

- ausência de configuração;
- composição simples;
- composição completa;
- validações;
- simulação;
- adoção;
- preço manual;
- preço abaixo do mínimo;
- histórico;
- papéis;
- erro da API;
- acessibilidade básica.

### Validação do marco

Execute:

```text
pnpm --filter @meinager/web typecheck
pnpm --filter @meinager/web lint
pnpm --filter @meinager/web test
pnpm --filter @meinager/web build
```

Realize também teste visual do fluxo.

## Marco 5 — Orçamentos e pedidos

### Objetivo

Preservar rastreabilidade sem recalcular documentos históricos.

### Orçamentos

Ao adicionar produto com preço originado por precificação:

- preservar o preço comercial;
- preservar a referência opcional da versão;
- não expor custos internos no contrato comercial;
- não recalcular itens antigos quando o produto mudar.

### Pedidos

Durante a conversão:

- copiar os snapshots do orçamento;
- preservar a referência opcional;
- não executar o motor;
- não alterar fluxo de pedidos;
- não alterar auditorias operacionais existentes.

### Compatibilidade

Itens existentes devem continuar válidos com referência nula.

### Testes

Cubra:

- produto sem precificação;
- produto com versão adotada;
- alteração posterior do produto;
- edição permitida do orçamento;
- conversão em pedido;
- isolamento;
- payload comercial sem custos internos.

## Marco 6 — Validação final

### Comandos obrigatórios

Execute, a partir da raiz:

```text
pnpm --filter @meinager/api exec prisma validate
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
pnpm --filter @meinager/api test:e2e
pnpm --filter @meinager/api build
pnpm --filter @meinager/web typecheck
pnpm --filter @meinager/web lint
pnpm --filter @meinager/web test
pnpm --filter @meinager/web build
pnpm db:status
pnpm exec prettier --check .
git diff --check
git status --short
```

### Verificações adicionais

- migration aplicada;
- banco com dados preservado;
- exemplos canônicos cobertos;
- permissões cobertas;
- isolamento coberto;
- auditoria coberta;
- teste visual concluído;
- matriz de rastreabilidade atualizada;
- documentação consistente;
- nenhuma alteração não relacionada incluída.

## Idempotência e recuperação

Testes podem ser repetidos sem depender de dados criados manualmente.

Migrations não devem ser editadas depois de aplicadas em ambientes
compartilhados; correções posteriores devem utilizar nova migration.

Se uma migration falhar:

1. identifique o estado real do banco;
2. não apague dados;
3. não marque como aplicada sem verificar os objetos criados;
4. use os mecanismos de resolução do Prisma somente após diagnóstico;
5. documente a recuperação em `Descobertas`.

Não utilize comandos destrutivos para restaurar a árvore de trabalho.

## Critérios gerais de aceitação

A entrega deve atender:

- `PREC-CA-001` até `PREC-CA-061`;
- `EX-001` até `EX-012`;
- `ADR-001` até `ADR-004`.

Itens explicitamente marcados como evolução futura não bloqueiam a primeira
entrega.

## Resultados

Preencha esta seção ao final com:

- resumo do que foi implementado;
- principais arquivos;
- migrations;
- testes executados;
- evidências visuais;
- requisitos concluídos;
- limitações restantes;
- próximos passos.

### Marco 0 concluído — 02/10/2026

- Entrega: auditoria técnica e planejamento documentados, dez perguntas
  respondidas, limites de domínio e caminhos propostos; decisões de negócio
  abertas identificadas sem implementação.
- Documentos alterados: `docs/plans/pricing-engine.md` e
  `docs/product/requirements-traceability.md` (somente correções de estados
  e evidências iniciais comprovadas pela inspeção).
- Testes executados pelos comandos abaixo. Neste ambiente os argumentos após
  `--` não restringiram as suítes: passaram todos os 6 arquivos/21 testes
  unitários da API e 22 arquivos/68 testes web. Nenhum teste novo foi criado.
- Validação documental: formatação e verificação com Prettier dos dois
  documentos, `git diff --check`, `git diff --stat` e `git status --short`.
- Limitações: e2e foram inspecionados, não executados; não houve validação
  de estado real do banco, aplicação de migrations, testes de novas fórmulas,
  verificação visual ou typecheck/lint/build nesta tarefa documental.
- Nenhum código funcional, schema, migration, endpoint, componente ou
  dependência foi alterado; nenhum commit foi criado.
- Execução encerrada no Marco 0, aguardando revisão. Marco 1 permanece pendente.

```text
pnpm --filter @meinager/api test -- src/products/products.service.spec.ts src/auth/session/session.service.spec.ts
pnpm --filter @meinager/web test -- src/pages/product-page.spec.tsx src/pages/new-quote-page.spec.tsx
pnpm exec prettier --write docs/plans/pricing-engine.md docs/product/requirements-traceability.md
pnpm exec prettier --check docs/plans/pricing-engine.md docs/product/requirements-traceability.md
git diff --check
git diff --stat
git status --short
```

### Marco 1 iniciado e bloqueado — 02/10/2026 (histórico; resolvido em 03/10/2026)

Esta seção registra a execução inicial. O estado final e a validação após
a revisão estão na seção seguinte.

- Arquivos criados: `apps/api/src/pricing/calculator/pricing-calculator.ts`,
  `pricing-calculator.types.ts`, `pricing-calculator.errors.ts`,
  `pricing-decimal.ts`, `pricing-calculator.spec.ts` e ADR-005.
- Arquivos modificados: `apps/api/package.json`, `pnpm-lock.yaml`, este plano
  e `docs/product/requirements-traceability.md`. Nenhuma integração, schema,
  migration, controller, DTO HTTP ou interface foi criada.
- Motor disponível para revisão: composição por quantidade, mão de obra em
  minutos, frete manual/rateado, percentual fixo direto/derivado, coleções de
  deduções, mínimo/sugerido exatos/comerciais, análise de preço informado,
  lucro/margem/desconto, memória e erros tipados. Não há efeitos colaterais.
- Os testes com nomes EX-001 até EX-012 ficam na primeira seção de
  `pricing-calculator.spec.ts`, com mapeamento literal aos exemplos. EX-003
  até EX-012 passam; EX-001 e EX-002 permanecem falhando para expor as
  divergências documentadas em Descobertas, sem mudar a matemática.
- Validação direcionada: 77 testes, 75 aprovados e 2 falhas conhecidas.
  Typecheck e lint da API passaram. `pnpm --filter @meinager/api test` executou
  98 testes em 7 arquivos: 96 aprovados e as mesmas 2 falhas em EX-001/EX-002
  (exit code 1); os 21 testes preexistentes passaram. Prettier foi executado
  nos arquivos alterados; `git diff --check` não encontrou erros. Diff/stat
  e status confirmam os arquivos deste escopo, incluindo arquivos novos não
  rastreados (que não entram no `git diff --stat` sem staging).
- Limitações: os exemplos oficiais inconsistentes impedem encerrar o marco;
  não houve alteração em fórmulas ou exemplos para contornar a restrição do
  usuário. API, persistência, autorização, snapshots salvos, auditoria e
  compartilhamento web permanecem fora deste motor. Requisitos de domínio
  abrangentes são parciais na matriz; não foram declarados integralmente
  entregues apenas pela existência de uma função.
- Nenhum commit foi feito. Execução encerrada no Marco 1 bloqueado, antes de
  qualquer implementação dos Marcos 2 em diante.

Comandos de validação deste marco:

```text
pnpm --filter @meinager/api exec vitest run src/pricing/calculator/pricing-calculator.spec.ts
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
pnpm exec prettier --write <arquivos alterados>
git diff --check
git diff --stat
git status --short
```

### Marco 1 concluído — 03/10/2026

- Entrega: motor puro `margin-divisor-v1` validado contra EX-001 até EX-012,
  incluindo as expectativas canônicas corrigidas após revisão independente.
- Alterações nesta revisão: `docs/domains/pricing/examples.md`,
  `apps/api/src/pricing/calculator/pricing-calculator.spec.ts`, este plano e
  `docs/product/requirements-traceability.md`. O motor, os tipos, os erros,
  o adaptador decimal, a ADR-005 e as dependências não foram alterados.
- Validação direcionada: 77 testes do motor aprovados. Validação completa
  unitária da API: 98 testes aprovados em 7 arquivos, incluindo os 21
  preexistentes. Typecheck e lint passaram. Nenhuma falha restante.
- Rastreabilidade: EX-001/EX-002 e o conjunto EX-001 a EX-012 agora estão
  `IMPLEMENTED`; a reprodução decimal dos exemplos (`PREC-CA-050`) e os
  cenários de cálculo simples/completo (`PREC-CA-023`/`PREC-CA-024`) possuem
  evidência dos testes. Requisitos de persistência, API e interface não foram
  promovidos a implementados nesta revisão.
- Prettier aplicado aos quatro arquivos desta revisão; `git diff --check`,
  `git diff --stat` e `git status --short` executados. A árvore contém também
  as alterações anteriores do motor, que foram preservadas; arquivos novos
  não rastreados não aparecem no stat normal sem staging.
- Limitações: persistência, autorização, configurações/perfis persistidos,
  snapshots salvos, adoção em produto, contratos HTTP e prévia web continuam
  para os marcos seguintes. A política de leitura de custos, vigência e
  origem comercial permanece aberta conforme a auditoria.
- Execução encerrada no Marco 1 concluído. Nenhum schema, migration,
  endpoint, DTO HTTP, componente ou integração foi alterado. Nenhum commit
  foi criado; os Marcos 2 em diante permanecem pendentes.

```text
pnpm exec prettier --write docs/domains/pricing/examples.md apps/api/src/pricing/calculator/pricing-calculator.spec.ts docs/plans/pricing-engine.md docs/product/requirements-traceability.md
pnpm --filter @meinager/api exec vitest run src/pricing/calculator/pricing-calculator.spec.ts
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
git diff --check
git diff --stat
git status --short
```

### Marco 2A — Decisões arquiteturais registradas — 03/10/2026

- Criado `docs/architecture/decisions/ADR-006-pricing-persistence-model.md`.
  Atualizados somente este plano e `docs/domains/pricing/README.md`.
- Registradas as decisões aprovadas de vigência, precedência, custos,
  preço manual, adoção, decimais, BRL, snapshot/projeções, finalização SQL,
  colunas-resumo, chaves compostas, concorrência, retenção e leitura por papel.
- Progresso representa somente documentação concluída. Nenhum requisito de
  persistência foi marcado como implementado; a matriz não foi alterada.
- Validação documental: Prettier nos três arquivos e verificação de formatação
  de todos os documentos. Executados os comandos de diff/check/stat e status
  listados abaixo. Não foram executados testes funcionais nem operações de
  banco nesta etapa.
- Limitações: contrato final do snapshot e guards SQL ainda serão implementados;
  origem comercial dos itens, exposição atual de custos no catálogo e prévia
  web requerem as revisões descritas na ADR. Decisões já aprovadas não são
  tratadas como ambiguidades abertas.
- Nenhum schema, migration, código, endpoint, DTO, serviço, interface,
  dependência, fórmula ou exemplo foi alterado. Nenhum commit realizado.
- Execução encerrada no Marco 2A documental, aguardando revisão; a implementação
  da persistência do Marco 2 não foi iniciada.

```text
pnpm exec prettier --write docs/architecture/decisions/ADR-006-pricing-persistence-model.md docs/plans/pricing-engine.md docs/domains/pricing/README.md
pnpm exec prettier --check docs
git diff --check
git diff --stat
git status --short
```

### Marco 2B.1 — Revisão da migration não aplicada — 04/10/2026

Esta seção preserva o estado daquela execução. Depois, o commit `9427866`
versionou a fundação, e a migration foi aplicada separadamente somente ao banco
local de desenvolvimento, conforme o progresso e as descobertas atuais acima.

- Migration revisada e suíte standalone de PostgreSQL criada. A ADR-006 registra
  o fechamento transacional dos guards; as evidências estão em Descobertas.
- Resultado PostgreSQL: 198 verificações aprovadas em dois bancos descartáveis,
  removidos ao final. Nenhuma aplicação da migration no banco normal.
- Os testes desta revisão cobrem shadowing por tabelas temporárias em sessões
  novas, coordenação entre componentes e revisão da composição, savepoints e
  concorrência real com duas conexões. A role temporária manteve `TEMP`, sem
  propriedade, privilégios administrativos, DDL ou acesso ao schema privado.
- Validações aprovadas: Prisma format/validate/generate, typecheck, lint sem
  avisos, 98 testes unitários da API, build, Prettier de docs e diff check.
  `prisma migrate status` retornou código 1 esperado, indicando exclusivamente
  `20261003181002_add_pricing_persistence` pendente no banco `meinager`.
- A correção preexistente da migration antiga e os demais arquivos do usuário
  foram preservados. Nenhum motor, fórmula, API, interface ou dependência alterado.
- Limitações: aplicação da migration pendente; auditoria e permissões da aplicação,
  validação completa do snapshot e integrações continuam nos marcos posteriores.
- Execução encerrada no escopo de revisão do Marco 2B.1, sem commit, para revisão.

```text
PRICING_TEST_CONFIRM_DISPOSABLE=YES node apps/api/test/pricing/persistence-postgres.cjs
pnpm --filter @meinager/api exec prisma format
pnpm --filter @meinager/api exec prisma validate
pnpm --filter @meinager/api exec prisma generate
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api test
pnpm --filter @meinager/api build
pnpm --filter @meinager/api exec prisma migrate status
pnpm exec prettier --check docs
git diff --check
git diff --stat
git status --short
```

### Marco 3A — Contrato documental da API — 04/10/2026

- A ADR-007 registrou endpoints, métodos, respostas, separação comercial/interna,
  matriz de papéis e autoridade do backend por mutação.
- O snapshot oficial v1 congela entradas resolvidas, resultado integral do motor,
  contexto e origens, com canonicalização decimal e validação runtime.
- Foram definidos erros HTTP estáveis, isolamento por organização, ordem de locks,
  idempotência da adoção no estado atual e eventos de auditoria.
- A implementação foi dividida em Marcos 3B, 3C e 3D, cada qual com endpoints,
  arquivos, testes, critério de conclusão, riscos e condições de parada.
- Nenhum código funcional, schema, migration, dependência, banco, interface ou
  requisito da matriz de rastreabilidade foi alterado nesta etapa.

### Marco 3A — Revisão antes do commit — 05/10/2026

- Estado alinhado ao commit `9427866`: fundação persistente versionada. A
  validação de 04/10/2026 aplicou a migration somente ao banco local de
  desenvolvimento e mostrou 16 migrations e banco local atualizado; services,
  API e web permanecem pendentes, e outros ambientes não foram verificados.
- Autorização consolidada: preço manual somente por `OWNER`/`ADMIN`;
  `OPERATIONS` mantém adoção igual/acima do mínimo. `VIEWER` deixa de receber
  `directCost` no contrato legado, com alteração explícita e testes no Marco 3D.
- Idempotência limitada ao estado atual sob lock do produto, sem chave ou nova
  persistência. `PricingPriceAdoption` mantém a justificativa, e o `AuditLog`
  referencia a adoção sem duplicar o texto.
- Snapshot v1 passou a usar tipos persistidos próprios, proveniência versionada,
  perfil anulável e margem desejada efetiva com origem e precedência.
- Simulação usa `REPEATABLE READ` sem locks de escrita. Criação de versão observa
  configuração, perfil, produto-alvo e fontes `CATALOG` de forma consistente,
  com produtos bloqueados por UUID e releitura da composição/revisão.
- Nenhuma decisão essencial permanece aberta para o Marco 3. A prévia
  compartilhada bloqueia somente o Marco 4, e a origem comercial dos itens,
  somente o Marco 5.

### Marco 3B.1 concluído — 05/10/2026

- Entrega: módulo Nest de precificação, contrato local de erros e configuração
  organizacional versionada em `GET`/`PATCH /api/pricing/configuration`.
- Autorização: leitura para `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE`; escrita
  para `OWNER` e `ADMIN`; `VIEWER` recebe `403`, e ausência de sessão recebe
  `401` nos dois métodos.
- Persistência: criação e revisão são atômicas, preservam revisões anteriores,
  bloqueiam organização ou raiz conforme o caso e exigem revisão esperada.
  Auditoria usa `pricing_configuration.updated` na mesma transação.
- Validação direcionada: 18 testes unitários em dois arquivos e 16 testes E2E
  de configuração aprovados. O E2E executou em
  `pricing_configuration_e2e_a6c78af2dd7cb1e5`, criado somente para a suíte
  após aplicação das 16 migrations e removido ao final. O runner também
  comprovou a remoção de um segundo banco após erro intencional. A suíte
  unitária completa aprovou 116 testes em 9 arquivos; typecheck, lint e build da
  API também passaram.
- Limites: perfis/deduções concluem o restante do Marco 3B; composição,
  simulação, snapshot, versões e histórico pertencem ao Marco 3C; adoção,
  produto e `directCost` pertencem ao Marco 3D; a web permanece no Marco 4.
- Nenhum schema, migration, motor, fórmula, dependência ou arquivo web foi
  alterado. Nenhum commit foi criado.

```text
pnpm --filter @meinager/api typecheck
pnpm --filter @meinager/api lint
pnpm --filter @meinager/api exec vitest run src/pricing/services/pricing-configuration.service.spec.ts src/pricing/errors/pricing-exception.filter.spec.ts
PRICING_TEST_CONFIRM_DISPOSABLE=YES node apps/api/test/pricing/configuration-e2e-postgres.cjs
pnpm --filter @meinager/api test
pnpm --filter @meinager/api build
pnpm exec prettier --check docs
git diff --check
git diff --stat
git status --short
```
