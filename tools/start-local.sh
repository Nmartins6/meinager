#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# nvm is normally loaded by interactive terminals, but shortcuts are noninteractive.
if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 24
fi
command -v pnpm >/dev/null || { echo 'Instale Node 24 e pnpm conforme o guia local.'; exit 1; }
[[ -f .env && -f apps/api/dist/main.js && -f apps/web/dist/index.html ]] || {
  echo 'Conclua a instalacao e execute pnpm build antes de usar o atalho.'; exit 1;
}
mkdir -p .local
exec 9>.local/start.lock
flock -n 9 || { echo 'O Meinager ja possui uma janela de inicializacao aberta.'; exit 1; }
echo 'Iniciando o banco. Mantenha esta janela aberta durante o uso.'
docker compose up -d --wait --wait-timeout 120 postgres
unset NODE_ENV
exec pnpm start
