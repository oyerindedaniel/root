#!/bin/sh
set -eu

cd /app

pnpm --filter @repo/contracts build

pnpm --filter @repo/contracts exec tsc --watch --preserveWatchOutput &
CONTRACTS_PID=$!

pnpm --filter @repo/api exec tsx watch \
  --include ../../packages/contracts/dist \
  --include ../../packages/auth/src \
  --include ../../packages/db/src \
  src/index.ts &
SERVER_PID=$!

cleanup() {
  kill "$CONTRACTS_PID" "$SERVER_PID" 2>/dev/null || true
}

trap cleanup INT TERM
wait "$SERVER_PID"
status=$?
cleanup
trap - INT TERM
exit "$status"
