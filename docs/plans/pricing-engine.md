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
- [x] Implementar os services e endpoints da API de precificação previstos nos
      Marcos 3B a 3D (configuração, perfis, composição, simulação, versões,
      histórico, adoção, preço manual e resumo comercial concluídos).
- [x] Implementar perfis de deduções e concluir o Marco 3B (Marco 3B.2,
      06/10/2026).
- [x] Implementar consulta e substituição completa da composição (Marco 3C.1,
      06/10/2026).
- [x] Implementar simulação autoritativa transitória (Marco 3C.2,
      07/10/2026).
- [x] Implementar snapshot runtime para criação de versões (Marco 3C.3,
      08/10/2026).
- [x] Implementar criação de versões e histórico de cálculos (Marco 3C.3,
      08/10/2026).
- [x] Implementar adoção atômica de versão (Marco 3D.1, 09/10/2026).
- [x] Implementar alteração manual do preço, resumo comercial e restrição de
      `directCost` para `VIEWER` (Marco 3D.2, 09/10/2026).
- [x] Auditar o frontend e definir a arquitetura da interface de precificação
      (Marco 4A, 10/10/2026; ADR-008, somente documentação).
- [x] Extrair o motor puro para `@meinager/pricing-calculator`, com a única
      suíte canônica de 77 testes e reexports temporários na API (Marco 4B.1,
      10/10/2026).
- [x] Implementar a fundação web, compatibilidade de Produtos, resumo comercial
      e preço manual explícito (Marco 4B.2, 13/10/2026).
- [x] Implementar consulta, criação e atualização da configuração organizacional
      na web (Marco 4B.3, 13/10/2026).
- [x] Implementar lista, detalhe, criação, edição e desativação de perfis de
      venda na web (Marco 4B.4, 18/10/2026).
- [x] Implementar consulta, criação e edição da composição persistida na web
      (Marco 4C.1, 19/10/2026).
- [x] Implementar prévia local instantânea com o motor compartilhado (Marco
      4C.2, 20/10/2026).
- [x] Implementar a projeção dinâmica `isAdopted` na lista e no detalhe internos
      de versões (Marco 4D.1, 22/10/2026).
- [x] Implementar a confirmação autoritativa da simulação na interface web
      (Marco 4D.2, 25/10/2026).
- [x] Implementar criação de versão e histórico visual somente leitura na web
      (Marco 4D.3, 26/10/2026).
- [x] Implementar adoção explícita de versão na web, com confirmação especial
      abaixo do mínimo (Marco 4D.4, 27/10/2026).
- [x] Executar revisão integrada por código e testes de componentes e corrigir
      erros de resposta e rolagem de diálogos (Marco 4E.1, 31/10/2026).
- [ ] Verificar responsividade e acessibilidade em navegador real e executar
      fluxo web → API → PostgreSQL em infraestrutura descartável.
- [ ] Implementar a interface web.
- [ ] Integrar snapshots com orçamentos e pedidos.
- [ ] Executar validação completa.
- [x] Atualizar a matriz de rastreabilidade até a adoção web do Marco 4D.4.
- [ ] Registrar os resultados finais.

## Descobertas

Registre nesta seção fatos identificados durante a implementação que não eram
evidentes no início.

Cada descoberta deve conter:

- data;
- descrição;
- evidência;
- impacto no plano.

### Marco 4E.1 — Revisão integrada da interface — 31/10/2026

- As leituras de configuração, perfis, composição e resumo comercial exibiam a
  mensagem técnica do validador quando uma resposta HTTP 2xx era incompatível
  com o contrato. A fronteira web agora conserva a validação estrita e apresenta
  uma mensagem genérica; quatro testes de regressão cobrem os endpoints.
- Os diálogos de adoção, detalhe histórico e descarte da composição não tinham
  limite de altura e rolagem interna em viewport pequena. O CSS agora limita a
  altura à viewport, permite rolagem e quebra texto longo. A eficácia visual em
  360 px, 768 px, 1280 px e zoom de 200% ainda precisa ser medida em navegador.
- Não há executável de navegador nem Playwright/Puppeteer instalado no workspace.
  O runner atual usa Vitest com JSDOM; seus testes provam comportamento de
  componentes com mocks, não inspeção visual nem fluxo real com PostgreSQL.
  Nenhuma dependência ou banco foi adicionado ou utilizado nesta revisão.

### Marco 4D.3 — Contrato histórico da API — 26/10/2026

- O POST de criação retorna a versão finalizada sem `isAdopted`; somente os GETs
  de lista e detalhe incluem essa projeção dinâmica. Contratos Zod distintos
  impedem que o retorno do POST seja confundido com detalhe em cache.
- O snapshot guarda `adoptedPrice` de entrada como decimal canônico. As colunas
  comerciais da versão são `Text` e recebem diretamente os preços com duas casas
  do resultado congelado, inclusive zeros finais como `90.90`. O contrato web
  valida essas fronteiras separadamente e exige a correspondência exata das
  projeções com o snapshot.
- Evidência: `pricing-versions.service.ts`, `pricing-snapshot-v1.ts`,
  `pricing-versions-contracts.ts` e testes de contrato/API web. Impacto: criar
  versão exige composição persistida, confirmação `PERSISTED` vigente e revisão
  correspondente; o histórico lê snapshot e projeções sem recalcular.

### Marco 4B.1 — Pacote compartilhado do motor — 10/10/2026

- A implementação matemática, os tipos, os erros e o clone decimal eram puros e
  puderam ser movidos sem importar Prisma, NestJS, React, HTTP, banco ou APIs
  exclusivas de Node. `packages/pricing-calculator/` passou a ser a fonte única
  de `margin-divisor-v1` e da suíte canônica completa.
- `decimal.js` era usado diretamente somente pelos arquivos puros extraídos.
  Sua dependência direta foi transferida de `@meinager/api` para
  `@meinager/pricing-calculator`; a serialização de `Prisma.Decimal` permaneceu
  na API.
- Os comandos diretos de typecheck, teste e build da API resolvem o pacote em
  clone limpo por lifecycle scripts mínimos. No pipeline Turbo, a dependência
  de workspace estabelece a ordem, e o `tsc -b` incremental evita recompilar
  artefatos já atualizados.
- A API passou de 241 para 167 testes unitários porque os 77 testes canônicos
  foram movidos e somente três testes mínimos de reexport e integração ficaram
  no consumidor. O total da cobertura matemática permanece 77 no pacote, sem
  uma segunda cópia da suíte.
- A revisão de bootstrap em 13/10/2026 encontrou duas entradas que ainda podiam
  depender de um `dist` deixado por validação anterior: `pnpm dev` não preparava
  dependências de workspace, e o runner PostgreSQL chamava Vitest por `exec`,
  fora do lifecycle `pretest`. O task `dev` passou a depender de `^build`, o
  pacote ganhou compilação em watch e o runner passou a construir o pacote
  antes de criar qualquer banco descartável.
- A prova começou duas vezes com `dist/index.js` ausente. `pnpm dev` preparou o
  pacote antes da API, iniciou Vite e Nest e recompilou após uma mudança de mtime
  em `src/index.ts`; o encerramento controlado não deixou processos nem portas.
  Depois de nova limpeza, o runner imprimiu o build do pacote antes de criar os
  bancos e aprovou os 79 E2E sem typecheck, teste ou build anterior.

### Marco 4B.2 — Fundação web e Produtos — 13/10/2026

- O contrato legado de Produtos exigia `directCost` e a listagem sempre criava
  a coluna de custo. O schema agora preserva a ausência da propriedade, e a
  tabela usa a política autenticada antes de renderizar título, valor ou texto
  relacionado a custo para `VIEWER`.
- `salePrice` participava do formulário e do tipo do PATCH comum. A edição
  agora oculta o campo, remove a propriedade do contrato de atualização e
  constrói o corpo sem ela; o preço manual usa uma mutation separada, exclusiva
  de `OWNER` e `ADMIN`, que envia somente string decimal ou `null`.
- A web passou a validar o resumo comercial e erros estruturados com Zod,
  preservando somente a mensagem e o status das respostas legadas sem `code`.
  Uma resposta com `code` só é aceita quando satisfaz integralmente o contrato
  estruturado; nesses corpos, código desconhecido, propriedades internas ou
  detalhes fora da forma aprovada recebem fallback genérico. Propriedades
  extras de respostas legadas são descartadas, sem transportar stack, SQL ou
  dados Prisma.
- A entrada do preço manual permanece textual durante a edição e é
  canonicalizada textualmente apenas no envio. A conversão aceita ponto ou uma
  vírgula, remove zeros irrelevantes, não arredonda e rejeita valores fora de
  `Decimal(14,2)` sem usar `number`, `parseFloat`, `parseInt` ou `Intl` como
  fonte.
- As quatro rotas aprovadas foram registradas. Somente a rota do produto entrega
  conteúdo funcional neste marco; configuração e perfis mostram explicitamente
  um estado de fundação e não possuem links de navegação nem queries dos
  recursos ainda pendentes.
- A rota do produto e o detalhe legado consultam somente o resumo comercial para
  `VIEWER`. Testes comprovam ausência de queries internas, de `directCost` e de
  conteúdo financeiro interno nessa projeção.

### Marco 4B.3 — Configuração organizacional web — 13/10/2026

- A revisão final de 14/10/2026 corrigiu recarga após conflito, alterações
  exclusivas de proveniência e proteção de rascunhos, sem ampliar o marco.
- O GET real usa `404 PRICING_CONFIGURATION_NOT_FOUND` como ausência esperada.
  A página transforma esse contrato em estado vazio e só oferece criação a
  `OWNER`/`ADMIN`; `OPERATIONS`/`FINANCE` leem e `VIEWER` não inicia a query.
