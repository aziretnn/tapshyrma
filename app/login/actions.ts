"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export async function login(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Укажите почту и пароль." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Одинаковое сообщение независимо от того, что не совпало,
  // чтобы форма не подсказывала, какие адреса заведены в системе.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Неверная почта или пароль." };
  }

  await createSession(user.id);
  redirect("/documents");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
