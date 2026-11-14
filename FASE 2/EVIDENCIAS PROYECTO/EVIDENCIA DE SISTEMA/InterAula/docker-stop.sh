#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

ENV_ARG=""
if [ -f "backend/.env" ]; then
  ENV_ARG="--env-file backend/.env"
elif [ -f ".env" ]; then
  ENV_ARG="--env-file .env"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[Error] No se encontro 'docker compose' ni 'docker-compose'."
  exit 1
fi

# shellcheck disable=SC2086
$COMPOSE_CMD $ENV_ARG down
echo "Contenedores detenidos correctamente."