- Percentuais são convertidos entre fração canônica e unidade humana deslocando
  o ponto decimal como texto. O adaptador aceita ponto ou vírgula, não arredonda
  e não usa `number` como fonte financeira.
- O adaptador do formulário compara valores já canonicalizados. Atualizações
  enviam somente os parâmetros alterados e a proveniência correspondente;
  origens dos demais parâmetros ficam fora do PATCH, e remoções não recebem
  proveniência incompatível.
- A proveniência é uma alteração independente do valor: o adaptador compara os
  sete campos editáveis, ignora `schemaVersion` e `confirmedByUserId` e envia
  `null` ao limpar metadados. A confirmação continua derivada da sessão pela
  API.
- A mutation atualiza somente a chave da configuração. Versões históricas,
  produtos, perfis, composição, estoque e financeiro não são invalidados.
- Conflitos de revisão e de concorrência mantêm o rascunho e exigem recarga
  explícita. Somente um GET bem-sucedido substitui o formulário; falhas mantêm
  conflito e rascunho para nova tentativa. No-op é resolvido sem PATCH e sem
  mensagem de nova revisão.
- Formulários editáveis e sujos bloqueiam navegação interna pelo React Router e
  `beforeunload`. O descarte usa diálogo acessível Base UI; leitura, formulário
  limpo, salvamento, cancelamento e recarga bem-sucedida não mantêm o bloqueio.

### Marco 4B.4 — Perfis de venda e deduções web — 18/10/2026

- A lista real da API não contém deduções; por isso o cache separa listas por
  página e estado do detalhe completo por ID. Criação, atualização e
  desativação invalidam somente o prefixo das listas de perfis e atualizam o
  detalhe afetado.
- O PATCH é formado por comparação semântica. Alterar apenas o nome omite
  deduções; qualquer mudança, inserção, remoção ou reordenação envia a coleção
  completa na ordem visual. Percentuais equivalentes são comparados depois da
  conversão textual para fração canônica.
- Os únicos metadados de proveniência enviados são `source`, `referenceId`,
  `periodStart`, `periodEnd`, `criterion` e `measuredAt`. IDs, posições,
  `schemaVersion` e `confirmedByUserId` permanecem derivados pelo backend.
- Uma recarga de conflito que falha mantém os dados anteriores do React Query,
  o formulário montado, o rascunho e o bloqueio de salvamento. Somente um GET
  bem-sucedido substitui o formulário e libera nova edição.
- `VIEWER` não habilita queries de lista nem de detalhe. `OPERATIONS` e
  `FINANCE` recebem os dados em modo somente leitura; `OWNER` e `ADMIN` podem
  criar, editar e desativar perfis ativos.

### Marco 4C.1 — Editor da composição persistida — 19/10/2026

- O GET usa `PRICING_COMPOSITION_NOT_FOUND` como ausência esperada. Outros
  `404`, inclusive produto inexistente ou externo, continuam erros.
- O PUT é uma substituição integral. A web deriva a posição da ordem visual,
  nunca envia IDs ou posições e omite `storedUnitCost` em `CATALOG`; ao
  selecionar o catálogo, aplica também a unidade exigida pelo backend.
- Perfis ativos compõem novas opções, enquanto o detalhe de um perfil vinculado
  inativo é carregado separadamente e preservado na leitura.
- A recarga após conflito chama o GET diretamente e só substitui cache e
  formulário após resposta válida. Falha mantém rascunho, conflito e bloqueio
  sem tratar dados antigos do cache como sucesso.
- A consulta da composição desabilita refetch automático por foco e reconexão.
  Perfis e catálogo consomem todas as páginas ativas em blocos de 100,
  deduplicam IDs na ordem retornada e resolvem por detalhe as referências atuais
  inativas ou ausentes dessas páginas, sem torná-las elegíveis para nova seleção.
- A suíte web completa apresentou contenção de recursos quando os testes
  React/JSDOM usavam o paralelismo automático dos 12 processadores disponíveis.
  O `vitest.config.ts` passou a limitar centralmente a execução a quatro workers;
  os scripts oficiais mantêm seus comandos originais e nenhum timeout foi
  aumentado.

### Marco 4C.2 — Prévia local instantânea — 20/10/2026

- A web passou a depender diretamente de `@meinager/pricing-calculator`. Seus
  comandos diretos de typecheck, teste e build preparam o pacote por lifecycle,
  enquanto o Turbo preserva a ordem pelo vínculo de workspace.
- Um adaptador puro reproduz a resolução de `PricingCalculationsService`:
  margem da composição precede a configuração e ambas exigem sua origem
  correspondente, custos fixos exigem valor e origem, mão de obra usa a
  configuração, o perfil detalhado fornece deduções ordenadas e `CATALOG` usa
  somente o `directCost` atual resolvido.
- O resultado transitório não pertence ao cache nem ao formulário. Troca de
  perfil, campo financeiro inválido, catálogo incompatível, configuração
  ausente ou erro tipado do motor removem imediatamente o resultado anterior.
- O painel usa somente campos de apresentação do motor para dinheiro e
  conversão percentual textual. Ele mostra preço mínimo, sugerido e analisado,
  decomposição, lucro, margens, classificação, avisos e versão da fórmula sem
  executar escrita ou `POST /simulations`.
- `ProductPricingPage` carrega o editor e o pacote matemático em chunk dinâmico
  apenas para os papéis internos. `VIEWER` continua consultando somente o resumo
  comercial e não inicia consultas de configuração, composição, perfil ou
  catálogo.
- A prova síncrona representativa do adaptador e do cálculo ficou abaixo de
  100 ms. EX-001 e EX-002 também passam pelo adaptador web, sem copiar a suíte
  canônica de 77 testes do pacote.

### Marco 4A — Auditoria da interface web — 10/10/2026

- A aplicação React já possui a estrutura necessária para o novo domínio:
  rotas lazy sob `ProtectedRoute`, layout autenticado, papéis na sessão,
  TanStack Query, React Hook Form, Zod, `useFieldArray`, componentes básicos e
  testes Vitest/Testing Library. Não é necessário um refactor estrutural antes
  do Marco 4B.1.
- O cliente HTTP atual preserva apenas mensagem e status. O Marco 4B.2 deverá
  manter também `code`, `field` e `details` dos erros estáveis de precificação
  para distinguir campo, conflito, ausência, permissão e erro interno.
- O schema web de produto exige `directCost`, enquanto a API implementada o
  omite para `VIEWER`. Além disso, a edição atual sempre reenvia `salePrice`:
  isso falha para `OPERATIONS` e, para `OWNER`/`ADMIN`, cria uma decisão manual
  mesmo sem intenção. O Marco 4B.2 deve aceitar a projeção por papel, omitir
  `salePrice` em edições comuns e oferecer preço manual em ação explícita.
- O workspace já inclui `packages/*`, mas não há pacote compartilhado. O motor
  puro usa clone local de `decimal.js`; os helpers `bigint` de orçamento não
  representam a fórmula de margem divisora. A ADR-008 aprova prévia híbrida com
  extração incremental do motor para um pacote puro compartilhado no Marco
  4B.1.
- Os contratos reais dos Marcos 3B a 3D.2 correspondem à ADR-007. O Marco 4D.1
  passou a informar a origem atual do preço somente na lista e no detalhe
  internos por `isAdopted: boolean`; o resumo comercial deliberadamente não
  expõe o identificador. A projeção relacional compara o ponteiro atual do
  produto sem N+1, persistência ou mutação da versão.
- Não existe hoje diálogo próprio, toast ou proteção contra saída com formulário
  sujo. Um diálogo acessível pode reutilizar `@base-ui/react`, já instalado;
  feedback inline e os padrões atuais de `role="status"`/`role="alert"` evitam
  nova dependência no primeiro incremento.

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

### Marco 3B.2 — Perfis de venda e deduções — 06/10/2026

- `PricingModule` passou a expor listagem paginada, detalhe, criação, revisão e
  desativação em `/api/pricing/profiles`. Leituras usam a organização da sessão
  e retornam somente a revisão atual; detalhe ordena deduções por posição e
  serializa taxas explicitamente como strings.
- Criação monta raiz, revisão inicial, deduções individualizadas, ponteiro e
  auditoria na mesma transação. Atualização bloqueia a raiz, relê o agregado,
  valida `expectedRevision` e trata a coleção enviada como substituição completa
  ordenada. Campos omitidos são preservados e taxas equivalentes são comparadas
  por valor decimal canônico.
- Posições são derivadas no backend de `1` a `N`. Categoria permanece textual e
  extensível. Coleção vazia é aceita porque as regras oficiais não exigem pelo
  menos uma dedução. Os documentos e o schema não definem unicidade nominal;
  nenhuma regra ou migration de nome único foi inventada.
- Proveniência persiste metadados autorizados, com `confirmedByUserId` derivado
  da sessão. IDs, organização, autoria, revisão nova, posição e datas não são
  aceitos do cliente.
- No-op é decidido após lock e validação da revisão; não cria revisão nem
  auditoria. Desativação altera somente a raiz, preserva todo o histórico e é
  idempotente depois de validar `expectedRevision`.
- Testes E2E em PostgreSQL descartável comprovaram papéis, isolamento, recurso
  externo indistinguível, paginação/filtro, revisão imutável, auditoria,
  validação, no-op e concorrência entre updates e entre update/desativação.

### Marco 3C.1 — Composição de custos — 06/10/2026

- `ProductPricingController` e `PricingCompositionsService` expõem consulta e
  substituição completa em `/api/pricing/products/:productId/composition`. A
  primeira gravação cria a revisão 1; cada mudança efetiva incrementa uma única
  revisão, substitui os componentes na ordem recebida e grava a auditoria na
  mesma transação.
