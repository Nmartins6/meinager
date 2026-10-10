# Matriz de rastreabilidade de requisitos

## 1. Finalidade

Este documento relaciona os requisitos do Meinager com a implementação
existente e com o trabalho ainda necessário.

Última revisão inicial: 02/10/2026.

Correções da auditoria técnica do Marco 0: 02/10/2026. Evidências detalhadas
em `docs/plans/pricing-engine.md`, seção `Descobertas`. Nenhum requisito novo
de precificação foi implementado nesta revisão.

Revisão do Marco 1: 03/10/2026. Motor puro concluído após correção dos
resultados documentais de EX-001/EX-002, autorizada por validação matemática
independente. Os 77 testes do motor e os 98 testes da API passaram. Os estados
abaixo distinguem a base matemática testada das integrações ainda ausentes.

Revisão da fundação de persistência: 05/10/2026. O commit `9427866` versionou os
modelos de precificação e a migration
`20261003181002_add_pricing_persistence`. Em 04/10/2026, a migration foi aplicada
somente ao banco local de desenvolvimento; a validação local mostrou 16
migrations e banco atualizado, sem comprovar outros ambientes. Essa evidência
estrutural não promove requisitos que ainda dependem de services, API, auditoria
da aplicação ou interface.

Revisão do Marco 3B.1: 05/10/2026. Os endpoints de configuração organizacional
possuem service versionado, autorização, isolamento, validação decimal,
auditoria atômica e testes de concorrência. A evidência é limitada à
configuração; perfis e os demais casos de uso da API permanecem pendentes.

Revisão do Marco 3B.2: 06/10/2026. Perfis e deduções possuem API versionada,
autorização, isolamento, auditoria, no-op e concorrência comprovados em banco
descartável. A integração desses perfis ao cálculo e ao snapshot permanece
pendente no Marco 3C.

Revisão do Marco 3C.1: 06/10/2026. Composições de produto possuem consulta e
substituição completa com revisão esperada, componentes ordenados, referências
de catálogo validadas, isolamento, auditoria e concorrência comprovados em banco
descartável. Simulação, snapshots, versões, histórico e adoção permanecem
pendentes nas próximas subetapas do Marco 3. A validação aprovou 10 testes
unitários direcionados, 40 E2E e 139 testes na suíte unitária completa da API.

Correção de serialização do Marco 3C.1: 07/10/2026. Um helper compartilhado
passou a serializar `Prisma.Decimal` com `toFixed()` sem precisão fixa em
configuração, perfis e composição. Testes unitários e E2E comprovam que
`0.00000001` persiste, retorna sem expoente e pode ser reenviado como no-op sem
nova revisão ou auditoria. A validação atual aprovou 36 testes unitários
direcionados, 43 E2E e 140 testes em 13 arquivos na suíte unitária completa da
API.

Revisão do Marco 3C.2: 07/10/2026. A simulação autoritativa passou a resolver
configuração, perfil, composição ou rascunho e catálogo em `REPEATABLE READ`,
sem persistir versão ou alterar estado comercial. A validação aprovou 24 testes
unitários direcionados, 54 E2E e 160 testes em 15 arquivos na suíte unitária
completa da API.

Revisão do Marco 3C.3: 08/10/2026. O snapshot v1 possui validação runtime e
replay canônico; criação, lista e detalhe de versões possuem autorização,
isolamento, imutabilidade, congelamento histórico, auditoria, rollback e
concorrência cobertos. A validação aprovou 29 testes unitários direcionados, 57
E2E em banco descartável e 189 testes em 18 arquivos na suíte unitária completa
da API. Adoção, integração comercial e interface permanecem pendentes.

Revisão do Marco 3D.1: 09/10/2026. A API adota versões finalizadas de forma
atômica, valida exclusivamente o histórico congelado, aplica a matriz de papéis,
registra evento e auditoria e garante idempotência sob lock do produto. A
validação aprovou 40 testes unitários direcionados, 61 E2E em PostgreSQL
descartável e 218 testes em 20 arquivos na suíte unitária completa da API.
Alteração manual do preço, resumo comercial, compatibilidade de `directCost` e
interface permanecem pendentes.

