---
name: meinager-release-check
description: Verificar se uma entrega do Meinager está pronta para piloto ou publicação, separando testes com mock de fluxo integrado e checando banco descartável, permissões e operação. Usar antes de liberar uma entrega ou iniciar um piloto.
---

# Verificação de liberação do Meinager

1. Leia `AGENTS.md`, `docs/product/scope-and-roadmap.md`, `docs/product/requirements-traceability.md` e o plano do marco relevante. Confira branch, HEAD e alterações locais; preserve-as.
2. Compare requisitos com código, testes e resultados atuais. Não use contagens históricas como validação da rodada. Distinga inspeção, teste executado, navegador real e fluxo integrado com PostgreSQL.
3. Execute verificações aplicáveis: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec prettier --check docs`, `git diff --check`. Para precificação com escrita real, use somente `PILOT_TEST_CONFIRM_DISPOSABLE=YES pnpm pilot:test` ou runner descartável pertinente; confira criação e remoção da base.
4. Confira acesso por papel e organização, ausência de vazamento de custos, dados históricos, efeitos em estoque/financeiro e recuperação de falha. Não leia nem imprima segredos. Não trate screenshots ou JSDOM como prova de regra de backend.
5. Registre bloqueadores, lacunas de ambiente, evidências e ação necessária. Peça decisão humana para ampliação estrutural ou comercial. Não faça commit, deploy, alteração no banco normal ou exposição pública sem autorização específica.