- Componentes `MANUAL` e `COPIED` exigem `storedUnitCost` e não aceitam produto
  de origem. Componentes `CATALOG` exigem produto-fonte ativo, da mesma
  organização, com unidade correspondente e `directCost`; esse custo é
  resolvido sob lock e não é persistido como cache na composição.
- Perfil, produto-alvo e produtos-fonte são bloqueados em ordem determinística.
  A composição e `expectedRevision` são relidos após os locks. Estado
  semanticamente idêntico retorna `200` sem revisão ou auditoria; revisão
  obsoleta continua retornando `409`.
- DTOs aceitam somente strings decimais simples dentro da precisão persistente,
  rejeitam `number`, expoente, sinal positivo, negativos, `NaN`, `Infinity`,
  campos protegidos e estruturas aninhadas incompatíveis. Posições, organização,
  ator e confirmação de proveniência são definidos pelo backend.
- A revisão de 07/10/2026 identificou que `Prisma.Decimal.toString()` podia
  emitir expoente para valores válidos como `0.00000001`. Configuração, perfis e
  composição passaram a usar um serializador compartilhado baseado em
  `toFixed()` sem precisão fixa, tanto na canonicalização quanto nas respostas,
  sem alterar a configuração global do Decimal.
- O E2E descartável comprova autorização, isolamento, referências externas
  indistinguíveis, ordenação, criação, substituição vazia, no-op, conflito,
  concorrência real e ausência de movimentação de estoque ou lançamento
  financeiro. Simulação, snapshot, versão e adoção permanecem fora desta
  subetapa.

### Marco 3C.2 — Simulação autoritativa — 07/10/2026

- `POST /api/pricing/products/:productId/simulations` executa o motor
  `margin-divisor-v1` com entradas resolvidas pelo backend. O DTO usa a união
  discriminada `source: "PERSISTED" | "DRAFT"`; `DRAFT` exige uma composição
  completa com os mesmos campos editáveis do `PUT`, sem `expectedRevision`.
- Toda a leitura ocorre em uma transação Prisma `REPEATABLE READ`, sem
  `FOR UPDATE`: configuração e revisão atual, composição, perfil e deduções,
  produto-alvo e produtos-fonte `CATALOG` pertencem à organização da sessão e
  são observados na mesma visão. Um teste coordenado alterou `directCost`
  durante a requisição e comprovou que a mudança só apareceu na execução
  seguinte.
- Custos `MANUAL`/`COPIED` vêm de `storedUnitCost`; `CATALOG` usa sempre o
  `Product.directCost` atual, sem aceitar custo resolvido do cliente. A margem
  da composição/rascunho precede a configuração, e a resposta identifica o
  valor, a precedência e a origem efetivos.
- A resposta contém referências e revisões utilizadas, entrada resolvida,
  resultado completo, fórmula e análise de `adoptedPrice`. Decimais Prisma usam
  `serializePricingDecimal`; o E2E confirmou `0.00000001` sem expoente e
  reprodução autoritativa de EX-001 e EX-002.
- A simulação não cria `PricingCalculationVersion`, snapshot persistido ou
  `AuditLog`; não altera `Product.salePrice`, ponteiro de versão, composição,
  estoque ou financeiro. O snapshot oficial v1 continua reservado para a
  criação de versões.

### Marco 3C.3 — Snapshot e versões — 08/10/2026

- O contrato `PricingSnapshotV1` possui tipos persistidos próprios e validador
  runtime independente de Nest e Prisma. Ele exige conjunto exato de campos,
  strings decimais canônicas sem expoente, posições positivas e contíguas,
  proveniências ordenadas e correspondentes e referências versionadas.
- A validação materializa opcionais como `null`, preserva a distinção entre
  entrada de frete omitida e consumo normalizado e executa novamente o motor
  para rejeitar qualquer resultado congelado divergente.
- A criação de versão relê entradas autoritativas em `REPEATABLE READ`, usa a
  ordem de locks da ADR-007, valida `expectedCompositionRevision`, congela
  configuração, perfil, catálogo e origens e cria snapshot, projeções,
  finalização e auditoria na mesma transação.
- Duas requisições HTTP independentes para o mesmo produto comprovaram
  numeração única sob concorrência. Conflitos `P2034` e somente o `P2002` do
  índice `pricing_calculation_versions_org_product_number_key` têm repetição
  limitada; outros `P2002` e falhas Prisma não classificadas continuam tratados
  como erros inesperados. No Prisma 7.10.0 com `@prisma/adapter-pg`, o índice
  vem em `meta.driverAdapterError.cause.constraint.index`; não há `meta.target`.
- Lista e detalhe expõem somente versões `FINALIZED` da organização e do
  produto autenticados. O detalhe valida o snapshot antes da resposta; mudanças
  posteriores na composição, configuração, perfil ou catálogo não alteram o
  histórico.
- A criação de versão não altera `Product.salePrice`,
  `adoptedPricingVersionId`, estoque ou financeiro. A adoção permanece uma ação
  explícita do Marco 3D.

### Marco 3D.1 — Adoção atômica — 09/10/2026

- `POST /api/pricing/products/:productId/adoptions` aceita somente a versão,
  confirmação e justificativa condicionais. Organização, ator, papel, preço e
  classificação vêm do backend.
- A operação bloqueia o produto por organização, carrega a versão pelo trio
  organização/produto/ID e valida snapshot, replay, colunas-resumo e todas as
  projeções. Nenhuma configuração, perfil, composição ou custo atual participa
  da reinterpretação histórica.
- Preço, ponteiro, evento imutável e `AuditLog` são gravados na mesma transação.
  A justificativa fica somente em `PricingPriceAdoption`; a auditoria contém
  IDs, classificação, confirmação, preços e ator.
- A idempotência compara versão e valor decimal sob o lock. Repetir o estado
  atual não escreve; uma transição intermediária torna a adoção seguinte uma
  nova decisão. O E2E comprovou uma única transição para duas requisições
  concorrentes.
- O validador do snapshot passou a aceitar frações negativas canônicas exatas e
  de exibição, necessárias para lucro abaixo de zero produzido pelo próprio
  motor. A gramática continua rejeitando expoente e valores não canônicos; não
  houve mudança de fórmula ou arredondamento.
- A revisão de idempotência separou autorização de evidências: `OWNER` e
  `ADMIN` podem repetir o estado `BELOW_MINIMUM` atual apenas com `versionId` e
  recebem o evento existente, sem escrita; `OPERATIONS` continua bloqueado
  antes da comparação idempotente. Confirmação e justificativa permanecem
  obrigatórias para cada nova transição abaixo do mínimo.

### Marco 3D.2 — Preço manual e projeção comercial — 09/10/2026

- O `PATCH /api/products/:productId` já distinguia omissão de `salePrice` de
  `null`. A integração preservou esse contrato: omissão mantém preço e ponteiro;
  string, `null` e valor igual são decisões manuais de `OWNER`/`ADMIN`, limpam o
  ponteiro e criam exatamente um `product_price.manually_changed`.
- O lock de produto já compartilhado com a adoção permite serializar os dois
  comandos. Os guards SQL aceitaram a transição manual sem
  `PricingPriceAdoption`, desde que preço e ponteiro fossem gravados na mesma
  transação. O E2E comprovou rollback em falha de auditoria e ausência de par
  incoerente sob concorrência real.
- `GET /api/pricing/products/:productId/summary` pode derivar a origem comercial
  apenas do ponteiro anulável e verificar a existência da composição com uma
  projeção mínima. O contrato retorna exatamente cinco propriedades e não
  expõe versão, custo ou memória de cálculo.
- A proteção de `directCost` exige selects distintos nos endpoints legados de
  lista e detalhe. O campo não é consultado para `VIEWER`; os outros quatro
  papéis mantêm o contrato anterior.

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

Na web do Marco 4D.3, a criação consome uma confirmação autoritativa `PERSISTED`
em paridade e envia somente revisão esperada e preço comercial atual opcional.
Após sucesso, outra versão exige nova simulação explícita. A criação invalida
apenas listas de versões do produto; detalhes históricos permanecem no cache e
`isAdopted` é lido dinamicamente dos GETs. A interface não oferece adoção.

### Revisão web — Marco 4E.1

Respostas de precificação incompatíveis com schemas runtime continuam sendo
rejeitadas, mas sem exibir diagnósticos do validador na interface. Diálogos
extensos devem permitir rolagem dentro da viewport. A validação visual e o
fluxo integrado com banco descartável permanecem etapas separadas; o Marco 4E
não está concluído.

### Snapshot runtime e versões — Marco 3C.3

O snapshot v1 é um contrato persistido estrito, validado antes da gravação e na
leitura detalhada. Entradas opcionais são materializadas, decimais permanecem
canônicos, proveniências acompanham exatamente seus itens e o resultado deve ser
idêntico ao replay do `margin-divisor-v1`. Versões são criadas como `BUILDING` e
finalizadas com projeções e auditoria na mesma transação; registros finalizados
permanecem protegidos pelos guards SQL do Marco 2.

### Adoção atômica — Marco 3D.1

A adoção usa exclusivamente uma versão `FINALIZED` validada e seu
`analyzedPrice`. `OWNER`, `ADMIN` e `OPERATIONS` podem adotar preços iguais ou
superiores ao mínimo; abaixo do mínimo somente `OWNER` e `ADMIN`, com confirmação
explícita e justificativa. O produto permanece bloqueado até o commit e somente
`P2034` é traduzido como conflito concorrente.

### Preço manual e projeções por papel — Marco 3D.2

Preço manual explícito no `PATCH` de produto é permitido somente para `OWNER` e
`ADMIN`, inclusive quando `null` ou numericamente igual ao atual. A decisão
limpa `adoptedPricingVersionId` e audita preços, versão anterior e ator na mesma
transação; omissão preserva preço e ponteiro. O resumo comercial usa o ponteiro
somente para derivar `MANUAL` ou `PRICING_VERSION` e não o expõe. Consultas
legadas de produto selecionam `directCost` para `OWNER`, `ADMIN`, `OPERATIONS` e
`FINANCE`, e usam uma projeção sem esse campo para `VIEWER`.

