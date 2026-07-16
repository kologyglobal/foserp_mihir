#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/database/docker-compose.yml"

cmd="${1:-up}"

case "$cmd" in
  up)
    docker compose -f "$COMPOSE_FILE" up -d
    echo "Waiting for PostgreSQL..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'until pg_isready -U vasant -d trailer_erp; do sleep 1; done'
    echo "Database ready: postgresql://vasant:vasant@localhost:5432/trailer_erp"
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  reset)
    docker compose -f "$COMPOSE_FILE" down -v
    docker compose -f "$COMPOSE_FILE" up -d
    echo "Database recreated with fresh schema."
    ;;
  psql)
    docker compose -f "$COMPOSE_FILE" exec postgres psql -U vasant -d trailer_erp
    ;;
  status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  *)
    echo "Usage: $0 {up|down|reset|psql|status}"
    exit 1
    ;;
esac
