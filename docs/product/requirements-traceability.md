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
- saúde da aplicação.

A auditoria utiliza o modelo `AuditLog` e gravações nos services dos módulos;
não existe módulo Nest específico de auditoria em `apps/api/src/app.module.ts`.

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
- baixas.

Não existem atualmente modelos específicos de precificação.

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

| Requisito                 | Estado        | Evidência de código e teste                                                                                                                                           | Limite da entrega                                                        |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| EX-001                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-001 — precificação simples`: lucro exato `22.728`, exibido `22.73` e margem percentual `25.0005` com ROUND_HALF_UP | Expectativas corrigidas após validação independente; somente motor puro  |
| EX-002                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-002 — precificação completa`: lucro exato `35.3453` e margem percentual `25.0002` com ROUND_HALF_UP                | Expectativas corrigidas após validação independente; somente motor puro  |
| EX-003 a EX-012           | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, dez testes com os respectivos IDs no nome                                                                                    | Cenários matemáticos aprovados; sem integração de domínio                |
| PREC-CA-013 e PREC-CA-016 | `IMPLEMENTED` | `calculator/pricing-calculator.ts`; testes de componentes fracionários e negativos por campo                                                                          | Multiplicação e rejeição tipada no motor                                 |
| PREC-CA-019 e PREC-CA-021 | `IMPLEMENTED` | Testes EX-009/EX-010 e denominadores ativos com numerador zero                                                                                                        | Validação condicional dos modos utilizados                               |
| PREC-CA-023 e PREC-CA-024 | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, testes EX-001 e EX-002 aprovados contra os resultados oficiais corrigidos                                                    | Cálculo simples e completo no motor puro                                 |
| PREC-CA-025               | `IMPLEMENTED` | EX-006/EX-007 e divisor mínimo inválido com custo zero                                                                                                                | Erro tipado com mensagem, nenhum preço retornado                         |
| PREC-CA-030 e PREC-CA-032 | `PARTIAL`     | O motor calcula classificação e aviso; EX-003/EX-004, comparações comerciais e preço zero testados                                                                    | Exposição e adoção desses resultados pela API e pela interface pendentes |
| PREC-CA-051 e PREC-CA-053 | `IMPLEMENTED` | EX-011, mínimo para cima, fronteiras de centavo e lucro residual                                                                                                      | Arredondamento e recálculo decimal no motor                              |
| PREC-CA-050               | `IMPLEMENTED` | EX-001 a EX-012 aprovados em `calculator/pricing-calculator.spec.ts`; precisão, grandes quantidades e divisores próximos de zero testados                             | Reprodução decimal dos exemplos no motor puro                            |
| PREC-CA-052               | `PARTIAL`     | `PricingMoney.display`, teste de half-up sem realimentar cálculo                                                                                                      | Formatação retornada pelo motor; exibição web pendente                   |

Evidência de execução em 03/10/2026: 77 de 77 testes do motor aprovados;
suíte completa da API com 98 testes aprovados em 7 arquivos. O bloqueio foi
removido após essas validações e a correção documental autorizada, sem alterar
fórmulas ou arredondar valores intermediários. Persistência, endpoints e
interface de precificação permanecem ausentes.

### Configuração da organização

| Critérios                     | Estado    | Base reutilizável                    | Implementação esperada                  |
| ----------------------------- | --------- | ------------------------------------ | --------------------------------------- |
| `PREC-CA-001` a `PREC-CA-005` | `PENDING` | Organização, autorização e auditoria | Configuração versionada por organização |
| `PREC-RN-001` a `PREC-RN-005` | `PENDING` | Multi-tenancy existente              | Serviço, persistência e API             |

### Perfis de deduções

| Critérios                     | Estado    | Base reutilizável                                                                          | Implementação esperada                        |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `PREC-CA-006` a `PREC-CA-009` | `PENDING` | Autorização e organização                                                                  | Perfis e deduções configuráveis               |
| `PREC-RN-021` a `PREC-RN-023` | `PARTIAL` | Coleções de deduções em `calculator/pricing-calculator.ts`, EX-001/EX-002 e teste de ordem | Perfis persistidos, API e interface pendentes |

### Composição de custos

