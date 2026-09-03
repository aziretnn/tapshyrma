import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { latestVersion } from "@/lib/documents";
import { parseModel } from "@/lib/tz/model";
import { saveVersion } from "../actions";
import Wizard from "@/components/Wizard";

/**
 * Редактор документа: мастер-анкета слева, документ по ГОСТ справа.
 *
 * Страница серверная — она достаёт последнюю версию и передаёт мастеру
 * уже привязанное к документу действие сохранения.
 */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const found = await latestVersion(user, id);
  if (!found) notFound();

  const { doc, version } = found;
  const model = parseModel(version.model);

  const save = saveVersion.bind(null, doc.id);

  return (
    <main className="page-wide">
      <p className="eyebrow">
        <Link href="/documents" style={{ textDecoration: "none" }}>
          ← Все документы
        </Link>
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1.5rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{doc.title || "Без наименования"}</h1>
        <a className="btn" href={`/documents/${doc.id}/export`} download>
          Скачать .docx — версия {version.version}
        </a>
      </div>

      <Wizard initialModel={model} currentVersion={version.version} save={save} />
    </main>
  );
}
