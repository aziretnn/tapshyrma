import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, organizations } from "@/db/schema";

/**
 * Аутентификация скелета: пароль и подписанная cookie, без внешних зависимостей.
 *
 * ЗАМЕНЯЕТСЯ на этапе 11 плана: вход по учётной записи государственного органа,
 * в перспективе — электронная подпись. Всё, что здесь есть, — минимум, чтобы
 * документ имел автора и организацию.
 */

const COOKIE = "tapshyrma_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET не задан или короче 32 символов. См. .env.example.",
    );
  }
  return s;
}



function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Идентификатор пользователя из подписанной cookie, либо null. */
async function sessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, mac] = parts;

  const expected = sign(`${userId}.${expires}`);
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;

  return userId;
}

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  position: string;
  role: (typeof users.$inferSelect)["role"];
  org: typeof organizations.$inferSelect;
};

/** Текущий пользователь вместе с организацией, либо null. */
export async function currentUser(): Promise<CurrentUser | null> {
  const id = await sessionUserId();
  if (!id) return null;

  const rows = await db
    .select({ user: users, org: organizations })
    .from(users)
    .innerJoin(organizations, eq(users.orgId, organizations.id))
    .where(eq(users.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    position: row.user.position,
    role: row.user.role,
    org: row.org,
  };
}

/** Как currentUser, но бросает — для страниц, которые без пользователя не имеют смысла. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Реэкспорт, чтобы серверный код брал всё, что связано со входом, из одного модуля. */
export { hashPassword, verifyPassword };
