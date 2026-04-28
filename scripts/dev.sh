#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  lsof -ti :5173 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT INT TERM

docker compose up -d redis
concurrently npm:dev:backend npm:dev:frontend
