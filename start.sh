#!/bin/sh
# Запуск «Тапшырмы» на localhost.
#
# Node лежит в ~/.local/opt (распакован без sudo), PostgreSQL 16 — бинарники
# из Postgres.app там же, кластер в ~/.local/var/postgres-tapshyrma на порту
# 5433, чтобы не конфликтовать с системным, если он когда-нибудь появится.

set -e

PATH="$HOME/.local/bin:$PATH"
export PATH

PGBIN="$HOME/.local/opt/Postgres.app/Contents/Versions/16/bin"
PGDATA="$HOME/.local/var/postgres-tapshyrma"

if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
  echo "Запускаю PostgreSQL…"
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$HOME/.local/var/postgres-tapshyrma.log" \
    -o "-p 5433 -k /tmp -c listen_addresses=127.0.0.1" start
  sleep 2
fi

echo "PostgreSQL готов. Запускаю приложение на http://localhost:3000"
cd "$(dirname "$0")"
exec npm run dev
