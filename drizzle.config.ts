import { readFileSync } from "node:fs";
import type { Config } from "drizzle-kit";

/**
 * Конфигурация drizzle-kit.
 *
 * .env читается здесь вручную: drizzle-kit запускается своим бинарником, мимо
 * Next.js и мимо флага --env-file, и молча уходит на localhost, если переменной
 * нет. Для managed-базы это означало бы «push прошёл», но не туда, куда ждали.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const line = readFileSync(".env", "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("DATABASE_URL="));
    if (line) {
      return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env может отсутствовать — тогда падаем на понятной ошибке ниже.
  }

  throw new Error(
    "Не задана DATABASE_URL. Скопируйте .env.example в .env и укажите строку подключения.",
  );
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
} satisfies Config;
