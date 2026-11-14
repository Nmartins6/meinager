# Meinager

Gestão local de clientes, insumos, produtos, precificação, orçamentos, pedidos,
estoque e financeiro. Monorepo com API NestJS, interface React e PostgreSQL.

- [Instalação e operação local](docs/local/installation.md)
- [Manual de uso](docs/manual-de-uso.md)
- [Verificação de liberação](docs/local/release-check.md)
- [Escopo do produto](docs/product/scope-and-roadmap.md)

## Início rápido para o responsável pela instalação

Requisitos: Node **24**, pnpm **11.13.1**, Docker com Compose e navegador atual.
No Windows, use WSL2 com os comandos abaixo no Ubuntu e integração do Docker
Desktop habilitada. O programa abre no navegador; não é um instalador desktop.

Na raiz do projeto, em uma instalação nova:

```bash
cp -n .env.example .env
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:deploy
pnpm db:generate
pnpm build
pnpm start
```

Antes de subir o banco, configure uma senha própria em `.env`, tanto em
`POSTGRES_PASSWORD` quanto em `DATABASE_URL`. Consulte o guia de instalação.
Não substitua um `.env` existente. Aguarde o banco ficar saudável antes das
migrations. Abra <http://localhost:5173>. Para trabalhar no código, use `pnpm dev`.

Na rotina diária: inicie o Docker, execute `pnpm db:up` e `pnpm start` na raiz.
Mantenha o terminal aberto. `Ctrl+C` encerra a aplicação; `pnpm db:down` para o
banco preservando o volume. Não use a opção `-v` para desligá-lo.

## Verificações

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
git diff --check
```

O piloto integrado cria seu próprio PostgreSQL descartável, testa os percursos
com navegador, faz backup/restauração e remove os recursos de teste:

```bash
pnpm --filter @meinager/web exec playwright install --with-deps chromium
PILOT_TEST_CONFIRM_DISPOSABLE=YES pnpm pilot:test
```

Para incluir a suíte ampliada da API, adicione `PILOT_TEST_FULL_API=YES` ao
mesmo comando. O cadastro guiado também é testado na interface compilada.

Não execute testes E2E diretamente contra uma base com dados do usuário.