Revisão do Marco 3D.2: 09/10/2026. O preço manual explícito agora limpa a
versão adotada e audita a decisão atomicamente; omissão preserva preço e origem.
O resumo comercial expõe somente cinco campos, e os endpoints legados de
produto não consultam nem retornam `directCost` para `VIEWER`. A validação
aprovou 29 testes unitários direcionados, 79 E2E em PostgreSQL descartável e
241 testes em 21 arquivos na suíte unitária completa da API. Interface web e
integração da origem comercial com orçamentos e pedidos permanecem pendentes.

A matriz deve ser atualizada durante a implementação. Um requisito somente pode
ser marcado como implementado quando possuir evidência de código e validação
automatizada aplicável.

## 2. Estados

| Estado        | Significado                                                          |
| ------------- | -------------------------------------------------------------------- |
| `IMPLEMENTED` | Comportamento disponível e coberto pela implementação atual          |
| `PARTIAL`     | Existe uma base reutilizável, mas o requisito ainda exige alterações |
| `PENDING`     | Funcionalidade ainda não implementada                                |
| `VERIFY`      | Há indícios de implementação, mas é necessária inspeção detalhada    |
| `FUTURE`      | Evolução prevista fora da primeira entrega da precificação           |

## 3. Evidências gerais do repositório

### Backend

A API possui módulos para:

- autenticação e sessão;
- autorização por papel;
- clientes;
- produtos;
- estoque;
- categorias financeiras;
- contas financeiras;
- lançamentos;
- baixas;
- períodos;
- resumo financeiro;
- orçamentos;
- pedidos;
- fluxos configuráveis de pedidos;
- saúde da aplicação;
- configuração organizacional de precificação.
- perfis de venda e deduções de precificação;
- composições de custos de produtos.
- simulações autoritativas de precificação;
- snapshots e versões históricas de cálculo.
- adoção atômica de versões de precificação.
- alteração manual auditada e resumo comercial de precificação.

A auditoria utiliza o modelo `AuditLog` e gravações nos services dos módulos;
não existe módulo Nest específico de auditoria. `PricingConfigurationService`
também grava seu evento na transação da mutação.

### Frontend

A aplicação web possui funcionalidades e páginas para:

- autenticação;
- clientes;
- produtos;
- estoque;
- financeiro;
- orçamentos;
- pedidos;
- configuração de fluxos de pedidos.

### Persistência

O schema Prisma possui modelos para:

- usuários e organizações;
- membros e sessões;
- auditoria;
- clientes;
- produtos;
- movimentações de estoque;
- orçamentos e itens;
- pedidos e itens;
- fluxos, etapas e transições;
- períodos financeiros;
- categorias;
- contas;
- lançamentos;
- baixas;
- configuração e revisões de precificação;
- perfis, revisões e deduções;
- composições e componentes;
- versões, projeções e adoções de preço.

A fundação persistente de precificação está versionada no commit `9427866`, em
`apps/api/prisma/schema.prisma` e na migration
`20261003181002_add_pricing_persistence`. A aplicação da migration comprovada em
04/10/2026 limita-se ao banco local de desenvolvimento. Os casos de uso ainda
pendentes não são promovidos pelas APIs já entregues de configuração, perfis e
composição.

## 4. Situação dos módulos gerais

