import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Подключение к PostgreSQL. В dev-режиме Next.js перезагружает модули на каждом
 * изменении файла, поэтому пул кладётся на globalThis — иначе через десяток
 * правок база упрётся в лимит соединений.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Не задана переменная DATABASE_URL. Скопируйте .env.example в .env и укажите строку подключения.",
  );
}

const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

/**
 * На бессерверном хостинге каждый вызов живёт в своём процессе, а пул
 * соединений Neon общий: большой max быстро упирается в лимит. В продакшене
 * держим одно соединение на процесс, в разработке — обычный пул.
 *
 * prepare: false обязателен при подключении через пулер Neon (PgBouncer
 * в режиме транзакций): подготовленные выражения там не переживают
 * границу транзакции, и запросы падают на втором обращении.
 */
const isServerless = process.env.NETLIFY === "true" || process.env.VERCEL === "1";

const sql =
  globalForDb.__sql ??
  postgres(url, {
    max: isServerless ? 1 : 10,
    prepare: !isServerless,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