### Dados financeiros

O motor recebe valores consolidados e não consulta diretamente lançamentos
durante a fórmula, conforme `ADR-004`.

Novas decisões estruturais devem ser registradas em ADR antes de serem
aplicadas.

### Arquitetura da interface web — Marco 4A

A [ADR-008](../architecture/decisions/ADR-008-pricing-web-architecture.md)
foi aceita em 10/10/2026 e integra a precificação às rotas e páginas de Produtos.
A entrega será dividida em 4B.1 (pacote do motor), 4B.2 (fundação e produtos),
4B.3 (configuração), 4B.4 (perfis), 4C (composição), 4D (simulação, versões e
adoção) e 4E (acabamento e validação integral). A prévia será híbrida: cálculo
local pelo mesmo motor puro compartilhado e confirmação autoritativa pela API.
Strings decimais canônicas continuam sendo a fronteira; rascunho, cache
persistido e simulação permanecem separados.

O Marco 4B.1 moveu o motor e a única suíte canônica completa de 77 testes para
`packages/pricing-calculator`, mantendo na API reexports temporários e três
testes mínimos de integração. O Marco 4B.2 corrigirá ausência de `directCost`
para `VIEWER` e omissão de `salePrice` em edições comuns.

A extensão interna `isAdopted: boolean` foi aprovada para lista e detalhe de
versões. É uma projeção dinâmica calculada pela comparação entre o ponteiro
atual do produto e a versão, sem persistência, schema ou migration. O resumo
comercial permanece sem identificador ou snapshot. O Marco 4D.1 implementou a
projeção com leitura relacional do ponteiro, sem consulta adicional por versão;
a interface de histórico permanece para os Marcos 4D.2–4D.4.

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

Na auditoria do Marco 0, o contrato de `Product` ainda expunha `directCost` ao
`VIEWER`. A ADR-007 aprovou a restrição e o Marco 3D.2 a implementou com selects
por autorização e testes de não vazamento. A web ainda precisa aceitar a
ausência do campo. Origem comercial de itens e integrações financeiras futuras
continuam abertas nos marcos correspondentes; a estratégia da prévia web está
proposta na ADR-008.

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

### Perfis versionados — Marco 3B.2

- Perfil e deduções formam um agregado versionado. Cada alteração cria uma nova
  revisão e novas linhas de dedução; revisões anteriores nunca são alteradas.
- A listagem segue `{ data, pagination }`, com 20 itens por padrão, limite 100,
  filtro `isActive` e ordenação determinística por nome atual e ID.
- `OWNER` e `ADMIN` escrevem; `OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE` leem;
  `VIEWER` recebe `PRICING_FORBIDDEN`. Recurso externo ou inexistente usa o
  mesmo `PRICING_PROFILE_NOT_FOUND`.
- Auditorias `pricing_sales_profile.created`, `.updated` e `.deactivated`
  pertencem à transação da mutação e registram somente IDs, revisões, estado e
  nomes dos campos alterados, sem taxas ou coleções completas.

### Composição versionada — Marco 3C.1

- `PUT /api/pricing/products/:productId/composition` representa o estado
  completo editável. Componentes são recriados em posições contíguas derivadas
  pelo backend; revisões anteriores permanecem preservadas pelas versões de
  cálculo futuras, não por cópias editáveis da composição.
- `OWNER`, `ADMIN` e `OPERATIONS` consultam e alteram composições; `FINANCE`
  possui somente leitura interna; `VIEWER` não recebe o contrato de custos.
- Locks seguem perfil por UUID e produtos por UUID, incluindo alvo e fontes de
  catálogo. Relações externas ou inexistentes usam erros indistinguíveis e a
  organização vem exclusivamente da sessão.
- `storedUnitCost` é fonte apenas para `MANUAL` e `COPIED`. `CATALOG` resolve o
  `Product.directCost` vigente e deixa `storedUnitCost` nulo; o custo efetivo só
  será congelado pelo snapshot de uma versão no restante do Marco 3C.
- Auditoria de alteração registra identidade, revisões e contagem de
  componentes, sem duplicar custos internos. Um no-op semântico não gera evento.

### Editor web da composição persistida — Marco 4C.1

- A página consulta composição, perfis ativos e catálogo somente para os quatro
  papéis internos. `OWNER`, `ADMIN` e `OPERATIONS` editam; `FINANCE` lê;
  `VIEWER` mantém somente o resumo comercial e não inicia essas queries.
- O formulário representa o PUT integral com strings decimais, condições de
  mão de obra e frete, proveniências e componentes `MANUAL`, `COPIED` ou
  `CATALOG`. A canonicalização ocorre ao montar o payload, sem `number`,
  arredondamento ou custo usado como cache de catálogo.
- Após PUT, a mutation atualiza apenas a chave exata da composição e invalida
  apenas o resumo do produto. Configuração, perfis, versões, produtos legados e
  outros domínios permanecem intactos.
- No-op não envia PUT. Conflitos preservam o rascunho até recarga explícita
  bem-sucedida. Navegação interna e `beforeunload` usam diálogo acessível
  enquanto houver edição não salva.
- Foco e reconexão não refazem a consulta da composição nem substituem o
  rascunho. Perfis e produtos elegíveis são coletados em todas as páginas; uma
  referência `CATALOG` atual fora do conjunto elegível é identificada por seu
  detalhe e exibida apenas como histórica.

### Prévia local instantânea — Marco 4C.2

O navegador usa diretamente o pacote puro compartilhado, por meio de um
adaptador web explícito que resolve somente entradas autorizadas já carregadas.
O resultado é derivado com `useMemo`, permanece separado do cache persistido e
do estado do formulário e nunca é enviado como fonte de verdade. A consulta do
detalhe do perfil acompanha a seleção atual; durante troca, falha ou retry,
nenhum resultado do perfil anterior fica visível. A margem efetiva é resolvida
junto com sua precedência e origem; remover a origem da composição ou da
configuração elimina imediatamente o resultado local. A confirmação
autoritativa por `POST /simulations`, criação de versão e adoção permanecem para
o Marco 4D.

### Simulação autoritativa — Marco 3C.2

- A fonte do cálculo é explicitada por `PERSISTED` ou `DRAFT`. O rascunho é
  transitório e não aceita revisão, organização, ator, resultados, fórmula,
  classificação, snapshot ou custo efetivo fornecido pelo cliente.
- `OWNER`, `ADMIN` e `OPERATIONS` podem simular; `FINANCE` e `VIEWER` recebem
  `PRICING_FORBIDDEN`. Recursos externos são filtrados pela organização da
  sessão e usam os mesmos erros de recursos inexistentes.
- Simulações usam `REPEATABLE READ` sem locks ou escrita. O resultado não é um
  snapshot oficial nem uma versão histórica e não gera auditoria, conforme as
  ADR-003 e ADR-007.

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

| Limite                                | Responsabilidade                                                      | Caminhos atuais ou planejados                                                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motor puro — Marcos 1 e 4B.1          | `margin-divisor-v1`, validação matemática, memória e erros tipados    | Fonte única e suíte canônica em `packages/pricing-calculator/src/`; reexports temporários em `apps/api/src/pricing/calculator/`                                                                                                                                 |
| Aplicação — Marco 3                   | Orquestrar configuração, composição, cálculo, histórico e preço       | Estrutura implementada conforme ADR-007 em `pricing.module.ts`, `contracts/`, `dto/`, `errors/`, `controllers/`, `services/` e `pricing-locks.ts`; Marcos 3B a 3D concluídos                                                                                    |
| Configuração organizacional — Marco 2 | Parâmetros com vigência/origem e perfis organizacionais               | Modelos em `apps/api/prisma/schema.prisma` e services/controllers versionados de configuração, perfis e deduções concluídos nos Marcos 3B.1 e 3B.2                                                                                                              |
| Composição e histórico — Marco 2      | Composição editável, componentes e versões autossuficientes/imutáveis | `ProductPricingComposition`, `PricingComponent`, `PricingCalculationVersion`, projeções e `PricingPriceAdoption`; composição, simulação, snapshot, versões, histórico e adoção concluídos nos Marcos 3C e 3D.1; resumo e preço manual concluídos no Marco 3D.2  |
| Web — Marco 4                         | Contratos Zod, queries/mutations e formulários específicos            | `apps/web/src/features/pricing/pricing-api.ts`, `use-*-query.ts`, `use-*-mutation.ts`, `pricing-composition-form.tsx`, `pricing-configuration-form.tsx`, `pricing-history.tsx`; `apps/web/src/pages/product-pricing-page.tsx`, `pricing-configuration-page.tsx` |
| Integração comercial — Marco 5        | Validar/capturar origem e copiar snapshot sem custos                  | Extensões localizadas em `apps/api/src/quotes/quotes.service.ts`, `apps/api/src/orders/orders.service.ts`, DTOs e `apps/web/src/features/quotes/`; sem alterações nos fluxos                                                                                    |
| Validação posterior                   | Permissões, isolamento, imutabilidade, concorrência e não regressão   | Specs em `apps/api/test/pricing-*.e2e-spec.ts`, `products.e2e-spec.ts` e runner PostgreSQL descartável; testes de orçamentos/pedidos e specs web permanecem para seus respectivos marcos                                                                        |

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
3. **Prévia local única — resolvida no Marco 4A:** a web não possuía biblioteca decimal própria nem
   pacote compartilhado existente. Os helpers `bigint` de orçamento são
   adequados ao contrato atual, mas não substituem o motor de margem divisora.
   A ADR-008 aprovou a extração do motor para pacote puro e a prévia híbrida,
   preservando `PREC-CA-027` (100 ms) sem manter duas fórmulas manuais.
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

