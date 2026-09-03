import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Хеширование паролей. Вынесено отдельно от lib/auth.ts намеренно: сид
 * (db/seed.ts) запускается обычным Node вне Next.js и не должен тянуть
 * next/headers и server-only.
 */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, "hex");
  if (derived.length !== expectedBuf.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}
