---
name: meinager-delivery
description: Entregar uma funcionalidade do Meinager com validação por escopo, segurança organizacional e evidência real de interface/API. Usar durante uma entrega de produto ou correção funcional no monorepo.
---

# Entrega no Meinager

1. Leia `AGENTS.md` e o escopo aplicável em `docs/product/scope-and-roadmap.md` e `docs/product/requirements-traceability.md`. Para precificação, comece em `docs/domains/pricing/README.md` e no marco pertinente de `docs/plans/pricing-engine.md`.
2. Confira `git status --short --branch`, HEAD, Node e pnpm. Preserve arquivos preexistentes. Defina o menor recorte que entrega um comportamento verificável.
3. Inspecione contratos e testes existentes antes de editar. Mantenha isolamento por organização, papéis, auditoria, decimais e snapshots. Solicite decisão humana quando houver mudança estrutural ou regra comercial não documentada. Resolva ajustes pequenos dentro do escopo aprovado.
4. Execute primeiro testes direcionados. Para fluxos reais com escrita, use `PILOT_TEST_CONFIRM_DISPOSABLE=YES pnpm pilot:test` ou o runner descartável específico; nunca use o banco normal. Teste de componente com mock, navegador com mock e navegador → API → PostgreSQL são evidências diferentes.
5. Ao encerrar, rode as validações pertinentes (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec prettier --check docs`, `git diff --check`). Atualize plano e rastreabilidade somente com resultados executados.
6. Relate comportamento, arquivos, testes, limitações, `git diff --stat` e `git status --short`. Não faça commit sem pedido explícito. Não imprima segredos ou credenciais.
