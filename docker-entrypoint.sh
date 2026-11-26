#!/bin/sh
# Apply any pending database migrations, then start the app.
set -e

echo "Life OS: applying database migrations to ${DATABASE_URL}"
node node_modules/prisma/build/index.js migrate deploy

echo "Life OS: starting on port ${PORT}"
# 0.0.0.0 inside the container; docker-compose publishes it on 127.0.0.1 only.
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT}"