| Critérios                     | Estado    | Base reutilizável                                                                                      | Implementação esperada                               |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `PREC-CA-010` a `PREC-CA-016` | `PARTIAL` | Componentes/quantidades/categorias, custos copiados e validação no motor; specs fracionários/negativos | Composição persistente e posse dos insumos pendentes |
| `PREC-RN-006` a `PREC-RN-011` | `PARTIAL` | `calculator/pricing-calculator.ts` e specs de opcionais, ordem e memória                               | Sem consulta de catálogo nem snapshots salvos        |

### Mão de obra

| Critérios                     | Estado    | Base reutilizável                                                                                  | Implementação esperada                        |
| ----------------------------- | --------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `PREC-CA-017` a `PREC-CA-019` | `PARTIAL` | Motor aceita custo mensal/horas/tempo em minutos; EX-009 e specs de tempo fracionário/cancelamento | Conversão de campos da interface pendente     |
| `PREC-RN-012` a `PREC-RN-015` | `PARTIAL` | Tipos de mão de obra, cálculo e testes puros em `calculator/`                                      | Configuração e snapshot persistente pendentes |

### Frete

| Critérios                     | Estado    | Base reutilizável                                                             | Implementação esperada                         |
| ----------------------------- | --------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| `PREC-CA-020` a `PREC-CA-022` | `PARTIAL` | Motor manual/rateado, EX-010 e specs de consumo fracionário/frete manual      | Contratos de domínio/API e interface pendentes |
| `PREC-RN-016` e `PREC-RN-017` | `PARTIAL` | `PricingFreightInput`, memória por modo e respectivos testes em `calculator/` | Snapshot persistente pendente                  |

### Motor de cálculo

| Critérios                     | Estado        | Base reutilizável                                                                      | Implementação esperada                                      |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `PREC-CA-023` a `PREC-CA-028` | `PARTIAL`     | `calculator/pricing-calculator.ts` e 77 testes aprovados, incluindo EX-001/EX-002      | Implementar interface e integração com backend autoritativo |
| `PREC-RN-018` a `PREC-RN-027` | `PARTIAL`     | Motor `margin-divisor-v1`, taxas consolidadas/derivadas, deduções e divisores testados | Implementar perfis persistidos e integrações do domínio     |
| `EX-001` a `EX-012`           | `IMPLEMENTED` | 12 testes aprovados, nomeados por exemplo em `calculator/pricing-calculator.spec.ts`   | Cenários matemáticos aprovados; sem integração de domínio   |

### Preço adotado

| Critérios                     | Estado    | Base reutilizável                                                                                 | Implementação esperada                             |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `PREC-CA-029` a `PREC-CA-034` | `PARTIAL` | Produto já possui preço comercial                                                                 | Adoção explícita e análise de margem               |
| `PREC-RN-028` a `PREC-RN-031` | `PARTIAL` | Análise de preço/lucro/margem/desconto em `calculator/`; EX-003/EX-004/EX-005 e testes comerciais | Adotar preço e vincular versão continuam pendentes |
| Preço abaixo do mínimo        | `PENDING` | Autorização e auditoria                                                                           | Confirmação, justificativa e restrição             |

### Decomposição e explicação

| Critérios                     | Estado    | Base reutilizável                                                             | Implementação esperada                                    |
| ----------------------------- | --------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `PREC-CA-026`                 | `PARTIAL` | Decomposição em strings, EX-003/EX-004 e memória determinística testados      | Interface pendente                                        |
| `PREC-RN-032` a `PREC-RN-034` | `PARTIAL` | Memória retornada por `calculatePricing`, teste de ordem e cópia das entradas | Data/usuário/histórico persistente e prévia web pendentes |

### Histórico e snapshots

| Critérios                     | Estado    | Base reutilizável                             | Implementação esperada            |
| ----------------------------- | --------- | --------------------------------------------- | --------------------------------- |
| `PREC-CA-035` a `PREC-CA-038` | `PENDING` | Auditoria e snapshots comerciais existentes   | Versões imutáveis                 |
| `PREC-RN-035` a `PREC-RN-038` | `PARTIAL` | Itens de orçamentos e pedidos preservam dados | Relacionar versão de precificação |

### Integração com produtos

| Critérios     | Estado    | Base reutilizável             | Implementação esperada               |
| ------------- | --------- | ----------------------------- | ------------------------------------ |
| `PREC-CA-039` | `PARTIAL` | Produtos existentes com preço | Migração compatível                  |
| `PREC-RN-042` | `PARTIAL` | Modelo e serviço de produtos  | Referência opcional à versão adotada |

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