| Área                             | Estado        | Evidência atual                                                                                                | Trabalho necessário                             |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Autenticação                     | `IMPLEMENTED` | `apps/api/src/auth` e `apps/web/src/features/auth`                                                             | Preservar                                       |
| Sessões                          | `IMPLEMENTED` | `apps/api/src/auth/session`                                                                                    | Preservar                                       |
| Autorização por papel            | `IMPLEMENTED` | `apps/api/src/auth/authorization`                                                                              | Reutilizar na precificação                      |
| Isolamento por organização       | `IMPLEMENTED` | Serviços existentes e modelos organizacionais                                                                  | Cobrir novos recursos                           |
| Auditoria                        | `PARTIAL`     | Modelo `AuditLog` e usos existentes                                                                            | Adicionar ações de precificação                 |
| Clientes                         | `IMPLEMENTED` | `apps/api/src/clients` e páginas de clientes                                                                   | Preservar                                       |
| LTV de clientes                  | `PENDING`     | Sem evidência específica                                                                                       | Implementar em evolução posterior               |
| Produtos e serviços              | `IMPLEMENTED` | `apps/api/src/products` e páginas de produtos                                                                  | Estender sem quebrar preços atuais              |
| Estoque                          | `IMPLEMENTED` | `apps/api/src/inventory`                                                                                       | Permitir referência a insumos                   |
| Categorias financeiras           | `IMPLEMENTED` | `FinancialCategory.type` (`FIXED_EXPENSE`) no schema e `apps/api/src/finance/categories/categories.service.ts` | Reutilizar classificação explícita já existente |
| Contas financeiras               | `IMPLEMENTED` | `apps/api/src/finance/accounts`                                                                                | Preservar                                       |
| Lançamentos                      | `IMPLEMENTED` | `apps/api/src/finance/entries`                                                                                 | Reutilizar futuramente nos agregados            |
| Baixas financeiras               | `IMPLEMENTED` | `apps/api/src/finance/settlements`                                                                             | Reutilizar para receita realizada               |
| Períodos financeiros             | `IMPLEMENTED` | `apps/api/src/finance/periods`                                                                                 | Reutilizar na janela de faturamento             |
| Resumo financeiro                | `IMPLEMENTED` | `apps/api/src/finance/summary`                                                                                 | Estender futuramente                            |
| Recorrência financeira           | `VERIFY`      | Nenhum módulo específico identificado                                                                          | Inspecionar antes de planejar                   |
| Orçamentos                       | `IMPLEMENTED` | `apps/api/src/quotes` e páginas de orçamentos                                                                  | Acrescentar referência opcional de precificação |
| Pedidos                          | `IMPLEMENTED` | `apps/api/src/orders` e páginas de pedidos                                                                     | Preservar snapshots                             |
| Fluxos de pedidos                | `IMPLEMENTED` | `apps/api/src/order-workflows`                                                                                 | Não alterar pela precificação                   |
| Calendário                       | `PENDING`     | Nenhum módulo identificado                                                                                     | Evolução posterior                              |
| Notificações                     | `PENDING`     | Nenhum módulo identificado                                                                                     | Evolução posterior                              |
| Metas                            | `PENDING`     | Nenhum módulo identificado                                                                                     | Evolução posterior                              |
| Ponto de equilíbrio              | `PENDING`     | Nenhum módulo identificado                                                                                     | Evolução posterior                              |
| Backup e criptografia em repouso | `VERIFY`      | Responsabilidade de infraestrutura                                                                             | Documentar no plano de implantação              |

## 5. Rastreabilidade da precificação

### Evidências do motor puro — Marco 1

Os caminhos `calculator/pricing-calculator.ts` e
`calculator/pricing-calculator.spec.ts` abaixo são relativos a
`apps/api/src/pricing/`. A especificação de tipos está em
`calculator/pricing-calculator.types.ts`; validação/representação decimal em
`calculator/pricing-decimal.ts`; erros em `calculator/pricing-calculator.errors.ts`.
ADR-005 registra precisão e limites técnicos. Não há migration neste marco.

| Requisito                 | Estado        | Evidência de código e teste                                                                                                                                           | Limite da entrega                                                       |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EX-001                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-001 — precificação simples`: lucro exato `22.728`, exibido `22.73` e margem percentual `25.0005` com ROUND_HALF_UP | Expectativas corrigidas após validação independente; somente motor puro |
| EX-002                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-002 — precificação completa`: lucro exato `35.3453` e margem percentual `25.0002` com ROUND_HALF_UP                | Expectativas corrigidas após validação independente; somente motor puro |
| EX-003 a EX-012           | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, dez testes com os respectivos IDs no nome                                                                                    | Cenários matemáticos aprovados; sem integração de domínio               |
| PREC-CA-013 e PREC-CA-016 | `IMPLEMENTED` | `calculator/pricing-calculator.ts`; testes de componentes fracionários e negativos por campo                                                                          | Multiplicação e rejeição tipada no motor                                |
| PREC-CA-019 e PREC-CA-021 | `IMPLEMENTED` | Testes EX-009/EX-010 e denominadores ativos com numerador zero                                                                                                        | Validação condicional dos modos utilizados                              |
| PREC-CA-023 e PREC-CA-024 | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, testes EX-001 e EX-002 aprovados contra os resultados oficiais corrigidos                                                    | Cálculo simples e completo no motor puro                                |
| PREC-CA-025               | `IMPLEMENTED` | EX-006/EX-007 e divisor mínimo inválido com custo zero                                                                                                                | Erro tipado com mensagem, nenhum preço retornado                        |
| PREC-CA-030 e PREC-CA-032 | `PARTIAL`     | Simulação, versão e adoção preservam lucro, margem, classificação e avisos calculados pelo backend                                                                    | Exposição e adoção pela interface pendentes                             |
| PREC-CA-051 e PREC-CA-053 | `IMPLEMENTED` | EX-011, mínimo para cima, fronteiras de centavo e lucro residual                                                                                                      | Arredondamento e recálculo decimal no motor                             |
| PREC-CA-050               | `IMPLEMENTED` | EX-001 a EX-012 aprovados em `calculator/pricing-calculator.spec.ts`; precisão, grandes quantidades e divisores próximos de zero testados                             | Reprodução decimal dos exemplos no motor puro                           |
| PREC-CA-052               | `PARTIAL`     | `PricingMoney.display`, teste de half-up sem realimentar cálculo                                                                                                      | Formatação retornada pelo motor; exibição web pendente                  |