O item 3 foi resolvido documentalmente no Marco 4A pela ADR-008: a direção é
prévia híbrida, com motor puro compartilhado e API autoritativa. A extração e
suas alterações de dependência permanecem trabalho revisável do Marco 4B.1.

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
ambientes. O módulo HTTP, a configuração, os perfis, a composição, a simulação
autoritativa, o snapshot oficial, as versões, o histórico, a adoção, o preço
manual e o resumo comercial existem. A interface de precificação ainda não
existe; sua arquitetura está proposta na ADR-008.

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

### Marco 4A — Auditoria e arquitetura

Concluído e aprovado documentalmente em 10/10/2026. A ADR-008 registra rotas,
permissões, contratos web, estado, decimais, erros, componentes e testes.
Nenhuma interface ou dependência foi implementada.

### Divisão de execução

- **Marco 4B.1 — Pacote compartilhado do motor (concluído em 10/10/2026):**
  package ESM puro criado, motor e sua única suíte canônica de 77 testes
  movidos, reexports temporários mantidos na API e scripts integrados ao Turbo;
  sem interface.
- **Marco 4B.2 — Fundação web e produtos (concluído em 13/10/2026):** contratos
  Zod, erros estruturados, query keys, permissões, compatibilidade de
  `directCost`/`salePrice`, ação manual explícita, resumo comercial e
  rotas-base.
- **Marco 4B.3 — Configuração (concluído em 13/10/2026):** consulta/formulário,
  leitura e escrita por papel, `expectedRevision`, proveniências e estados de
  página/conflito.
- **Marco 4B.4 — Perfis (concluído em 18/10/2026):** lista, paginação, detalhe,
  criação, edição, desativação, deduções ordenadas, proveniências, permissões,
  conflitos e proteção de rascunhos.
- **Marco 4C.1 — Composição persistida (concluído em 19/10/2026):** perfil,
  componentes ordenados, catálogo, mão de obra, frete, proveniências, revisão
  esperada, permissões, conflitos e proteção de rascunhos.
- **Marco 4C.2 — Prévia local:** consumo do pacote compartilhado e apresentação
  imediata dos resultados, concluído em 20/10/2026 sem substituir a confirmação
  autoritativa.
- **Marco 4D — Simulação, versões e adoção:** confirmação autoritativa, criação
  e detalhe de versão, histórico, adoção, confirmação abaixo do mínimo e preço
  manual explícito. O Marco 4D.1 concluiu `isAdopted`; simulação, histórico e
  adoção na interface permanecem nos Marcos 4D.2–4D.4.
- **Marco 4E — Acabamento e validação:** responsividade, acessibilidade, estados,
  teste visual e fluxo integral por papel.
- **Marco 4E.1 — Revisão integrada por código e componentes (31/10/2026):**
  contratos e estados revisados, correções pontuais de mensagem segura e
  rolagem de diálogos; inspeção em navegador e fluxo integrado real pendentes.

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

A decisão aprovada na ADR-008 é uma solução híbrida: prévia local com o mesmo
motor puro agora disponível em `packages/pricing-calculator`, seguida de
confirmação autoritativa pela API. O Marco 4B.1 preservou os imports atuais por
reexports e moveu a única suíte canônica completa de 77 testes, incluindo
EX-001 a EX-012, para o pacote. A API mantém apenas testes mínimos de
compatibilidade e integração. A futura integração web deve:

- produzir os mesmos resultados;
- preservar a validação do backend;
- possuir testes;
- manter `number` fora da fonte financeira.

Não criar uma segunda fórmula no frontend. Não alterar `formulaVersion`,
snapshot ou arredondamento durante a extração.

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

Acrescente contratos e serialização decimal, query keys/invalidações,
componentes dinâmicos, ausência de vazamento para `VIEWER`, conflito de revisão,
responsividade e equivalência local de EX-001 a EX-012. O Marco 4E mantém teste
visual manual obrigatório; automação de navegador exige decisão separada antes
de adicionar dependência.

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
- Nenhuma decisão essencial permanecia aberta para o Marco 3. Naquele estado
  histórico, a prévia compartilhada bloqueava somente o Marco 4; a ADR-008
  resolveu essa decisão em 10/10/2026. A origem comercial dos itens continua
  pertencendo ao Marco 5.

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

### Marco 3B.2 concluído — 06/10/2026

- Entrega: cinco endpoints de perfis de venda, com paginação, filtro de estado,
  detalhe, revisões imutáveis, deduções extensíveis e desativação sem exclusão.
- Validação direcionada: 17 testes em dois arquivos. O runner aprovou 27 testes
  E2E em dois arquivos no banco descartável
  `pricing_configuration_e2e_867a7a894731ca6f`, após aplicar as 16 migrations,
  e removeu o banco ao final. A prova de limpeza após erro também passou. A
  suíte unitária completa aprovou 129 testes em 10 arquivos; typecheck, lint e
  build da API passaram.
- Limites: persistência e API de perfis não comprovam ainda seu uso por
  composição, cálculo ou snapshot; esses itens permanecem no Marco 3C.
- Nenhum schema, migration, banco normal, dependência, calculador, fórmula,
  produto ou arquivo web foi alterado. Nenhum commit foi criado.

### Marco 3C.1 concluído — 06/10/2026

- Entrega: `GET` e `PUT` da composição de custos por produto, com substituição
  completa, revisão esperada, no-op semântico, componentes ordenados e fontes
  `MANUAL`, `COPIED` e `CATALOG` validadas sob locks determinísticos.
- Evidência direcionada: 36 testes unitários em quatro arquivos e 43 testes E2E
  em três arquivos, incluindo autorização, isolamento, validação e round-trip
  decimal, catálogo, auditoria, ausência de efeitos em estoque/financeiro e
  concorrência.
  O runner aplicou as 16 migrations somente no banco PostgreSQL descartável
  `pricing_configuration_e2e_2603d261c812448e` e o removeu no `finally`; a
  prova separada de remoção após falha controlada também passou. A suíte
  unitária completa da API aprovou 140 testes em 13 arquivos; typecheck, lint e
  build passaram.
- Limites: a composição guarda somente entradas editáveis. Não executa o motor,
  não congela `effectiveUnitCost`, não cria snapshot ou versão e não altera o
  preço comercial. Essas responsabilidades permanecem nas próximas subetapas do
  Marco 3C e no Marco 3D.
- Nenhum schema, migration, banco normal, dependência, fórmula, produto ou
  arquivo web foi alterado. Nenhum commit foi criado.

### Marco 3C.2 concluído — 07/10/2026

- Entrega: `POST /api/pricing/products/:productId/simulations`, com fonte
  persistida ou rascunho, preço analisado opcional, resolução autoritativa de
  configuração/perfil/catálogo e resultado integral do motor em strings
  decimais simples.
- Segurança: organização e ator vêm da sessão; somente `OWNER`, `ADMIN` e
  `OPERATIONS` executam. Produto, perfil e catálogo externos são ocultados, e
  campos calculados ou protegidos são rejeitados pelo DTO.
- Consistência e efeitos: a leitura usa uma única transação `REPEATABLE READ`,
  comprovada sob atualização concorrente de catálogo. Contagens antes/depois
  confirmaram ausência de versão, auditoria, composição nova, estoque e
  financeiro, além da preservação de `salePrice` e
  `adoptedPricingVersionId`.
- Evidência direcionada: 24 testes unitários em três arquivos e 54 testes E2E
  de precificação em quatro arquivos. O runner aplicou as 16 migrations somente
  no banco descartável `pricing_configuration_e2e_5f8bb41d60fb2758` e o
  removeu; a prova de remoção após erro controlado também passou.
- A suíte unitária completa da API aprovou 160 testes em 15 arquivos;
  typecheck, lint e build também passaram.
- Limites: não foi criado snapshot oficial, versão, histórico, adoção ou
  interface. A próxima subetapa do Marco 3C deve criar e validar o snapshot v1
  para versões persistidas sem reutilizar a resposta transitória como contrato
  histórico.
- Nenhum schema, migration, dependência, fórmula, preço de produto ou arquivo
  web foi alterado. Nenhum commit foi criado.

### Marco 3C.3 concluído — 08/10/2026

- Entrega: contrato e validador runtime do snapshot v1, criação autoritativa de
  versões e listagem/detalhe do histórico em
  `/api/pricing/products/:productId/versions`.
- O arquivo E2E específico de versões comprova papéis, isolamento entre
  organizações, DTO protegido, dependências inválidas, snapshot e projeções,
  imutabilidade SQL, congelamento após mudanças, auditoria atômica, rollback e
  numeração concorrente. As contagens antes/depois comprovam que a criação não
  altera preço, ponteiro adotado, composição, estoque ou financeiro.
- Validação direcionada: 29 testes unitários em três arquivos. O runner aprovou
  57 testes E2E em cinco arquivos depois de aplicar as 16 migrations somente no
  banco descartável `pricing_configuration_e2e_34d432bb5ad71235`; o banco e a
  prova separada criada para validar limpeza após erro foram removidos.
- A suíte unitária completa da API aprovou 189 testes em 18 arquivos; typecheck,
  lint e build também passaram.
- Limites: adoção e alteração manual do preço pertencem ao Marco 3D; resumo
  comercial, integração com orçamentos/pedidos e interface continuam pendentes.
- Nenhum schema, migration, banco normal, dependência, fórmula, adoção, preço de
  produto ou arquivo web foi alterado. Nenhum commit foi criado.

### Marco 3D.1 concluído — 09/10/2026

- Entrega: adoção explícita de uma versão finalizada em
  `POST /api/pricing/products/:productId/adoptions`, com DTO protegido,
  autorização por papel, validação integral do histórico congelado e limite
  exato de `Product.salePrice` antes da conversão decimal.
