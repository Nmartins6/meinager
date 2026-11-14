# Instalação e operação local

## Ambiente suportado por este procedimento

Uso em uma única máquina, pelo navegador em `http://localhost:5173`. API e banco
ficam restritos à própria máquina. A interface compilada é servida pelo preview
do Vite, adequado para este piloto local, sem configurar hospedagem pública.

No Windows, instale WSL2/Ubuntu e Docker Desktop com integração WSL. Execute os
comandos dentro do Ubuntu e mantenha o projeto no sistema de arquivos Linux.
Linux com Docker também atende ao procedimento. A máquina final precisa passar
pelo checklist abaixo; testes no ambiente de desenvolvimento não a homologam.

Instale Node 24 e pnpm 11.13.1. Com nvm disponível, `nvm install` e `nvm use`
na raiz utilizam a versão indicada em `.nvmrc`. Confirme:

```bash
node --version
pnpm --version
docker version
docker compose version
```

A instalação inicial exige internet para dependências e imagem do PostgreSQL.
Os dados ficam no volume local do Docker; baixar o código em outra máquina não
transfere os cadastros. Não entregue `.env`, backups ou dados de desenvolvimento
como parte do pacote de instalação. Inclua os novos arquivos desta entrega:
um clone do último commit, antes de versioná-los, não contém estas melhorias.

## Instalação nova

1. Abra o terminal na raiz do repositório.
2. Copie `.env.example` para `.env` sem sobrescrever um arquivo existente:
   `cp -n .env.example .env`.
3. Escolha uma senha local e ajuste `POSTGRES_PASSWORD` e a senha dentro de
   `DATABASE_URL`. Caracteres especiais na URL precisam de codificação de URL.
   Mantenha `WEB_ORIGIN=http://localhost:5173`,
   `VITE_API_URL=http://localhost:3000/api` e `API_HOST=127.0.0.1`.
4. Execute os comandos abaixo. Aguarde `healthy` no serviço postgres antes de
   aplicar migrations. `db:deploy` aplica somente migrations existentes.

```bash
pnpm install --frozen-lockfile
pnpm db:up
docker compose ps
pnpm db:deploy
pnpm db:status
pnpm db:generate
pnpm build
pnpm start
```

Não configure `NODE_ENV=production` para este acesso HTTP local: a política de
cookies de produção pressupõe HTTPS. Não exponha as portas na internet.
As portas padrão são 5173 (interface), 3000 (API) e 5432 (PostgreSQL).

Abra `http://localhost:3000/api/health`: deve informar `status: ok` e
`database: up`. Abra `http://localhost:5173`, crie a conta e a empresa do usuário.
Não há senha padrão. O primeiro cadastro cria o proprietário da organização.

## Rotina diária

1. Inicie Docker Desktop/Docker.
2. No terminal do projeto, execute `pnpm db:up` e depois `pnpm start`.
3. Abra `http://localhost:5173`, entre e confira a organização ativa.
4. Ao terminar, salve os formulários, saia da conta e use `Ctrl+C` no terminal.
5. Se desejar parar o banco, execute `pnpm db:down`. O volume permanece.

Fechar a aba não desliga os servidores. Reiniciar a máquina exige iniciá-los
novamente. O comando de início não cria tabelas nem gera uma build: essas etapas
pertencem à instalação/atualização. A porta web ocupada causa erro explícito,
sem mudar silenciosamente a URL e quebrar o login.

## Backup e recuperação

O responsável deve combinar uma frequência de backup (por exemplo, ao fim de
cada dia de uso) e guardar uma cópia fora da máquina. Backup contém dados
pessoais e comerciais; mantenha acesso restrito. O volume Docker não substitui
backup. Não use `docker compose down -v`, prune de volumes ou reset do Prisma.

Com o banco iniciado, descubra o identificador:

```bash
docker compose ps -q postgres
```

Substitua `CONTAINER` pelo resultado. Os exemplos usam o banco padrão
`meinager`; se o nome mudou, ajuste-o também na confirmação. Escolha sempre
um arquivo novo, em uma pasta existente:

```bash
MEINAGER_BACKUP_CONFIRM_DATABASE=meinager bash tools/pilot-backup.sh CONTAINER meinager /caminho/backup-novo.dump
MEINAGER_RESTORE_CONFIRM_DESTINATION=meinager_restore_conferencia bash tools/pilot-restore.sh CONTAINER /caminho/backup-novo.dump meinager_restore_conferencia
```

A restauração cria **outro banco**, recusa destino existente e não substitui a
origem. Confirme o conteúdo antes de usá-lo. Para recuperar a operação, pare a
aplicação, altere apenas o nome do banco na `DATABASE_URL` para o destino
restaurado, confira migrations com `pnpm db:status` e inicie novamente.
Confira login, produtos, versões, clientes e documentos. Preserve o original
até concluir a conferência. Em falha de backup, um arquivo parcial pode ficar
no destino: não o considere válido.

## Atualização

Pare a aplicação e faça um backup verificado antes de atualizar o código.
Preserve `.env` e o volume. Execute `pnpm install --frozen-lockfile`,
`pnpm db:deploy`, `pnpm db:status`, `pnpm db:generate`, `pnpm build` e `pnpm start`.
Não utilize `db:migrate` para instalar uma versão no computador do usuário:
esse comando é destinado ao desenvolvimento de migrations. Uma atualização de
sessões pode exigir novo login. Mudanças no endereço da API exigem nova build
da interface, pois `VITE_API_URL` é incorporada durante a compilação.

## Problemas comuns

| Sintoma                           | Verificação                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node incompatível                 | Confirme Node 24 no mesmo terminal que executa pnpm.                                                                                      |
| Docker não responde               | Inicie o Docker e confira a integração WSL.                                                                                               |
| Banco recusando conexão           | Confira `docker compose ps`, porta, saúde e credenciais locais, sem compartilhá-las.                                                      |
| Senha alterada e banco não aceita | As variáveis de inicialização não alteram a senha de um volume já criado. Peça ao responsável para ajustar o acesso; não apague o volume. |
| Login não permanece               | Use exatamente `localhost:5173`; confira `WEB_ORIGIN` e não force cookies de produção no HTTP local.                                      |
| Porta ocupada                     | Encerre a instância anterior. Se trocar a porta da API, ajuste também `VITE_API_URL` e reconstrua.                                        |
| Tabelas ausentes                  | Confira `db:status` e aplique migrations com `db:deploy` no banco correto.                                                                |
| Preço antigo no orçamento         | Atualizar o produto não recalcula documentos já criados. Confira o manual.                                                                |

## Checklist na máquina do usuário

- Instalação, migrations e build sem erros; health com banco disponível.
- Criar conta e empresa próprias, entrar e sair com sucesso.
- Executar o percurso do [manual](../manual-de-uso.md) com dados de conferência.
- Confirmar preço, orçamento e pedido com o responsável pelo negócio.
- Parar/reiniciar a aplicação e conferir a persistência dos cadastros.
- Criar backup, restaurar em outro banco e conferir os dados restaurados.
- Definir responsável pelo backup e guardar as credenciais com o usuário.

Somente após essa conferência libere a operação com dados reais.
