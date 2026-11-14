#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

ENV_ARG=""
if [ -f "backend/.env" ]; then
  ENV_ARG="--env-file backend/.env"
elif [ -f ".env" ]; then
  ENV_ARG="--env-file .env"
else
  echo "[Error] No se encontro backend/.env ni .env."
  echo "Copia .env.example a .env (o backend/.env.example a backend/.env) y configura Supabase."
  exit 1
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
$COMPOSE_CMD $ENV_ARG up -d --build --force-recreate
# shellcheck disable=SC2086
$COMPOSE_CMD $ENV_ARG ps

echo ""
echo "=========================================================="
echo " InterAula ya esta en ejecucion en Docker:"
echo "   - Frontend (App Web):   http://localhost:${FRONTEND_PORT:-80}"
echo "   - Backend (API REST):   http://localhost:${BACKEND_PORT:-3001}/api/health"
echo "=========================================================="
