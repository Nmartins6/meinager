# Meinager

## Repositório

O Meinager é um monorepo pnpm e Turborepo.

Principais aplicações:

- `apps/api`: API NestJS, Prisma e PostgreSQL;
- `apps/web`: aplicação React e Vite.

Preserve os padrões existentes antes de introduzir novas abstrações.

## Orientação por contexto

Leia somente os documentos necessários para a tarefa atual.

Para entender escopo e prioridade do produto, consulte:

- `docs/product/scope-and-roadmap.md`;
- `docs/product/requirements-traceability.md`.

Para alterações de precificação, comece por:

- `docs/domains/pricing/README.md`.

Consulte conforme necessário:

- `business-rules.md` para comportamento de negócio;
- `calculation-specification.md` para fórmulas;
- `examples.md` para resultados canônicos;
- `acceptance-criteria.md` para comportamento verificável;
- `docs/architecture/decisions/` para decisões estruturais.

O conteúdo de `docs/product/sources/` é histórico e não substitui as fontes
oficiais.

## Planos executáveis

Para funcionalidades extensas ou alterações que envolvam banco, API e
interface, utilize o plano correspondente em `docs/plans/`.

A implementação da precificação deve seguir:

- `docs/plans/pricing-engine.md`.

Mantenha as seções de progresso, descobertas, decisões e resultados do plano
atualizadas durante o trabalho.

Não avance para persistência antes de concluir a auditoria técnica e o motor
matemático descritos no plano.

## Regras permanentes

Toda alteração deve preservar:

- isolamento por organização;
- autenticação e autorização;
- permissões por papel;
- auditoria de ações relevantes;
- precisão decimal;
- snapshots históricos;
- compatibilidade com dados existentes;
- comportamento atual não relacionado à tarefa.

Nunca confie em `organizationId` fornecido pelo cliente quando a organização
autenticada já estiver disponível na sessão.

Não utilize `number` como fonte de verdade para cálculos financeiros
persistidos.

O backend deve recalcular resultados financeiros recebidos do frontend.

## Prisma e migrations

Antes de alterar o schema, inspecione os modelos, relações, índices e
convenções existentes.

Migrations devem:

- preservar dados;
- ser revisáveis;
- ser compatíveis com banco existente;
- evitar valores locais específicos;
- possuir validação após aplicação.

Não modifique uma migration já aplicada em ambiente compartilhado. Crie outra
migration para correções posteriores.

Não marque uma migration como aplicada sem verificar previamente o estado real
do banco.

## Testes e validação

Execute primeiro os testes diretamente relacionados à mudança.

Antes de concluir um marco, execute as validações definidas no plano
correspondente.

Comandos disponíveis na raiz incluem:

- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm test:e2e`;
- `pnpm build`;
- `pnpm db:status`;
- `pnpm exec prettier --check .`;
- `git diff --check`.

Testes e2e utilizam dados descartáveis, mas confirme os padrões do arquivo
antes de adicionar limpeza ou concorrência.

## Escopo de alterações

Preserve mudanças do usuário e arquivos não relacionados.

Não utilize comandos destrutivos para limpar a árvore de trabalho.

Não faça commits automaticamente, salvo quando solicitado explicitamente.

Ao concluir uma etapa:

1. descreva o comportamento entregue;
2. informe os arquivos relevantes;
3. informe os testes executados;
4. registre limitações;
5. atualize o plano e a matriz de rastreabilidade quando aplicável.
