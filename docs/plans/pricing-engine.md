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
- [ ] Realizar a auditoria técnica do repositório.
- [ ] Implementar e testar o motor matemático.
- [ ] Definir e implementar a persistência.
- [ ] Implementar configuração e perfis de deduções.
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

Nenhuma descoberta registrada até o momento.

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

O schema ainda não possui entidades específicas de precificação.

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

## Marco 1 — Motor matemático puro

### Objetivo

Implementar `margin-divisor-v1` sem depender de banco, HTTP ou React.

### Localização esperada

A auditoria deverá confirmar a localização final. A opção inicial é uma pasta
no domínio de precificação da API, com separação semelhante a:

```text
apps/api/src/pricing/
  calculator/
    pricing-calculator.ts
    pricing-calculator.types.ts
    pricing-calculator.errors.ts
    pricing-calculator.spec.ts
```

Os nomes podem ser adaptados aos padrões do repositório.

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

A auditoria definirá se os recursos ficarão em um único módulo `pricing` ou em
submódulos menores.

### Autorização

Aplique os critérios `PREC-CA-045` até `PREC-CA-049`.

Todos os identificadores relacionados devem ser verificados contra a
organização autenticada.

### Backend autoritativo

Em operações de salvamento ou adoção:

1. receba as entradas;
2. valide os recursos;
3. carregue valores necessários;
4. execute novamente o motor;
5. ignore totais calculados pelo cliente;
6. persista entradas e resultados;
7. grave auditoria.

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
- `VIEWER`: somente leitura;
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

Nenhum resultado registrado até o momento.