Evidência de execução em 03/10/2026: 77 de 77 testes do motor aprovados;
suíte completa da API com 98 testes aprovados em 7 arquivos. O bloqueio foi
removido após essas validações e a correção documental autorizada, sem alterar
fórmulas ou arredondar valores intermediários. Naquela validação, persistência,
endpoints, services e interface ainda estavam ausentes.

### Configuração da organização

| Critérios                     | Estado        | Base reutilizável                                                                                          | Implementação esperada                                                |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `PREC-CA-001` a `PREC-CA-004` | `IMPLEMENTED` | `PricingConfigurationService`, controller e E2E de criação, revisão, isolamento e faturamento zero         | Interface ainda pendente; cálculo derivado pertence à etapa posterior |
| `PREC-CA-005`                 | `PARTIAL`     | Valores mensais são persistidos e o motor sabe derivar a taxa                                              | Exposição do percentual derivado pela API e interface pendente        |
| `PREC-RN-001`                 | `PARTIAL`     | Filtro pela organização da sessão, relações compostas e E2E da configuração com duas organizações          | Comprovar isolamento nos demais recursos da API                       |
| `PREC-RN-002` e `PREC-RN-003` | `PARTIAL`     | Patch parcial de proveniência testado; versões congelam origens e confirmadores da configuração utilizada  | Integração automática com agregados financeiros permanece pendente    |
| `PREC-RN-004`                 | `IMPLEMENTED` | Vigência definida pelo backend; a versão referencia e congela a revisão vigente, preservada por guards SQL | Comprovado na criação e leitura histórica do Marco 3C.3               |
| `PREC-RN-005`                 | `PARTIAL`     | Faturamento zero é rejeitado e a proveniência aceita período e origem                                      | Garantir janela e origem do faturamento na configuração ou snapshot   |

### Perfis de deduções

| Critérios                     | Estado        | Base reutilizável                                                                                        | Implementação esperada                           |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `PREC-CA-006` a `PREC-CA-008` | `IMPLEMENTED` | Criação, nomes não vazios, deduções extensíveis, revisão e desativação comprovadas por unitários/E2E     | Interface web pendente, sem invalidar a API      |
| `PREC-CA-009`                 | `IMPLEMENTED` | Perfis externos são ocultados; composição, simulação e criação de versão validam o perfil da organização | Regra comprovada também no fluxo persistente     |
| `PREC-RN-021`                 | `IMPLEMENTED` | Versões congelam as deduções individualizadas e ordenadas do perfil atual no snapshot e nas projeções    | Interface web pendente                           |
| `PREC-RN-022`                 | `IMPLEMENTED` | Perfis organizacionais versionados para canais, com nomes e percentuais configuráveis                    | Interface web pendente                           |
| `PREC-RN-023`                 | `IMPLEMENTED` | Snapshot e projeções preservam cada dedução, taxa, origem, valor calculado e ordem                       | Comprovado por validação runtime e E2E histórico |

### Composição de custos

| Critérios                     | Estado        | Base reutilizável                                                                                                                                     | Implementação esperada |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `PREC-CA-010` e `PREC-CA-011` | `IMPLEMENTED` | API cria e substitui composição completa; E2E cobre as oito categorias, coleção ordenada e componentes `MANUAL`, `COPIED` e `CATALOG`                 | Interface web pendente |
| `PREC-CA-012` a `PREC-CA-016` | `IMPLEMENTED` | Criação de versão resolve `MANUAL`, `COPIED` e custo `CATALOG`, congela ordem, ID e custo efetivo; E2E altera depois o catálogo sem mudar o histórico | Interface web pendente |
| `PREC-RN-006` a `PREC-RN-011` | `IMPLEMENTED` | Motor único e backend autoritativo validam componentes, quantidades, custos e catálogo; snapshot imutável preserva a execução                         | Interface web pendente |

