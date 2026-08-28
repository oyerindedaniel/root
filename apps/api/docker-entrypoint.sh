#!/bin/sh
set -eu

cd /app

if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  FIRST_BOOT=false
  if pnpm --filter @repo/api exec tsx src/scripts/is-empty-database.ts; then
    FIRST_BOOT=true
  fi

  echo "[root-api] drizzle-kit migrate..."
  pnpm --filter @repo/db db:migrate

  if [ "$FIRST_BOOT" = "true" ]; then
    echo "[root-api] empty database — seeding auth..."
    pnpm --filter @repo/api db:seed
  fi
fi

echo "[root-api] starting..."
exec "$@"
