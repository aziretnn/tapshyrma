import { currentUser } from "@/lib/auth";
import { latestVersion } from "@/lib/documents";
import { parseModel } from "@/lib/tz/model";
import { buildDocx, docxFileName } from "@/lib/export/docx";

/**
 * Выгрузка последней сохранённой версии документа в .docx.
 *
 * Экспортируется именно сохранённая версия, а не то, что сейчас в мастере:
 * файл уходит из системы и может попасть в конкурсную документацию, поэтому
 * он обязан соответствовать зафиксированной версии, у которой есть автор
 * и время. Несохранённый черновик такой версией не является.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) {
    return new Response("Требуется вход в систему.", { status: 401 });
  }

  const found = await latestVersion(user, id);
  if (!found) {
    return new Response("Документ не найден или принадлежит другой организации.", { status: 404 });
  }

  const model = parseModel(found.version.model);
  const bytes = buildDocx(model);
  const name = docxFileName(model);

  return new Response(new Blob([bytes]), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // ASCII-запасное имя плюс filename* для кириллицы — иначе часть браузеров
      // сохраняет файл с испорченным названием.
      "Content-Disposition":
        `attachment; filename="tz-v${found.version.version}.docx"; ` +
        `filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