| Critérios                     | Estado    | Base reutilizável                                                                                 | Implementação esperada                                                       |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `PREC-CA-042`                 | `PENDING` | `apps/api/src/inventory/inventory.service.ts`; domínio de precificação ausente em `app.module.ts` | Implementar operação de precificação e testar ausência de movimentações      |
| `PREC-CA-043`                 | `PENDING` | `apps/api/src/finance/finance.module.ts`; domínio de precificação ausente em `app.module.ts`      | Implementar operação de precificação e testar ausência de lançamentos/baixas |
| `PREC-RN-039` a `PREC-RN-041` | `FUTURE`  | Módulos financeiros existentes                                                                    | Agregados financeiros posteriores                                            |
| `PREC-RN-043` e `PREC-RN-044` | `PARTIAL` | Limites de domínio existentes                                                                     | Preservar ao implementar                                                     |

### Fluxos de pedidos

| Critérios     | Estado    | Base reutilizável                                                                              | Implementação esperada                                       |
| ------------- | --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `PREC-CA-044` | `PARTIAL` | `apps/api/src/order-workflows/order-workflows.service.ts` e `apps/api/test/orders.e2e-spec.ts` | Validar preservação dos fluxos após implementar precificação |
| `PREC-RN-045` | `PARTIAL` | `order-workflows`; `OrdersService.createFromQuote` copia snapshots sem motor                   | Preservar a separação ao integrar precificação               |

A existência de fluxos fornece uma base parcial; a ausência do domínio de
precificação não comprova critérios de ausência de efeitos colaterais.
`PREC-CA-042` e `PREC-CA-043` exigem operações implementadas e testes próprios,
conforme a regra de evidência desta matriz. Os testes existentes de pedidos
comprovam o comportamento atual, mas não a integração futura.

### Permissões

| Critérios                     | Estado    | Base reutilizável             | Implementação esperada             |
| ----------------------------- | --------- | ----------------------------- | ---------------------------------- |
| `PREC-CA-045` a `PREC-CA-049` | `PARTIAL` | Guards e papéis existentes    | Aplicar matriz aos novos endpoints |
| Acesso não autenticado        | `PARTIAL` | `SessionAuthGuard`            | Cobrir endpoints novos             |
| Isolamento organizacional     | `PARTIAL` | Padrão existente nos serviços | Testar todos os recursos           |

### Precisão e arredondamento

| Critérios                     | Estado    | Base reutilizável                                                                 | Implementação esperada                         |
| ----------------------------- | --------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `PREC-CA-050` a `PREC-CA-053` | `PARTIAL` | Clone local de decimal.js, EX-011 e specs de limites/cancelamento; detalhes acima | Exibir na web                                  |
| `ADR-002`                     | `PARTIAL` | Representação e arredondamento no motor; ADR-005 e specs                          | Novas estruturas persistidas ainda não existem |

### Interface

| Critérios                     | Estado    | Base reutilizável                    | Implementação esperada           |
| ----------------------------- | --------- | ------------------------------------ | -------------------------------- |
| `PREC-CA-054` a `PREC-CA-057` | `PENDING` | Componentes e formulários existentes | Fluxo de precificação do produto |
| Recálculo local               | `PENDING` | React disponível                     | Prévia em até 100 ms             |
| Validação autoritativa        | `PENDING` | API NestJS                           | Recalcular ao salvar             |

### Auditoria e segurança

| Critérios                     | Estado    | Base reutilizável                                               | Implementação esperada                                |
| ----------------------------- | --------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `PREC-CA-058` e `PREC-CA-059` | `PARTIAL` | `AuditLog`                                                      | Adicionar novas ações                                 |
| `PREC-CA-060`                 | `PENDING` | Validação de DTOs e serviços                                    | Ignorar resultados do cliente                         |
| `PREC-CA-061`                 | `PARTIAL` | Multi-tenancy existente                                         | Validar todos os relacionamentos                      |
| `PREC-RN-046` a `PREC-RN-048` | `PARTIAL` | `PricingCalculatorError`, EX-006 a EX-010 e negativos por campo | Mensagens/formulários web e integração HTTP pendentes |

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
