#!/bin/sh
set -e

# RUN_MIGRATIONS=true means this container should apply pending Prisma migrations
# before starting. Set on the API container; leave unset on the worker so it doesn't
# race against the API. `prisma migrate deploy` is idempotent and safe to re-run.
if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec "$@"
