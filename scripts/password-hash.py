"""Хеш пароля для таблицы users — без Node.

Нужен, пока Node не установлен: пароль из db/seed.sql известен всем, кто
читал репозиторий, и его обязательно менять до того, как адрес станет
публичным. Алгоритм тот же, что в lib/password.ts (scrypt, N=16384, r=8,
p=1, 64 байта); реализация проверена контрольными векторами RFC 7914.

    python3 scripts/password-hash.py 'новый-пароль'

Выведет строку хеша и готовый SQL для обновления учётной записи.
Когда появится Node, этот скрипт больше не нужен: хеш считает приложение.
"""

import secrets
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrypt_pure import scrypt  # noqa: E402

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

password = sys.argv[1]
email = sys.argv[2] if len(sys.argv) > 2 else "drafter@example.kg"

salt = secrets.token_hex(16)
derived = scrypt(password.encode("utf-8"), salt.encode("utf-8"), 16384, 8, 1, 64).hex()
stored = salt + ":" + derived

print("\nХеш:\n" + stored)
print("\nSQL для обновления (выполнить в SQL-редакторе базы):\n")
print(f"update users set password_hash = '{stored}' where email = '{email}';\n")
