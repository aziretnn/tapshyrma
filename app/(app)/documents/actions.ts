"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { emptyModel, parseModel, type TzModel } from "@/lib/tz/model";
import type { SaveResult } from "@/components/Wizard";

/** Создаёт документ и его первую версию. Реквизиты заказчика берутся из карточки организации. */
export async function createDocument(formData: FormData): Promise<void> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();

  const model = emptyModel();
  model.meta.title = title;
  model.meta.customerName = user.org.name;
  model.meta.customerShortName = user.org.shortName;
  model.meta.customerAddress = user.org.address;
  model.meta.headName = user.org.headName;
  model.meta.headPosition = user.org.headPosition;

  const [doc] = await db
    .insert(documents)
    .values({ orgId: user.org.id, title, createdBy: user.id })
    .returning();

  await db.insert(documentVersions).values({
    documentId: doc.id,
    version: 1,
    model,
    note: "Создание документа",
    createdBy: user.id,
  });

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

/**
 * Сохраняет новую версию документа.
 *
 * Версия всегда добавляется, а не перезаписывается: история редакций — основа
 * ответа на вопрос проверки «кто внёс это требование». Номер версии
 * вычисляется в самом запросе, чтобы два одновременных сохранения не заняли
 * один и тот же номер — на этот случай стоит уникальный индекс.
 */
export async function saveVersion(documentId: string, incoming: TzModel): Promise<SaveResult> {
  const user = await requireUser();

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, user.org.id)))
    .limit(1);

  if (!doc) {
    return { ok: false, error: "Документ не найден или принадлежит другой организации." };
  }
  if (doc.status === "approved") {
    return { ok: false, error: "Документ утверждён. Утверждённая версия не изменяется." };
  }

  // Модель приходит с клиента — разбираем по схеме, а не доверяем присланному.
  const model = parseModel(incoming);

  try {
    const [saved] = await db
      .insert(documentVersions)
      .values({
        documentId,
        version: sql`(select coalesce(max(${documentVersions.version}), 0) + 1 from ${documentVersions} where ${documentVersions.documentId} = ${documentId})`,
        model,
        note: "Правка в мастере",
        createdBy: user.id,
      })
      .returning({ version: documentVersions.version });

    await db
      .update(documents)
      .set({
        title: model.meta.title,
        okgzCode: model.meta.okgzCode,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);

    return { ok: true, version: saved.version };
  } catch {
    return { ok: false, error: "Не удалось сохранить версию. Повторите попытку." };
  }
}