### Mão de obra

| Critérios                     | Estado    | Base reutilizável                                                                                                                   | Implementação esperada                    |
| ----------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `PREC-CA-017` a `PREC-CA-019` | `PARTIAL` | Simulação resolve configuração e tempo, calcula a memória de mão de obra e retorna erro estável quando os parâmetros estão ausentes | Conversão de campos da interface pendente |
| `PREC-RN-012` a `PREC-RN-015` | `PARTIAL` | Service resolve a mão de obra habilitada e o snapshot v1 congela parâmetros, tempo e memória calculada                              | Interface web pendente                    |

### Frete

| Critérios                     | Estado    | Base reutilizável                                                                                                  | Implementação esperada |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `PREC-CA-020` a `PREC-CA-022` | `PARTIAL` | API autoritativa cobre frete ausente, manual e rateado, incluindo quantidade zero e consumo padrão                 | Interface pendente     |
| `PREC-RN-016` e `PREC-RN-017` | `PARTIAL` | Service adapta os modos e o snapshot v1 congela entrada e resultado do frete, inclusive consumo padrão normalizado | Interface web pendente |

### Motor de cálculo

| Critérios                     | Estado        | Base reutilizável                                                                                                     | Implementação esperada                                    |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `PREC-CA-023` a `PREC-CA-028` | `PARTIAL`     | Simulação e criação de versão recalculam pelo backend, preservam resultado e decomposição e rejeitam divisor inválido | Interface web pendente                                    |
| `PREC-RN-018` a `PREC-RN-027` | `PARTIAL`     | Versão congela taxa fixa, deduções, margem, custos e resultado do `margin-divisor-v1`                                 | Exposição na interface pendente                           |
| `EX-001` a `EX-012`           | `IMPLEMENTED` | 12 testes aprovados, nomeados por exemplo em `calculator/pricing-calculator.spec.ts`                                  | Cenários matemáticos aprovados; sem integração de domínio |

### Preço adotado

| Critérios                     | Estado        | Base reutilizável                                                                                                     | Implementação esperada                       |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `PREC-CA-029` e `PREC-CA-031` | `IMPLEMENTED` | A versão sugerida ou personalizada é validada e adotada atomicamente; o produto recebe preço e ponteiro com auditoria | Comprovado por unitários e E2E do Marco 3D.1 |
| `PREC-CA-030` e `PREC-CA-032` | `PARTIAL`     | Criação de versão recalcula preços personalizados; adoção usa sua análise e classificação congeladas                  | Exposição e adoção pela interface pendentes  |
| `PREC-CA-033`                 | `IMPLEMENTED` | Somente OWNER/ADMIN confirmam preço abaixo do mínimo, com confirmação e justificativa; OPERATIONS recebe 403          | Comprovado por unitários e E2E               |
| `PREC-CA-034`                 | `PARTIAL`     | Simulação e versão não alteram preço; adoção e preço manual explícitos têm origens distintas no resumo comercial      | Exposição na interface web pendente          |
| `PREC-RN-028` a `PREC-RN-031` | `PARTIAL`     | Backend analisa preço personalizado, congela a memória e adota exatamente `analyzedPrice`, inclusive abaixo do mínimo | Fluxo e alertas da interface pendentes       |

### Decomposição e explicação

| Critérios                     | Estado        | Base reutilizável                                                                                 | Implementação esperada                |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `PREC-CA-026`                 | `PARTIAL`     | Simulação e detalhe histórico expõem decomposição completa em strings e ordem determinística      | Interface pendente                    |
| `PREC-RN-032` e `PREC-RN-033` | `IMPLEMENTED` | Snapshot v1 validado preserva entradas, resultado integral, configuração, fórmula, autoria e data | Interface web pendente                |
| `PREC-RN-034`                 | `PARTIAL`     | Simulação transitória e persistência explícita são separadas na API                               | Recálculo local da interface pendente |

### Histórico e snapshots