- Atomicidade e concorrência: o produto é bloqueado com `FOR UPDATE`; preço,
  ponteiro, evento e auditoria pertencem à mesma transação. Retry sequencial ou
  concorrente do estado atual retorna sucesso sem duplicar efeitos; A → B → A
  cria três decisões. Somente `P2034` vira conflito conhecido.
- Segurança: recursos externos são indistinguíveis dos inexistentes. Adoção
  abaixo do mínimo exige `OWNER`/`ADMIN`, confirmação exata e justificativa. O
  texto fica somente no evento; metadados de auditoria não incluem snapshot,
  custos, componentes, deduções ou decomposição.
- Evidência direcionada: 43 testes unitários em três arquivos. O runner aprovou
  62 testes E2E em seis arquivos depois de aplicar as 16 migrations somente no
  banco descartável `pricing_configuration_e2e_6c0d98ec2707ad19`; esse banco e
  a prova separada de limpeza após erro foram removidos.
- A suíte unitária completa da API aprovou 221 testes em 20 arquivos; typecheck,
  lint e build também passaram.
- Limites: alteração manual de `salePrice`, resumo comercial, restrição legada
  de `directCost`, integração com orçamentos/pedidos e interface web continuam
  pendentes.
- Nenhum schema, migration, banco normal, dependência, fórmula, endpoint legado,
  orçamento, pedido ou arquivo web foi alterado. Nenhum commit foi criado.

### Marco 3D.2 concluído — 09/10/2026

- Entrega: o `PATCH /api/products/:productId` preserva preço e ponteiro quando
  `salePrice` é omitido. Uma string, `null` ou valor igual exige `OWNER`/`ADMIN`,
  limpa o ponteiro e cria exatamente uma auditoria
  `product_price.manually_changed`; `OPERATIONS` permanece autorizado para os
  outros campos.
- O resumo em `GET /api/pricing/products/:productId/summary` retorna somente
  `productId`, `currency`, `salePrice`, `priceOrigin` e `hasComposition` aos
  cinco papéis autenticados. Lista e detalhe legados usam selects sem
  `directCost` para `VIEWER` e mantêm o campo para os demais papéis.
- Atomicidade e concorrência: produto, preço, ponteiro, demais campos e auditoria
  manual pertencem à mesma transação sob `FOR UPDATE`. E2E comprovou rollback em
  falha forçada, ausência de evento de adoção manual e serialização coerente
  entre adoção e alteração manual, sem efeitos em estoque ou financeiro.
- Evidência direcionada: 29 testes unitários em dois arquivos. O runner aprovou
  79 testes E2E em sete arquivos depois de aplicar as 16 migrations somente no
  banco descartável `pricing_configuration_e2e_d33d97bc9e2acf0b`; esse banco e
  a prova `pricing_configuration_e2e_cleanup_d33d97bc9e2acf0b` foram removidos.
- A suíte unitária completa da API aprovou 241 testes em 21 arquivos; typecheck,
  lint e build também passaram.
- Limites: interface web e integração da origem comercial com orçamentos e
  pedidos permanecem pendentes. Nenhum schema, migration, dependência, fórmula,
  snapshot, banco normal ou arquivo web foi alterado. Nenhum commit foi criado.

### Marco 4A concluído documentalmente — 10/10/2026

- A auditoria confirmou que React Router, TanStack Query, React Hook Form, Zod,
  Tailwind, `@base-ui/react` e Vitest/Testing Library suportam a interface sem
  refactor estrutural ou dependência imediata.
- A ADR-008 aprovada define rotas integradas a Produtos, divisão 4B.1–4E e uma
  prévia híbrida com pacote compartilhado, strings decimais canônicas, query keys,
  invalidações, permissões, componentes, erros e testes.
- O baseline web aprovou typecheck, lint, 68 testes em 22 arquivos e build de
  produção. A documentação completa passou no Prettier e em `git diff --check`.
- A revisão humana aprovou `isAdopted: boolean` nos contratos internos de lista
  e detalhe de versões. A projeção dinâmica não é persistida e sua implementação
  com testes próprios precederá a interface de histórico do Marco 4D.
- Nenhum código funcional ou contrato HTTP implementado, dependência, schema,
  migration, banco, fórmula ou exemplo foi alterado. A extensão futura
  `isAdopted` foi apenas documentada. A interface continua pendente e nenhum
  requisito de interface foi promovido na rastreabilidade.

### Marco 4B.1 concluído — 10/10/2026

- Entrega: `@meinager/pricing-calculator` foi criado como pacote ESM privado e
  compatível com Node e navegador. É a fonte única da fórmula
  `margin-divisor-v1`, dos tipos, dos erros e dos helpers decimais puros; gera
  JavaScript e declarações TypeScript em `dist`, que permanece ignorado.
- A única suíte canônica completa está em
  `packages/pricing-calculator/src/pricing-calculator.spec.ts`: 77 de 77 testes
  passaram. Uma execução nominal separada aprovou EX-001 a EX-012 sem mudança
  de expectativa, fórmula, precisão ou arredondamento.
- A API conserva reexports finos em `apps/api/src/pricing/calculator/` e três
  testes mínimos de identidade, tipos, `formulaVersion`, resultado e erro. Seus
  comandos diretos de typecheck, teste e build constroem incrementalmente o
  pacote antes de consumir seus exports; 167 testes em 21 arquivos passaram.
- `decimal.js` 10.6.0 passou a pertencer diretamente ao pacote compartilhado.
  A busca não encontrou import direto restante na API; o adaptador de
  `Prisma.Decimal` não foi movido.
- O runner PostgreSQL descartável aplicou as 16 migrations e aprovou 79 testes
  E2E em sete arquivos. Os bancos
  `pricing_configuration_e2e_f0df9c75e7a14b54` e
  `pricing_configuration_e2e_cleanup_f0df9c75e7a14b54` foram removidos, assim
  como o contêiner efêmero; o banco normal não foi usado.
- Os pipelines raiz de typecheck, lint, teste e build passaram nos três
  packages. As suítes executadas somam 312 testes: 77 do pacote, 167 da API e
  68 da web. O build confirmou a ordem de workspace entre o pacote e a API.
- Limites: a web ainda não depende do pacote; recálculo local, prévia,
  interface, `isAdopted` e integrações com orçamentos e pedidos permanecem para
  os marcos aprovados seguintes. Nenhum código web, contrato HTTP, snapshot,
  schema, migration, banco normal ou fórmula foi alterado, e nenhum commit foi
  criado.

### Correção do bootstrap do Marco 4B.1 — 13/10/2026

- `turbo.json` passou a fazer `dev` depender do build das dependências de
  workspace. `@meinager/pricing-calculator` possui um task `dev` com
  `tsc -b --watch`, mantendo `dist` sincronizado durante o desenvolvimento.
- O runner `configuration-e2e-postgres.cjs` executa o build do pacote antes de
  abrir a conexão administrativa e criar seus bancos. Assim, a chamada direta
  a Vitest não depende do lifecycle `pretest` nem de artefato residual.
- Prova de desenvolvimento: depois do clean oficial, `dist/index.js` estava
  ausente; o grafo seco mostrou `api#dev` dependente de
  `pricing-calculator#build`; `pnpm dev` iniciou Vite, o watcher e Nest em
  `PORT=3100`. O watcher detectou o toque em `src/index.ts`, recompilou sem erro,
  e todos os processos foram encerrados por `Ctrl+C` sem órfãos.
- Prova E2E independente: uma segunda limpeza confirmou novamente a ausência de
  `dist/index.js`. O runner construiu o pacote como sua primeira ação, aplicou
  as 16 migrations somente no banco descartável e aprovou 79 testes em sete
  arquivos. Os bancos `pricing_configuration_e2e_31e8b1e658d53993` e
  `pricing_configuration_e2e_cleanup_31e8b1e658d53993`, além do contêiner em
  tmpfs, foram removidos.
- Regressão: 77 testes do pacote, três testes de compatibilidade e 167 testes em
  21 arquivos da API passaram. Typecheck, lint e build passaram tanto nos
  comandos diretos da API quanto nos três packages pelo Turbo.
- `dist`, `.turbo`, `node_modules` e `*.tsbuildinfo` continuam ignorados. A
  correção não alterou fórmula, testes canônicos, contrato HTTP, snapshot,
  schema, migration, banco normal, interface ou estados da rastreabilidade.

### Marco 4B.2 concluído — 13/10/2026

- Contratos Zod estritos validam o resumo comercial, strings decimais sem
  expoente, erros estáveis e a entrada mínima do preço manual. `ApiError`
  preserva `status`, `statusCode`, `message`, `code`, `field` e os detalhes de
  revisão aprovados, com fallback seguro para corpos incompatíveis.
- Uma factory central fornece as chaves de configuração, perfis, resumo,
  composição e versões. Somente resumo e preço manual possuem operações HTTP
  neste marco. A mutation invalida resumo, produtos legados e o prefixo de
  versões, que cobre listas e detalhes sem inspecionar seus dados nem antecipar
  `isAdopted`.
- A política visual cobre os cinco papéis. Todos consultam o resumo;
  `OWNER`/`ADMIN` executam preço manual; `OPERATIONS` mantém a edição comum de
  produto e futura composição; `FINANCE` possui leitura interna; `VIEWER` não
  recebe custo nem dispara consulta interna de precificação.
- O diálogo Base UI mantém valores como texto, aceita ponto ou uma vírgula,
  preserva a entrada durante a edição e envia sua forma decimal canônica,
  `null` ou valor igual de forma explícita. A canonicalização é textual, não
  arredonda e valida o limite comercial `Decimal(14,2)`. O diálogo explica a
  limpeza da origem versionada e possui label, erro associado, foco inicial,
  Escape, retorno de foco e feedback anunciado. Respostas `403` continuam
  visíveis.
