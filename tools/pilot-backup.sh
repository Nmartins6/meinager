#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo 'Uso: pilot-backup.sh CONTAINER BANCO ARQUIVO_NOVO' >&2
  exit 2
fi

container=$1
database=$2
archive=$3

if [[ ! $container =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ || ! $database =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo 'Identificador de contêiner ou banco inválido.' >&2
  exit 2
fi
if [[ -e $archive || -L $archive ]]; then
  echo 'O arquivo de backup já existe; escolha um caminho novo.' >&2
  exit 2
fi
if [[ ${MEINAGER_BACKUP_CONFIRM_DATABASE:-} != "$database" ]]; then
  echo 'Defina MEINAGER_BACKUP_CONFIRM_DATABASE com o nome exato do banco.' >&2
  exit 2
fi

docker inspect "$container" >/dev/null
umask 077
# noclobber also protects against a race after the existence check.
set -C
docker exec "$container" sh -c 'exec pg_dump -U "$POSTGRES_USER" -Fc --no-owner --no-acl -d "$1"' _ "$database" > "$archive" || {
  echo 'Backup falhou. Nenhum arquivo foi removido automaticamente.' >&2
  echo 'Se houver arquivo parcial no destino, não o utilize para restauração.' >&2
  exit 1
}
echo "Backup criado: $archive"
