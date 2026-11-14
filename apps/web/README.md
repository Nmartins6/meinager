# Meinager Web

Interface React e Vite do Meinager. Execute os comandos pela raiz do monorepo.

- [Instalação e operação local](../../docs/local/installation.md)
- [Manual de uso](../../docs/manual-de-uso.md)

`pnpm dev` inicia o desenvolvimento. Para uso local com código compilado,
execute `pnpm build` e `pnpm start` na raiz e abra `http://localhost:5173`.
`VITE_API_URL` vem do `.env` da raiz e é incorporada à build da interface.

Testes de componentes: `pnpm --filter @meinager/web test`.
O piloto descartável da raiz exercita navegador, API e PostgreSQL reais.
