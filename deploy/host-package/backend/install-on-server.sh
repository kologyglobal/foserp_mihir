#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cp -n .env.example .env || true
echo "Edit .env with MySQL + JWT secrets, then re-run if needed."
npm ci
npx prisma generate
npx tsx scripts/prisma-cli.ts migrate deploy
echo "Optional first-time seed: npm run db:seed"
echo "Start: npm run start   OR   npm run start:prod"
