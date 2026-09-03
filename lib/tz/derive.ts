import type { TzModel, Stage, DocItem, LegalRef } from "@/lib/tz/model";
import { LEGAL_ACTS } from "@/lib/reference/legal-acts";

/**
 * Стадия 02→04 конвейера: из ответов анкеты выводится всё, что пользователь
 * не должен вводить руками — коды требований, нумерация этапов, календарные
 * сроки, перечень документации и раздел 9 «Источники разработки».
 *
 * Функция чистая: одинаковая модель на входе даёт одинаковый документ на выходе.
 * Это то, что делает документ воспроизводимым и пригодным для diff между версиями.
 */

export type Derived = {
  /** Требования с проставленными кодами ФТ-01, ФТ-02… */
  functions: (TzModel["functions"][number] & { code: string })[];
  /** Этапы с кодами и вычисленными календарными границами. */
  stages: (Stage & { code: string; startDay: number; endDay: number })[];
  totalDays: number;
  endDate: string | null;
  documentation: DocItem[];
  sources: LegalRef[];
  /** Строки таблицы раздела 6: требование → как проверяется. */
  traceability: { code: string; title: string; acceptance: string }[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Этапы по умолчанию — зависят от того, что именно закупается. */
export function defaultStages(kind: TzModel["systemKind"]): Omit<Stage, "id">[] {
  if (kind === "develop_as") {
    return [
      { code: "", name: "Обследование и уточнение требований", deliverables: "Отчёт об обследовании, уточнённая спецификация требований", durationDays: 20 },
      { code: "", name: "Доработка системы", deliverables: "Исходный код доработок, обновлённая эксплуатационная документация", durationDays: 60 },
      { code: "", name: "Испытания и ввод в эксплуатацию", deliverables: "Протоколы испытаний, акт ввода в эксплуатацию", durationDays: 30 },
    ];
  }
  if (kind === "software") {
    return [
      { code: "", name: "Разработка программного изделия", deliverables: "Исходный код, программная документация", durationDays: 75 },
      { code: "", name: "Испытания и передача", deliverables: "Протоколы испытаний, акт приёма-передачи", durationDays: 25 },
    ];
  }
  return [
    { code: "", name: "Обследование объекта автоматизации", deliverables: "Отчёт об обследовании", durationDays: 20 },
    { code: "", name: "Техническое проектирование", deliverables: "Технический проект, описание постановки задач", durationDays: 30 },
    { code: "", name: "Разработка рабочей документации и системы", deliverables: "Исходный код, рабочая документация", durationDays: 70 },
    { code: "", name: "Испытания и опытная эксплуатация", deliverables: "Программа и методика испытаний, протоколы, акт приёмки", durationDays: 40 },
  ];
}

/**
 * Перечень передаваемой документации. На этапе 7 плана заменяется выборкой
 * из справочника ГОСТ 34.201; сейчас — минимальный обязательный набор.
 */
function documentationFor(model: TzModel): DocItem[] {
  const items: DocItem[] = [
    { id: "doc-user", name: "Руководство пользователя", standard: "ГОСТ 34.201" },
    { id: "doc-admin", name: "Руководство администратора", standard: "ГОСТ 34.201" },
    { id: "doc-install", name: "Инструкция по установке и настройке", standard: "ГОСТ 34.201" },
    { id: "doc-test", name: "Программа и методика испытаний", standard: "ГОСТ 34.201" },
  ];

  if (model.systemKind !== "software") {
    items.splice(1, 0, {
      id: "doc-tech",
      name: "Описание постановки задач и технический проект",
      standard: "ГОСТ 34.201",
    });
  }
  if (model.works.sourceCodeTransfer) {
    items.push({ id: "doc-src", name: "Исходный код с инструкцией по сборке", standard: "—" });
  }
  if (model.flags.processesPersonalData) {
    items.push({ id: "doc-pdn", name: "Описание мер защиты информации персонального характера", standard: "—" });
  }
  return items;
}

/**
 * Раздел 9 собирается только из справочника: акт попадает в документ, если
 * ответы анкеты его действительно задействовали. Реквизиты никогда не пишутся
 * от руки и не генерируются моделью.
 */
function sourcesFor(model: TzModel): LegalRef[] {
  const use = (id: string, reason: string): LegalRef | null => {
    const act = LEGAL_ACTS.find((a) => a.id === id);
    return act ? { actId: act.id, citation: act.citation, reason } : null;
  };

  const refs: (LegalRef | null)[] = [
    use("zakup-27", "Документ входит в состав конкурсной документации государственной закупки."),
    model.systemKind === "software"
      ? use("gost-19201", "Структура технического задания на программное изделие.")
      : use("gost-34602", "Структура технического задания на создание автоматизированной системы."),
    use("gost-34201", "Состав и обозначение передаваемой документации."),
    model.flags.processesPersonalData
      ? use("pdn-58", "Система обрабатывает информацию персонального характера.")
      : null,
    model.flags.isStateIS
      ? use("gis-protect", "Система является государственной информационной системой.")
      : null,
    model.flags.needsTunduk
      ? use("tunduk", "Требуется межведомственный электронный обмен данными.")
      : null,
    model.flags.isStateIS
      ? use("state-language", "Требования к языку интерфейса и передаваемой документации.")
      : null,
    model.works.exclusiveRightsTransfer || model.works.sourceCodeTransfer
      ? use("gk-kr", "Условия передачи заказчику исключительных прав и исходного кода.")
      : null,
  ];

  return refs.filter((r): r is LegalRef => r !== null);
}

function addDays(iso: string, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function derive(model: TzModel): Derived {
  const functions = model.functions.map((f, i) => ({ ...f, code: `ФТ-${pad2(i + 1)}` }));

  let cursor = 0;
  const stages = model.works.stages.map((s, i) => {
    const startDay = cursor + 1;
    cursor += s.durationDays;
    return { ...s, code: `Э-${i + 1}`, startDay, endDay: cursor };
  });

  return {
    functions,
    stages,
    totalDays: cursor,
    endDate: addDays(model.meta.startDate, cursor),
    documentation: documentationFor(model),
    sources: sourcesFor(model),
    traceability: functions.map((f) => ({
      code: f.code,
      title: f.title,
      acceptance: f.acceptance,
    })),
  };
}

/**
 * Полнота заполнения — для индикатора в мастере. Это НЕ движок проверок
 * (этап 7–8 плана): здесь считается только заполненность, а не соответствие нормам.
 */
export function completeness(model: TzModel): { filled: number; total: number; gaps: string[] } {
  const checks: { ok: boolean; gap: string }[] = [
    { ok: model.meta.title.trim().length > 0, gap: "Не указано наименование системы" },
    { ok: model.meta.okgzCode.length > 0, gap: "Не выбран код ОКГЗ" },
    { ok: model.meta.basis.trim().length > 0, gap: "Не указано основание для проведения работ" },
    { ok: model.purpose.problem.trim().length > 0, gap: "Не описана решаемая проблема" },
    { ok: model.purpose.goals.length > 0, gap: "Не задана ни одна цель создания системы" },
    {
      ok: model.purpose.goals.every((g) => g.indicator.trim().length > 0),
      gap: "У части целей нет измеримого показателя",
    },
    { ok: model.object.processes.trim().length > 0, gap: "Не описаны автоматизируемые процессы" },
    { ok: model.object.userGroups.length > 0, gap: "Не указаны группы пользователей" },
    { ok: model.functions.length > 0, gap: "Не задано ни одного функционального требования" },
    {
      ok: model.functions.every((f) => f.acceptance.trim().length > 0),
      gap: "У части требований нет критерия приёмки",
    },
    { ok: model.works.stages.length > 0, gap: "Не заданы этапы работ" },
    { ok: model.acceptance.order.trim().length > 0, gap: "Не описан порядок приёмки" },
    {
      ok: !model.flags.processesPersonalData || model.pdn.categories.length > 0,
      gap: "Заявлена обработка персональных данных, но не указаны категории",
    },
  ];

  return {
    filled: checks.filter((c) => c.ok).length,
    total: checks.length,
    gaps: checks.filter((c) => !c.ok).map((c) => c.gap),
  };
}