- O resumo comercial apresenta preço em BRL, origem e existência de composição,
  com estados de loading, erro/retry e ausência, sem custo, margem, lucro,
  dedução, snapshot ou identificador interno.
- Validação: 62 testes direcionados passaram; a web aprovou 124 testes em 31
  arquivos, typecheck, lint e build. Os pipelines raiz aprovaram 77 testes do
  pacote, 167 da API e 124 da web, totalizando 368, além de typecheck, lint e
  build nos três packages.
- Limites: configuração, perfis, composição, prévia local, simulação, versões,
  `isAdopted`, adoção e acabamento integral continuam nos marcos seguintes. Não
  houve alteração em API, schema, migration, banco, pacote matemático, fórmula,
  snapshot, dependência, orçamento, pedido, estoque ou financeiro.

### Marco 4B.3 concluído — 13/10/2026

- Contratos Zod estritos representam exatamente a configuração atual, sua
  revisão, sete proveniências versionadas e o PATCH parcial. IDs protegidos,
  campos gerados, propriedades desconhecidas e decimais não canônicos são
  rejeitados antes do HTTP.
- O formulário React Hook Form apresenta percentuais em unidade humana,
  preserva a string digitada e converte para fração canônica somente ao salvar.
  Custos fixos `RATE`/`MONTHLY`, mão de obra, campos anuláveis e proveniências
  seguem as condições do service existente.
- `OWNER` e `ADMIN` criam e editam; `OPERATIONS` e `FINANCE` possuem leitura;
  `VIEWER` vê apenas indisponibilidade e não dispara GET interno. A API continua
  autoritativa para `401`, `403`, validação e concorrência.
- O PATCH usa `expectedRevision: null` na criação e a revisão positiva carregada
  nas atualizações. Diferenças canônicas determinam o payload e suas origens;
  mudanças exclusivas de proveniência também são persistidas. Cancelamento
  restaura o persistido, e conflitos preservam o rascunho até um GET realmente
  bem-sucedido.
- Rascunhos editáveis bloqueiam navegação interna e `beforeunload`, com diálogo
  acessível antes do descarte. Modos limpo e somente leitura não bloqueiam.
- Validação: 94 testes direcionados passaram; a web aprovou 178 testes em 35
  arquivos. Os pipelines raiz aprovaram 77 testes do pacote, 167 da API e 178
  da web, totalizando 422, além de typecheck, lint e build nos três packages.
- Limites: perfis, composição, prévia local, simulação, versões, `isAdopted`,
  adoção e acabamento integral continuam nos marcos seguintes. Não houve
  alteração em API, pacote matemático, fórmula, snapshot, schema, migration,
  banco, dependência, orçamento, pedido, estoque ou financeiro.

### Marco 4B.4 concluído — 18/10/2026

- As rotas `/app/produtos/precificacao/perfis` e
  `/app/produtos/precificacao/perfis/:profileId` passaram a consumir os cinco
  endpoints existentes. A lista cobre paginação e estado; o detalhe preserva
  perfis inativos e suas revisões.
- Contratos Zod estritos validam lista, detalhe, deduções, proveniência,
  paginação e entradas de criação, atualização e desativação antes do cache ou
  do HTTP. Propriedades protegidas ou desconhecidas, `null` indevido e decimal
  não canônico são rejeitados.
- O formulário usa coleção ordenada, percentuais humanos convertidos por texto,
  proveniência permitida, PATCH parcial, no-op sem requisição, revisão esperada
  e substituição completa apenas quando as deduções mudam.
- Conflitos preservam o rascunho e bloqueiam outro salvamento. Recarga com erro
  mantém o formulário e permite nova tentativa; rascunhos de criação e edição
  também são protegidos em navegação interna e `beforeunload` por diálogo
  acessível.
- `OWNER`/`ADMIN` criam, editam e desativam; `OPERATIONS`/`FINANCE` consultam;
  `VIEWER` não recebe link, lista, detalhe, deduções, taxas ou proveniências e
  não inicia query interna.
- Validação: 31 testes direcionados passaram; a web aprovou 207 testes em 40
  arquivos. Os pipelines raiz aprovaram 77 testes do pacote, 167 da API e 207
  da web, totalizando 451, além de typecheck, lint e build nos três packages.
- Limites: composição, prévia local, simulação, versões, `isAdopted`, adoção e
  acabamento integral continuam nos marcos seguintes. Não houve alteração em
  API, pacote matemático, fórmula, snapshot, schema, migration, banco,
  dependência, orçamento, pedido, estoque ou financeiro.

### Marco 4C.1 concluído — 19/10/2026

- `/app/produtos/:productId/precificacao` passou a consultar, criar e substituir
  a composição persistida pelos endpoints existentes. A tela identifica o
  produto, mostra revisão e estados de ausência, loading, erro e retry.
- Contratos Zod estritos rejeitam propriedades protegidas, estruturas
  incompatíveis, decimais não canônicos e combinações inválidas de mão de obra,
  frete, proveniência e origem do componente.
- O formulário mantém decimais como texto, envia a coleção completa na ordem
  visual e suporta adicionar, remover e mover componentes. Perfis inativos já
  vinculados são preservados; autorreferência e custo persistido de `CATALOG`
  são impedidos antes do PUT.
- `OWNER`/`ADMIN`/`OPERATIONS` editam, `FINANCE` lê e `VIEWER` não dispara query
  interna nem recebe custos, margem, perfil, componentes ou proveniência.
- Quarenta e dois testes direcionados passaram. A suíte web possui 247 testes em
  42 arquivos e limita centralmente a concorrência a quatro workers para evitar
  contenção de recursos entre testes React/JSDOM, sem alterar os scripts ou os
  timeouts. Duas execuções oficiais consecutivas passaram sem parâmetros
  adicionais.
- Limites: prévia local, simulação web, versões, `isAdopted`, adoção e acabamento
  integral permanecem nos Marcos 4C.2 em diante. Nenhuma API, fórmula, snapshot,
  schema, migration, dependência, orçamento, pedido, estoque ou financeiro foi
  alterado.

### Marco 4C.2 concluído — 20/10/2026

- Entrega: prévia financeira local no editor da composição, alimentada pelo
  pacote compartilhado e por um adaptador puro equivalente à resolução da API.
  O painel cobre preços, custos, componentes, mão de obra, frete, deduções,
  lucro, margens, diferença, desconto, classificação, avisos e fórmula.
- A troca de perfil consulta seu detalhe e suspende o resultado até receber as
  deduções atuais. Configuração ausente, parâmetros obrigatórios ausentes,
  perfil inativo, catálogo incompatível, rascunho incompleto e erros tipados do
  motor possuem estados explícitos sem resultado antigo.
- Segurança: `VIEWER` não carrega o chunk do editor/motor nem faz consultas
  internas. Os quatro papéis internos recebem a prévia; `FINANCE` permanece em
  leitura. A edição local não chama `/simulations` e não escreve composição,
  produto, versão, snapshot ou auditoria.
- Evidência: os testes web cobrem EX-001/EX-002 pelo adaptador, os três tipos de
  custo, origem e precedência da margem, parâmetros, perfil, catálogo, frete,
  preço atual, estados, papéis, ausência de escrita e cálculo representativo
  abaixo de 100 ms. A suíte web passou com 280 testes em 43 arquivos, mantendo
  quatro workers e sem ampliar timeouts.
- Limites: a prévia não é autoritativa. Simulação HTTP, versões, histórico,
  `isAdopted`, adoção e acabamento integral permanecem nos Marcos 4D e 4E.
  Nenhuma API, fórmula, snapshot, schema, migration ou banco foi alterado.

### Marco 4D.1 concluído — 22/10/2026

- Lista e detalhe internos de versões incluem `isAdopted`, calculado pela
  comparação entre `Product.adoptedPricingVersionId` e o identificador da
  versão. O select relacional traz somente o ponteiro junto com a versão, sem
  consulta adicional por item, lock de escrita, persistência ou auditoria.
- O POST de criação de versão, o resumo comercial e os contratos de entrada não
  receberam o campo. `VIEWER` continua proibido, e organização e produto seguem
  filtrados pela sessão.
- Unitários cobrem versão adotada, versões não correspondentes, ponteiro nulo,
  adoção fora da página, detalhe, paginação, ordenação, ausência de snapshot e
  de N+1 ou escrita. A API aprovou 171 testes em 21 arquivos.
- O runner PostgreSQL descartável aprovou 80 testes E2E em sete arquivos. Ele
  comprovou versões inicialmente falsas, adoções A–B, limpeza por preço manual,
  papéis, isolamento e preservação de snapshot/projeções. As bases
  `pricing_configuration_e2e_07a0fc27d61d7492` e
  `pricing_configuration_e2e_cleanup_07a0fc27d61d7492` foram removidas.
- Os pipelines raiz aprovaram typecheck, lint, 528 testes e build nos três
  packages: 77 testes do pacote, 171 da API e 280 da web.
- Limites: simulação autoritativa, histórico e adoção na interface permanecem
  nos Marcos 4D.2–4D.4; acabamento integral permanece no Marco 4E. Nenhum
  schema, migration, snapshot, fórmula, dependência ou código web foi alterado.

### Revisão crítica do Marco 4D.1 — 24/10/2026

- O pacote de revisão e os oito arquivos alterados da árvore real foram
  confrontados byte a byte. A projeção permanece restrita aos GETs de lista e
  detalhe e deriva somente da igualdade entre o ponteiro atual do produto e o
  identificador da versão; POST, resumo comercial, DTOs, schema e migrations
  continuam sem `isAdopted`.
- A cobertura E2E passou a rejeitar `isAdopted` como entrada do POST, comprovar
  que todos os itens da página são `false` quando a versão adotada está fora
  dela e comparar integralmente snapshot, componentes e deduções antes e depois
  das transições de adoção e do preço manual.
