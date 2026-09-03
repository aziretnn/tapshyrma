import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";

/**
 * Чтение документов. Держится отдельно от app/(app)/documents/actions.ts:
 * каждый экспорт файла с "use server" становится вызываемой с клиента точкой,
 * а запросы на чтение такой точкой быть не должны.
 *
 * Организация проверяется в каждом запросе — документ одного органа не может
 * быть открыт пользователем другого.
 */

export async function listDocuments(user: CurrentUser) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, user.org.id))
    .orderBy(desc(documents.updatedAt));
}

export async function latestVersion(user: CurrentUser, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, user.org.id)))
    .limit(1);

  if (!doc) return null;

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version))
    .limit(1);

  return version ? { doc, version } : null;
}