| Critérios                     | Estado        | Base reutilizável                                                                                                                  | Implementação esperada                                   |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `PREC-CA-035` a `PREC-CA-037` | `IMPLEMENTED` | POST cria versão finalizada imutável com snapshot v1, projeções, autoria, fórmula e auditoria; E2E prova preservação após mudanças | Adoção não faz parte destes critérios                    |
| `PREC-CA-038`                 | `PARTIAL`     | GET paginado e detalhe validado exibem versões finalizadas da mais recente para a mais antiga                                      | Identificação da versão do preço atual depende da adoção |
| `PREC-RN-035`                 | `IMPLEMENTED` | Cada cálculo salvo recebe número sequencial e snapshot imutável; concorrência real cria números únicos                             | Comprovado no Marco 3C.3                                 |
| `PREC-RN-036` a `PREC-RN-038` | `PARTIAL`     | Versões e auditoria de cálculo/adoção implementadas; snapshots comerciais de orçamento/pedido já existem                           | Integrar referências aos documentos comerciais           |

### Integração com produtos

| Critérios     | Estado        | Base reutilizável                                                                                                     | Implementação esperada                     |
| ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `PREC-CA-039` | `IMPLEMENTED` | Produtos sem composição preservam o preço legado; resumo, preço manual e E2E comprovam uso sem versão de precificação | Interface web pendente                     |
| `PREC-RN-042` | `IMPLEMENTED` | Adoção vincula preço e versão; alteração manual limpa o ponteiro; ambas são atômicas e preservam o preço do catálogo  | Integração com orçamentos/pedidos pendente |

### Integração com orçamentos

| Critérios     | Estado    | Base reutilizável                       | Implementação esperada                   |
| ------------- | --------- | --------------------------------------- | ---------------------------------------- |
| `PREC-CA-040` | `PARTIAL` | `FinancialQuote` e `FinancialQuoteItem` | Preservar origem opcional do preço       |
| `PREC-RN-036` | `PARTIAL` | Snapshot comercial existente            | Garantir imutabilidade e rastreabilidade |

### Integração com pedidos

| Critérios     | Estado    | Base reutilizável               | Implementação esperada           |
| ------------- | --------- | ------------------------------- | -------------------------------- |
| `PREC-CA-041` | `PARTIAL` | `SalesOrder` e `SalesOrderItem` | Copiar referência do orçamento   |
| `PREC-RN-037` | `PARTIAL` | Conversão já preserva itens     | Não recalcular durante conversão |

### Integração com estoque e financeiro

| Critérios                     | Estado        | Base reutilizável                                                                                     | Implementação esperada            |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| `PREC-CA-042`                 | `IMPLEMENTED` | E2E compara movimentações antes/depois da criação e adoção de versão e não encontra efeitos           | Preservar nas etapas posteriores  |
| `PREC-CA-043`                 | `IMPLEMENTED` | E2E compara lançamentos antes/depois da criação e adoção de versão e não encontra efeitos             | Preservar nas etapas posteriores  |
| `PREC-RN-039` a `PREC-RN-041` | `FUTURE`      | Módulos financeiros existentes                                                                        | Agregados financeiros posteriores |
| `PREC-RN-043` e `PREC-RN-044` | `IMPLEMENTED` | E2E comprova ausência de efeitos de composição, simulação, versão e adoção sobre estoque e financeiro | Preservar na interface            |

### Fluxos de pedidos

| Critérios     | Estado    | Base reutilizável                                                                              | Implementação esperada                                       |
| ------------- | --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `PREC-CA-044` | `PARTIAL` | `apps/api/src/order-workflows/order-workflows.service.ts` e `apps/api/test/orders.e2e-spec.ts` | Validar preservação dos fluxos após implementar precificação |
| `PREC-RN-045` | `PARTIAL` | `order-workflows`; `OrdersService.createFromQuote` copia snapshots sem motor                   | Preservar a separação ao integrar precificação               |

A existência de fluxos fornece uma base parcial. Composição, simulação e criação
de versão possuem testes próprios de ausência de efeitos. Os testes existentes
de pedidos comprovam o comportamento atual, mas não a integração futura.

### Permissões

| Critérios                     | Estado        | Base reutilizável                                                                                                          | Implementação esperada                   |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `PREC-CA-045` a `PREC-CA-049` | `IMPLEMENTED` | E2E cobre configuração, perfis, composição, simulação, versões, adoção, preço manual, resumo e leitura comercial por papel | Interface deve consumir a mesma política |
| Acesso não autenticado        | `IMPLEMENTED` | Endpoints de precificação, inclusive adoção e resumo comercial, rejeitam ausência de sessão com `401`                      | Preservar nos endpoints futuros          |
| Isolamento organizacional     | `IMPLEMENTED` | Services filtram pela organização da sessão; E2E oculta recursos externos também no preço manual e no resumo               | Preservar nas integrações futuras        |

