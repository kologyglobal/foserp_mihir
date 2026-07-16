#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f .env.production.example ]]; then
    cp .env.production.example "$ENV_FILE"
    echo "Created $ENV_FILE from .env.production.example — edit secrets, then re-run."
    exit 1
  fi
  echo "Missing $ENV_FILE"
  exit 1
fi

docker compose --env-file "$ENV_FILE" up --build -d
echo "Deployed. Health: curl -s http://localhost:${HTTP_PORT:-80}/api/v1/health"
