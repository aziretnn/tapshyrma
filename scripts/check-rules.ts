import { emptyModel, type TzModel } from "../lib/tz/model";
import { audit, pruneJustifications } from "../lib/rules/engine";
import { RULES } from "../lib/rules/rules";
import { defaultStages } from "../lib/tz/derive";

/**
 * Самопроверка движка правил: `npm run check`.
 *
 * Без тестового фреймворка намеренно — это первое, что должно запуститься
 * на свежей машине, ещё до установки чего-либо сверх зависимостей проекта.
 * Полноценные тесты появятся вместе с корпусом реальных ТЗ (неделя 1 плана).
 */

let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ок    ${name}`);
  } else {
    failed++;
    console.log(`  СБОЙ  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Модель без единого блокирующего замечания — точка отсчёта для остальных проверок. */
function cleanModel(): TzModel {
  const m = emptyModel();
  m.meta.title = "Испытательная система";
  m.meta.basis = "План закупок, позиция 1";
  m.meta.okgzCode = "72230000-6";
  m.meta.startDate = "2026-10-01";
  m.systemKind = "new_as";
  m.flags = { isStateIS: true, processesPersonalData: false, needsTunduk: false, publicFacing: false };
  m.purpose.problem = "Учёт ведётся на бумаге, срок поиска записи составляет 3 дня.";
  m.purpose.goals = [{ id: "g1", statement: "Сократить срок", indicator: "Не более 5 дней" }];
  m.object.processes = "Регистрация, рассмотрение, ответ.";
  m.object.userGroups = [{ id: "u1", name: "Специалисты", headcount: 10, duties: "Регистрация" }];
  m.whole.languages = ["ky", "ru"];
  m.whole.securityMeasures = ["rbac", "audit", "backup"];
  m.functions = [
    {
      id: "f1",
      code: "",
      title: "Регистрация",
      description: "Система регистрирует запись с присвоением номера.",
      priority: "must",
      acceptance: "Запись получает номер не позднее 1 секунды после сохранения.",
    },
  ];
  m.support.information = "Справочник подразделений.";
  m.support.software = "Программное обеспечение с открытым исходным кодом.";
  m.works.stages = defaultStages("new_as").map((s, i) => ({ ...s, id: `s${i + 1}` }));
  m.acceptance.order = "Приёмка комиссией в течение 10 рабочих дней.";
  return m;
}

function findings(m: TzModel, ruleId: string) {
  return audit(m).findings.filter((f) => f.ruleId === ruleId);
}

console.log("\nРеестр правил");
check(`описано ${RULES.length} правил`, RULES.length === 14, `найдено ${RULES.length}`);
check(
  "у каждого реализованного правила есть проверка",
  RULES.every((r) => !r.implemented || typeof r.check === "function"),
);
check(
  "идентификаторы правил уникальны",
  new Set(RULES.map((r) => r.id)).size === RULES.length,
);

console.log("\nЧистый документ");
{
  const base = cleanModel();
  const result = audit(base);
  const other = result.blocking.filter((f) => f.ruleId !== "R-14");
  check(
    "нет блокирующих замечаний, кроме возможных по справочнику НПА",
    other.length === 0,
    other.map((f) => `${f.ruleId}: ${f.title}`).join("; "),
  );
}

console.log("\nR-01 — торговые марки");
{
  const withBrand = cleanModel();
  withBrand.support.software = "Отчёты выгружаются в формате Microsoft Excel.";
  const found = findings(withBrand, "R-01");
  check("марка без оговорки даёт блокирующее замечание", found[0]?.severity === "blocking");

  const withEquivalent = cleanModel();
  withEquivalent.support.software = "Формат Microsoft Excel или эквивалент.";
  const soft = findings(withEquivalent, "R-01");
  check("марка с оговоркой «или эквивалент» понижается до предупреждения", soft[0]?.severity === "warning");

  check("чистый текст замечаний не даёт", findings(cleanModel(), "R-01").length === 0);
}

console.log("\nR-02 — измеримость");
{
  const vague = cleanModel();
  vague.functions[0].description = "Система должна иметь удобный интерфейс.";
  check("оценочная формулировка без числа отмечается", findings(vague, "R-02").length === 1);

  const measured = cleanModel();
  measured.functions[0].description = "Удобный интерфейс: не более 3 кликов до операции.";
  check("та же формулировка с числом не отмечается", findings(measured, "R-02").length === 0);
}

console.log("\nR-06 и R-07 — персональные данные");
{
  const pdn = cleanModel();
  pdn.flags.processesPersonalData = true;
  const found = audit(pdn).blocking;
  check("незаполненный блок ПДн блокирует", found.some((f) => f.ruleId === "R-06"));
  check("отсутствие шифрования блокирует", found.some((f) => f.ruleId === "R-07"));

  pdn.pdn.categories = ["fio"];
  pdn.pdn.basis = "Полномочия органа";
  pdn.whole.securityMeasures = ["rbac", "audit", "backup", "tls", "at_rest"];
  check("заполненный блок снимает замечания", findings(pdn, "R-06").length === 0 && findings(pdn, "R-07").length === 0);
}

console.log("\nR-09 и R-10 — права и языки");
{
  const noRights = cleanModel();
  noRights.works.sourceCodeTransfer = false;
  noRights.works.exclusiveRightsTransfer = false;
  check("отказ от кода и прав даёт два замечания", findings(noRights, "R-09").length === 2);

  const oneLang = cleanModel();
  oneLang.whole.languages = ["ru"];
  check("отсутствие государственного языка блокирует", findings(oneLang, "R-10")[0]?.severity === "blocking");
}

console.log("\nR-14 — справочник НПА");
{
  const found = findings(cleanModel(), "R-14");
  check("неподтверждённые акты отмечаются предупреждением", found.length > 0 && found.every((f) => f.severity === "warning"));
  check("ссылок на отсутствующие в справочнике акты нет", found.every((f) => !f.title.includes("отсутствующий")));
}

console.log("\nОбоснования");
{
  const m = cleanModel();
  m.functions[0].description = "Система должна иметь удобный интерфейс.";
  const before = audit(m);
  const warning = before.findings.find((f) => f.ruleId === "R-02");

  check("предупреждение без обоснования попадает в unjustified", before.unjustified.length > 0);

  if (warning) {
    m.compliance.justifications[warning.key] = "Требование уточняется на этапе проектирования.";
    const after = audit(m, m.compliance.justifications);
    check(
      "обоснование снимает предупреждение из unjustified",
      !after.unjustified.some((f) => f.key === warning.key),
    );

    const stale = { ...m.compliance.justifications, "R-02:несуществующий": "текст" };
    const pruned = pruneJustifications(stale, after.findings);
    check("обоснование к исчезнувшему замечанию отбрасывается", !("R-02:несуществующий" in pruned));
    check("обоснование к живому замечанию сохраняется", warning.key in pruned);
  }
}

console.log(
  failed === 0 ? "\nВсе проверки пройдены.\n" : `\nПровалено проверок: ${failed}.\n`,
);
process.exit(failed === 0 ? 0 : 1);
