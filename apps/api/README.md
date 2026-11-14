# Meinager API

API NestJS com Prisma e PostgreSQL. Execute os comandos pela raiz do monorepo.

Consulte o [guia de instalação local](../../docs/local/installation.md) para
configurar o ambiente, aplicar migrations existentes e iniciar a aplicação.
O [manual de uso](../../docs/manual-de-uso.md) descreve os fluxos disponíveis.

Para desenvolvimento: `pnpm db:generate` e `pnpm dev` na raiz. A configuração
é carregada do `.env` da raiz; a API escuta em loopback por padrão.
`GET /api/health` verifica a conectividade com o banco.

Testes unitários: `pnpm --filter @meinager/api test`.
Testes integrados: use o runner descartável `pnpm pilot:test`, conforme o guia.
Não execute E2E contra o banco do usuário.
