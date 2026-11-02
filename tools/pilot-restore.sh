#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo 'Uso: pilot-restore.sh CONTAINER ARQUIVO DESTINO_NOVO' >&2
  exit 2
fi

container=$1
archive=$2
destination=$3

if [[ ! $container =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ || ! $destination =~ ^meinager_restore_[a-z0-9_]+$ ]]; then
  echo 'Contêiner ou nome do destino inválido; use meinager_restore_...' >&2
  exit 2
fi
if [[ ${MEINAGER_RESTORE_CONFIRM_DESTINATION:-} != "$destination" ]]; then
  echo 'Defina MEINAGER_RESTORE_CONFIRM_DESTINATION com o destino exato.' >&2
  exit 2
fi
if [[ ! -f $archive || ! -s $archive ]]; then
  echo 'Arquivo de backup ausente ou vazio.' >&2
  exit 2
fi

docker inspect "$container" >/dev/null
docker exec -i "$container" sh -c 'exec pg_restore --list' < "$archive" >/dev/null
existing=$(docker exec "$container" sh -c 'exec psql -U "$POSTGRES_USER" -d postgres -Atq -c "$1"' _ "SELECT 1 FROM pg_database WHERE datname = '$destination'")
if [[ -n $existing ]]; then
  echo 'Destino já existe; a restauração foi recusada.' >&2
  exit 2
fi

docker exec "$container" sh -c 'exec createdb -U "$POSTGRES_USER" "$1"' _ "$destination"
# Deliberately leave the new database available for diagnosis if restore fails.
docker exec -i "$container" sh -c 'exec pg_restore -U "$POSTGRES_USER" --exit-on-error --no-owner --no-acl -d "$1"' _ "$destination" < "$archive"
echo "Restauração concluída em banco novo: $destination"
