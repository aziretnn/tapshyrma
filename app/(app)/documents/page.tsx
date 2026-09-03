import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import { createDocument } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  revision: "На доработке",
  review: "На согласовании",
  checked: "Проверен",
  approved: "Утверждён",
};

function statusClass(status: string): string {
  if (status === "approved") return "badge badge-approved";
  if (status === "draft") return "badge badge-draft";
  return "badge";
}

export default async function DocumentsPage() {
  const user = await requireUser();
  const docs = await listDocuments(user);

  return (
    <main className="page">
      <p className="eyebrow">{user.org.shortName || user.org.name}</p>
      <h1>Технические задания</h1>
      <p className="lede">
        Документы органа. Каждое сохранение создаёт новую версию — история редакций не
        перезаписывается.
      </p>

      <form action={createDocument} style={{ display: "flex", gap: "0.6rem", marginBottom: "2rem" }}>
        <input
          type="text"
          name="title"
          placeholder="Наименование системы"
          aria-label="Наименование системы"
          required
        />
        <button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
          Создать ТЗ
        </button>
      </form>

      <div className="rows">
        {docs.length === 0 ? (
          <p className="empty">Документов пока нет. Создайте первое техническое задание выше.</p>
        ) : (
          docs.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className="row">
              <span>
                <span className="row-title">{doc.title || "Без наименования"}</span>
                <span className="row-meta">
                  {doc.okgzCode || "код ОКГЗ не выбран"} ·{" "}
                  {doc.updatedAt.toLocaleDateString("ru-RU")}
                </span>
              </span>
              <span className={statusClass(doc.status)}>{STATUS_LABEL[doc.status]}</span>
            </Link>
          ))
        )}
      </div>

      <p className="note">
        Движок проверок на соответствие требованиям законодательства подключается на этапе 7–8
        плана. Сейчас мастер показывает только полноту заполнения документа.
      </p>
    </main>
  );
}
