import { db } from "./index";
import { organizations, users, documents, documentVersions } from "./schema";
import { exampleModel } from "../lib/tz/example";
import { hashPassword } from "../lib/password";

/**
 * Сид для разработки: один орган, один пользователь и один заполненный документ.
 *
 * Заполненный документ важен: приложение должно открываться в рабочем состоянии,
 * а не пустой формой, иначе непонятно, что оно вообще делает.
 * Данные вымышленные — реальных персональных данных в dev-контуре нет
 * (см. развилку по хостингу в разделе 07 плана).
 */

const DEMO_EMAIL = "drafter@example.kg";
const DEMO_PASSWORD = "tapshyrma";

async function main() {
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Государственное учреждение «Демонстрационный орган»",
      shortName: "Демо-орган",
      address: "г. Бишкек, бул. Эркиндик, 58",
      headName: "А. А. Осмонов",
      headPosition: "Директор",
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      orgId: org.id,
      email: DEMO_EMAIL,
      passwordHash: hashPassword(DEMO_PASSWORD),
      fullName: "Н. К. Абдыразакова",
      position: "Главный специалист отдела информатизации",
      role: "drafter",
    })
    .returning();

  const model = exampleModel();

  const [doc] = await db
    .insert(documents)
    .values({
      orgId: org.id,
      title: model.meta.title,
      okgzCode: model.meta.okgzCode,
      status: "draft",
      createdBy: user.id,
    })
    .returning();

  await db.insert(documentVersions).values({
    documentId: doc.id,
    version: 1,
    model,
    note: "Демонстрационный документ, созданный сидом",
    createdBy: user.id,
  });

  console.log("Готово.");
  console.log(`  Организация: ${org.name}`);
  console.log(`  Вход:        ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Документ:    ${doc.title}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