O contrato legado de produtos possui E2E específico de não vazamento:
`OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE` continuam recebendo `directCost` em
lista e detalhe, enquanto a projeção Prisma usada para `VIEWER` não seleciona
nem retorna a propriedade.

### Precisão e arredondamento

| Critérios                     | Estado    | Base reutilizável                                                                                | Implementação esperada |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------ | ---------------------- |
| `PREC-CA-050` a `PREC-CA-053` | `PARTIAL` | API devolve memória decimal completa e `0.00000001` sem expoente; motor cobre arredondamento     | Exibir na web          |
| `ADR-002`                     | `PARTIAL` | Motor, persistência, simulação e snapshot histórico usam strings decimais canônicas sem expoente | Exibição web pendente  |

### Interface

| Critérios                     | Estado    | Base reutilizável                                                                                   | Implementação esperada           |
| ----------------------------- | --------- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| `PREC-CA-054` a `PREC-CA-057` | `PENDING` | Componentes e formulários existentes                                                                | Fluxo de precificação do produto |
| Recálculo local               | `PENDING` | React disponível                                                                                    | Prévia em até 100 ms             |
| Validação autoritativa        | `PARTIAL` | Simulação, versão e adoção validam/reproduzem o cálculo no backend e rejeitam resultados do cliente | Interface pendente               |

### Auditoria e segurança

| Critérios                     | Estado        | Base reutilizável                                                                                                       | Implementação esperada                  |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `PREC-CA-058`                 | `IMPLEMENTED` | Configuração, perfis, composição, versão, adoção e preço manual geram auditorias atômicas testadas                      | Preservar nas integrações futuras       |
| `PREC-CA-059`                 | `IMPLEMENTED` | Evento imutável guarda a decisão e justificativa; AuditLog vinculado guarda organização, ator, produto, versão e preços | Comprovado por rollback e metadados E2E |
| `PREC-CA-060`                 | `IMPLEMENTED` | DTO de adoção rejeita preço, classificação, fórmula, snapshot, IDs protegidos e resultados enviados pelo cliente        | Preservar nas próximas mutações         |
| `PREC-CA-061`                 | `IMPLEMENTED` | Organização e ator vêm da sessão em todos os casos de uso; E2E cobre também preço manual, resumo e recursos externos    | Preservar nas integrações futuras       |
| `PREC-RN-046` a `PREC-RN-048` | `PARTIAL`     | Erros tipados do motor são traduzidos pelo contrato HTTP, com campos e códigos estáveis                                 | Mensagens e formulários web pendentes   |

## 6. Rotas atuais que devem ser preservadas

A implementação não pode quebrar as rotas existentes, incluindo:

```text
/app/clientes
/app/clientes/novo
/app/clientes/:clientId
/app/produtos
/app/produtos/novo
/app/produtos/:productId
/app/financeiro
/app/financeiro/categorias
/app/financeiro/contas
/app/financeiro/lancamentos
/app/financeiro/lancamentos/novo
/app/financeiro/lancamentos/:entryId
/app/financeiro/orcamentos
/app/financeiro/orcamentos/novo
/app/financeiro/orcamentos/:quoteId
/app/financeiro/orcamentos/:quoteId/editar
/app/financeiro/pedidos
/app/financeiro/pedidos/fluxos
/app/financeiro/pedidos/:orderId
```

A rota de precificação deverá ser integrada ao domínio de produtos, evitando
transformá-la em uma área isolada do produto precificado.

## 7. Validações disponíveis

O repositório possui comandos para:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm db:status
```

Durante a implementação, também deverão ser executados testes direcionados dos
módulos alterados.

## 8. Regra para atualização da matriz

Ao concluir um requisito, o responsável deverá:

1. atualizar seu estado;
2. adicionar os caminhos dos arquivos implementados;
3. informar os testes que o validam;
4. registrar migrations relacionadas;
5. verificar impactos em requisitos adjacentes;
6. manter requisitos futuros sem marcá-los como concluídos.

Um requisito não deve ser marcado como `IMPLEMENTED` somente porque um arquivo
foi criado. O comportamento precisa estar funcional e validado.
