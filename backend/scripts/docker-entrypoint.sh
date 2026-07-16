#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node -e "const u=process.env.DB_USER||'root';const p=encodeURIComponent(process.env.DB_PASS||'');const h=process.env.DB_HOST||'localhost';const port=process.env.DB_PORT||'3306';const n=process.env.DB_NAME||'fos_erp';process.stdout.write('mysql://'+u+':'+p+'@'+h+':'+port+'/'+n)")"
  export DATABASE_URL
fi

echo "[backend] Applying Prisma migrations..."
npx tsx scripts/prisma-cli.ts migrate deploy

echo "[backend] Starting server..."
exec node dist/server.js