- A validação aprovou 72 testes unitários direcionados, 171 testes da API em 21
  arquivos e 80 E2E em sete arquivos. O runner aplicou 16 migrations e removeu
  as bases descartáveis `pricing_configuration_e2e_da85d4c1eb4cd5cf` e
  `pricing_configuration_e2e_cleanup_da85d4c1eb4cd5cf`.
- Os pipelines raiz aprovaram typecheck, lint, 528 testes e build nos três
  packages: 77 testes do pacote, 171 da API e 280 da web. Nenhuma fórmula,
  persistência, rota, permissão ou implementação de interface foi alterada.

### Marco 4D.2 concluído — 25/10/2026

- O editor preserva a prévia local e oferece confirmação explícita por
  `POST /api/pricing/products/:productId/simulations` para `OWNER`, `ADMIN` e
  `OPERATIONS`. `FINANCE` continua somente com a prévia local e `VIEWER` não
  carrega o editor nem inicia consultas internas.
- A web envia `PERSISTED` quando o formulário é semanticamente igual à
  composição salva e `DRAFT` para composição nova ou qualquer mudança efetiva.
  O adaptador reutiliza a canonicalização da composição, preserva a ordem dos
  componentes e omite revisão, identificadores internos, resultados e custo
  persistido de componentes `CATALOG`.
- Contratos Zod estritos validam payloads e a resposta integral, incluindo
  referências usadas, margem efetiva, entrada resolvida, resultado completo e
  fórmula. Decimais permanecem strings canônicas, inclusive `0.00000001`.
- A confirmação fica fora do React Hook Form e do cache de queries. Alteração
  semântica posterior a marca como desatualizada; texto decimal equivalente
  não gera falsa divergência. Salvar, cancelar ou recarregar descarta o estado
  transitório.
- A paridade compara o resultado integral e a fórmula da prévia com a resposta
  autoritativa. Divergências são exibidas sem alterar o rascunho, arredondar ou
  criar versão. Erros estruturados possuem retry e respostas inválidas usam
  mensagem segura sem detalhes internos.
- A suíte web aprovou 314 testes em 47 arquivos, mantendo quatro workers e os
  timeouts existentes. Criação de versão, histórico visual, `isAdopted` na web,
  adoção e acabamento permanecem nos Marcos 4D.3–4E.

### Revisão crítica do Marco 4D.2 — 25/10/2026

- O contrato de resposta passou a exigir as coleções de componentes e deduções
  sempre devolvidas pelo service da API. Respostas 200 inválidas ou malformadas
  apresentam erro genérico, sem expor os detalhes da validação runtime.
- Uma nova tentativa remove a confirmação anterior; respostas atrasadas após
  salvar, cancelar ou recarregar são ignoradas. A paridade é avaliada contra a
  prévia local vigente, inclusive após atualização das dependências de leitura.
- Testes específicos cobrem ausência de coleções obrigatórias, erro seguro,
  falha após confirmação anterior e resposta recebida após Cancelar. A web
  aprovou 314 testes em 47 arquivos; os pipelines raiz aprovaram 562 testes
  nos três packages, além de typecheck, lint e build.

### Marco 4D.3 concluído — 26/10/2026

- A página de precificação cria versões somente da composição persistida após
  simulação `PERSISTED` vigente, revisão idêntica e paridade integral com a
  prévia. O POST envia apenas `expectedCompositionRevision` e, se houver,
  `adoptedPrice` do preço atual. A confirmação é consumida após o sucesso;
  conflitos preservam o formulário e exigem GET explícito e nova simulação.
- Lista paginada e detalhe em diálogo acessível apresentam snapshots,
  projeções, decomposição, proveniências e autoria congeladas. O indicador
  textual `isAdopted` vem dos GETs e não é inferido do preço nem persistido na
  web. `FINANCE` lê sem criar; `VIEWER` não inicia consulta interna.
- Contratos Zod estritos separam payload, POST, lista, detalhe e snapshot v1.
  Criação invalida somente listas de versões do produto e preserva detalhes
  históricos em cache. Erros de histórico ficam isolados do editor.
- Testes dirigidos cobrem contratos, API, cache, permissões, pré-condições,
  duplo envio, revisão, preço opcional, paginação, `isAdopted`, diálogo e retry.
  A suíte web oficial aprovou 338 testes em 50 arquivos; `pnpm test` aprovou
  586 testes nos três packages (77 pacote, 171 API e 338 web). Typecheck,
  lint e build da web e da raiz passaram. Não houve banco, backend, versão
  criada em ambiente real ou adoção.
- Limites: adoção web, orçamentos, pedidos e acabamento do Marco 4E permanecem
  pendentes.

### Revisão crítica do Marco 4D.3 — 27/10/2026

- O contrato inicial da web rejeitava preços comerciais legítimos com zero
  final porque tratava as colunas `Text` da versão como decimais sem casas
  redundantes. Contrato e fixtures agora preservam as duas casas que a API
  grava. Testes de contrato cobrem o retorno `90.90`.
- A autorização de criação confere produto, revisão de composição, revisão de
  configuração, revisão do perfil, entradas resolvidas, precedência e origem
  da margem efetiva e preço analisado da simulação vigente. As
  respostas de POST e detalhe são rejeitadas se pertencerem a outro produto,
  revisão ou versão. Projeções de componentes, deduções e proveniências são
  verificadas contra o snapshot congelado. A troca de produto reinicia o editor
  local.
- Testes direcionados: 66 aprovados em cinco arquivos. A suíte web oficial
  aprovou 338 testes em 50 arquivos; a raiz aprovou 586 testes (77 pacote, 171
  API, 338 web), além de typecheck, lint e build. Nenhum backend, schema,
  migration, fórmula ou banco foi alterado ou utilizado nesta revisão.

### Marco 4D.4 — adoção web — 27/10/2026

- A adoção parte somente de uma versão finalizada apresentada no histórico. O
  diálogo confirma o preço analisado congelado; abaixo do mínimo exige papel
  OWNER/ADMIN, confirmação explícita e justificativa não vazia. FINANCE mantém
  leitura, OPERATIONS adota somente versões que não estejam abaixo do mínimo e
  VIEWER continua sem consultas internas.
- O POST envia `versionId` e, quando necessários, confirmação e justificativa.
  Contratos Zod estritos validam entrada e resposta, inclusive produto e versão
  solicitados; o frontend não envia preço, resultado ou snapshot. A resposta
  idempotente é exibida como confirmação do estado pelo servidor, sem afirmar
  que ocorreu uma nova transição. Falhas mantêm o diálogo e o rascunho.
- Sucesso invalida resumo comercial, consultas de produtos e o prefixo de listas
  e detalhes de versões. Não altera cache histórico congelado nem composição;
  a confirmação de simulação anterior é descartada para impedir criação de
  versão baseada no preço antigo. Não há retry automático da mutation.
- Validação executada: 356 testes web em 52 arquivos; typecheck, lint, test e
  build da web e da raiz aprovados. Os pipelines raiz aprovaram 604 testes
  (77 pacote, 171 API, 356 web). Integração com orçamentos/pedidos e acabamento
  integral do Marco 4E permanecem pendentes. Nenhum banco foi usado.

### Revisão crítica do Marco 4D.4 — 28/10/2026

- A justificativa permanecia em `mutation.variables` do TanStack Query após a
  resposta. A adoção agora usa estado local ao diálogo, sem criar entrada no
  `MutationCache`; o texto continua editável em erro e é descartado após
  sucesso ou fechamento. O restante das mutations não foi alterado.
- Falhas de rede, respostas 2xx incompatíveis e erros 5xx deixam o resultado da
  transação desconhecido. Nesses casos, a web invalida resumo, listas de
  produtos, detalhe do produto original e versões mesmo após desmontagem,
  preserva o diálogo e oferece verificação explícita ou nova tentativa. A
  confirmação antiga da simulação é descartada também nesses cenários.
- Uma resposta tardia da adoção não altera a nova seleção; uma simulação
  iniciada antes da adoção não restaura autorização para criar versão ao
  terminar depois. Retries idempotentes de uma versão abaixo do mínimo já
  indicada como adotada usam apenas `versionId`; novas transições exigem
  confirmação e justificativa, verificadas pelo backend.
- Testes direcionados da revisão: 65 aprovados em dois arquivos. A suíte web
  oficial aprovou 361 testes em 52 arquivos e a raiz aprovou 609 testes (77
  pacote, 171 API e 361 web), além de typecheck, lint e build. Nenhum banco,
  backend, schema, migration, fórmula ou dependência foi alterado ou usado.

### Marco 4E.1 — revisão por código e componentes — 31/10/2026

- Quatro testes novos comprovam que respostas 2xx inválidas de resumo,
  configuração, composição e perfis são rejeitadas com mensagem segura. Foram
  mantidos os schemas runtime estritos e a validação da API como autoridade.
- Diálogos de adoção, detalhe e descarte da composição receberam limite de
  altura e rolagem local para evitar corte do conteúdo em viewport pequena.
  Esta correção de CSS ainda requer inspeção em navegador real.
- Testes direcionados: 97 aprovados em quatro arquivos. A suíte web oficial
  aprovou 365 testes em 53 arquivos; a raiz aprovou 613 testes (77 motor, 171
  API e 365 web). Typecheck, lint e build da web e da raiz passaram.
- A evidência desta rodada é de código e componentes com mocks. Não houve
  inspeção em navegador nem fluxo real web → API → PostgreSQL. O próximo recorte
  do Marco 4E deve validar 360/768/1280 px, zoom de 200%, teclado/foco e o
  percurso integrado em infraestrutura descartável; o Marco 4E permanece
  aberto. Orçamentos e pedidos continuam no Marco 5.
