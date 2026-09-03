#!/bin/sh
# Остановить базу. Приложение останавливается Ctrl+C в своём окне.
PGBIN="$HOME/.local/opt/Postgres.app/Contents/Versions/16/bin"
"$PGBIN/pg_ctl" -D "$HOME/.local/var/postgres-tapshyrma" stop
