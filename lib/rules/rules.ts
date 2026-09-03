import type { TzModel } from "@/lib/tz/model";
import type { Finding, Rule } from "@/lib/rules/types";
import { actById } from "@/lib/reference/legal-acts";
import { okgzByCode } from "@/lib/reference/okgz";
import {
  REQUIRED_LANGUAGES,
  REQUIRED_SECURITY_FOR_GIS,
  REQUIRED_SECURITY_FOR_PDN,
  containsBrand,
  findVagueTerms,
  hasEquivalentClause,
  hasNumber,
} from "@/lib/rules/dictionaries";

/**
 * Реестр правил R-01…R-14.
 *
 * Каждое правило знает, на какую норму опирается (actId из справочника НПА),
 * и возвращает замечания с собственной серьёзностью: одно правило может дать
 * и блокирующее замечание, и предупреждение — например, торговая марка без
 * оговорки «или эквивалент» блокирует, а с оговоркой требует обоснования.
 */

/** Место в документе, содержащее свободный текст. */
type TextSpot = {
  label: string;
  stepId: string;
  value: string;
  /** Требование ли это. На требования распространяется проверка измеримости. */
  isRequirement: boolean;
  /** Якорь для стабильного ключа замечания. */
  anchor: string;
};

function textSpots(m: TzModel): TextSpot[] {
  const spots: TextSpot[] = [
    { label: "Раздел 2. Решаемая проблема", stepId: "purpose", value: m.purpose.problem, isRequirement: false, anchor: "purpose.problem" },
    { label: "Раздел 3. Автоматизируемые процессы", stepId: "object", value: m.object.processes, isRequirement: false, anchor: "object.processes" },
    { label: "Раздел 3. Объёмы данных", stepId: "object", value: m.object.volumes, isRequirement: false, anchor: "object.volumes" },
    { label: "Раздел 3. Существующие системы", stepId: "object", value: m.object.existingSystems, isRequirement: false, anchor: "object.existing" },
    { label: "Раздел 4.1. Способ аутентификации", stepId: "whole", value: m.whole.authMethod, isRequirement: true, anchor: "whole.auth" },
    { label: "Раздел 4.1. Требования к интеграции", stepId: "whole", value: m.whole.integrations, isRequirement: true, anchor: "whole.integrations" },
    { label: "Раздел 4.3. Информационное обеспечение", stepId: "support", value: m.support.information, isRequirement: true, anchor: "support.information" },
    { label: "Раздел 4.3. Программное обеспечение", stepId: "support", value: m.support.software, isRequirement: true, anchor: "support.software" },
    { label: "Раздел 4.3. Техническое обеспечение", stepId: "support", value: m.support.hardware, isRequirement: true, anchor: "support.hardware" },
    { label: "Раздел 4.3. Лингвистическое обеспечение", stepId: "support", value: m.support.linguistic, isRequirement: true, anchor: "support.linguistic" },
    { label: "Раздел 4.3. Организационное обеспечение", stepId: "support", value: m.support.organizational, isRequirement: true, anchor: "support.organizational" },
    { label: "Раздел 6. Порядок приёмки", stepId: "acceptance", value: m.acceptance.order, isRequirement: true, anchor: "acceptance.order" },
    { label: "Раздел 7. Обучение пользователей", stepId: "preparation", value: m.preparation.training, isRequirement: false, anchor: "prep.training" },
    { label: "Раздел 7. Перенос данных", stepId: "preparation", value: m.preparation.migration, isRequirement: false, anchor: "prep.migration" },
  ];

  m.purpose.goals.forEach((g, i) => {
    spots.push({
      label: `Раздел 2. Показатель цели ${i + 1}`,
      stepId: "purpose",
      value: g.indicator,
      isRequirement: true,
      anchor: `goal.${g.id}`,
    });
  });

  m.functions.forEach((f, i) => {
    const code = `ФТ-${String(i + 1).padStart(2, "0")}`;
    spots.push({
      label: `Раздел 4.2. ${code} — описание`,
      stepId: "functions",
      value: f.description,
      isRequirement: true,
      anchor: `fn.${f.id}.description`,
    });
    spots.push({
      label: `Раздел 4.2. ${code} — критерий приёмки`,
      stepId: "functions",
      value: f.acceptance,
      isRequirement: true,
      anchor: `fn.${f.id}.acceptance`,
    });
  });

  m.works.stages.forEach((s, i) => {
    spots.push({
      label: `Раздел 5. Этап ${i + 1} — результат`,
      stepId: "works",
      value: s.deliverables,
      isRequirement: false,
      anchor: `stage.${s.id}.deliverables`,
    });
  });

  return spots.filter((s) => s.value.trim().length > 0);
}

export const RULES: Rule[] = [
  {
    id: "R-01",
    severity: "blocking",
    title: "Торговые марки и наименования производителей",
    actId: "zakup-27",
    implemented: true,
    check: ({ model }) =>
      textSpots(model).flatMap((spot) => {
        const brand = containsBrand(spot.value);
        if (!brand) return [];

        const withEquivalent = hasEquivalentClause(spot.value);
        return [
          {
            ruleId: "R-01",
            severity: withEquivalent ? "warning" : "blocking",
            title: withEquivalent
              ? `Торговая марка «${brand.name}» с оговоркой об эквиваленте`
              : `Торговая марка «${brand.name}» без оговорки об эквиваленте`,
            detail: withEquivalent
              ? `${spot.label}: указание конкретной марки допустимо только при обоснованной необходимости. Обоснуйте, почему характеристик недостаточно и требуется именно эта марка.`
              : `${spot.label}: конкурсная документация не должна содержать требований к конкретным торговым маркам и наименованиям производителей. Опишите характеристики вместо продукта либо добавьте формулировку «или эквивалент».`,
            stepId: spot.stepId,
            actId: "zakup-27",
            key: `R-01:${spot.anchor}:${brand.name}`,
          } satisfies Finding,
        ];
      }),
  },

  {
    id: "R-02",
    severity: "warning",
    title: "Неизмеримые формулировки требований",
    actId: "zakup-27",
    implemented: true,
    check: ({ model }) =>
      textSpots(model)
        .filter((s) => s.isRequirement)
        .flatMap((spot) => {
          const terms = findVagueTerms(spot.value);
          // Формулировка с числом уже поддаётся проверке, даже если звучит общо.
          if (terms.length === 0 || hasNumber(spot.value)) return [];

          return [
            {
              ruleId: "R-02",
              severity: "warning",
              title: `Требование сформулировано неизмеримо: «${terms[0]}»`,
              detail: `${spot.label}: формулировку невозможно проверить на приёмке. Замените оценочное слово на числовое значение и способ измерения либо обоснуйте, почему требование остаётся качественным.`,
              stepId: spot.stepId,
              actId: "zakup-27",
              key: `R-02:${spot.anchor}`,
            } satisfies Finding,
          ];
        }),
  },

  {
    id: "R-03",
    severity: "blocking",
    title: "Полнота обязательных разделов",
    actId: "gost-34602",
    implemented: true,
    check: ({ model }) => {
      const required: { ok: boolean; section: string; stepId: string; what: string }[] = [
        { ok: model.meta.title.trim().length > 0, section: "1", stepId: "general", what: "наименование системы" },
        { ok: model.meta.basis.trim().length > 0, section: "1", stepId: "general", what: "основание для проведения работ" },
        { ok: model.purpose.problem.trim().length > 0, section: "2", stepId: "purpose", what: "назначение системы" },
        { ok: model.purpose.goals.length > 0, section: "2", stepId: "purpose", what: "цели создания системы" },
        { ok: model.object.processes.trim().length > 0, section: "3", stepId: "object", what: "автоматизируемые процессы" },
        { ok: model.object.userGroups.length > 0, section: "3", stepId: "object", what: "группы пользователей" },
        { ok: model.functions.length > 0, section: "4.2", stepId: "functions", what: "требования к функциям" },
        { ok: model.support.information.trim().length > 0, section: "4.3", stepId: "support", what: "информационное обеспечение" },
        { ok: model.support.software.trim().length > 0, section: "4.3", stepId: "support", what: "программное обеспечение" },
        { ok: model.works.stages.length > 0, section: "5", stepId: "works", what: "этапы работ" },
        { ok: model.acceptance.order.trim().length > 0, section: "6", stepId: "acceptance", what: "порядок приёмки" },
      ];

      return required
        .filter((r) => !r.ok)
        .map((r) => ({
          ruleId: "R-03",
          severity: "blocking" as const,
          title: `Раздел ${r.section}: не заполнено «${r.what}»`,
          detail: `Раздел ${r.section} не может остаться пустым: структура технического задания предполагает его наличие.`,
          stepId: r.stepId,
          actId: "gost-34602",
          key: `R-03:${r.section}:${r.what}`,
        }));
    },
  },

  {
    id: "R-04",
    severity: "blocking",
    title: "Код ОКГЗ указан и соответствует предмету",
    actId: "zakup-27",
    implemented: true,
    check: ({ model }) => {
      if (!model.meta.okgzCode) {
        return [
          {
            ruleId: "R-04",
            severity: "blocking",
            title: "Не выбран код ОКГЗ",
            detail:
              "Без кода Общего классификатора государственных закупок документ не может быть включён в конкурсную документацию.",
            stepId: "general",
            actId: "zakup-27",
            key: "R-04:missing",
          },
        ];
      }

      const code = okgzByCode(model.meta.okgzCode);
      if (code && code.suggests !== model.systemKind) {
        return [
          {
            ruleId: "R-04",
            severity: "warning",
            title: "Код ОКГЗ расходится с типом предмета закупки",
            detail: `Код ${code.code} обычно применяется к другому типу работ. Проверьте, что код соответствует тому, что закупается, либо обоснуйте выбор.`,
            stepId: "general",
            actId: "zakup-27",
            key: `R-04:mismatch:${code.code}`,
          },
        ];
      }

      return [];
    },
  },

  {
    id: "R-05",
    severity: "warning",
    title: "Критерий приёмки у каждого требования",
    actId: "gost-34602",
    implemented: true,
    check: ({ derived }) =>
      derived.functions
        .filter((f) => f.acceptance.trim().length === 0)
        .map((f) => ({
          ruleId: "R-05",
          severity: "warning" as const,
          title: `${f.code}: не задан критерий приёмки`,
          detail: `Требование «${f.title || "без наименования"}» невозможно проверить на приёмке и защитить при споре с исполнителем.`,
          stepId: "functions",
          actId: "gost-34602",
          key: `R-05:${f.id}`,
        })),
  },

  {
    id: "R-06",
    severity: "blocking",
    title: "Блок требований к обработке персональных данных",
    actId: "pdn-58",
    implemented: true,
    check: ({ model }) => {
      if (!model.flags.processesPersonalData) return [];

      const findings: Finding[] = [];

      if (model.pdn.categories.length === 0) {
        findings.push({
          ruleId: "R-06",
          severity: "blocking",
          title: "Не указаны категории персональных данных",
          detail:
            "Заявлена обработка информации персонального характера, но категории данных не перечислены. Исполнитель не сможет спроектировать меры защиты.",
          stepId: "pdn",
          actId: "pdn-58",
          key: "R-06:categories",
        });
      }

      if (model.pdn.basis.trim().length === 0) {
        findings.push({
          ruleId: "R-06",
          severity: "blocking",
          title: "Не указано основание обработки персональных данных",
          detail: "Обработка допускается при наличии основания — согласия субъекта либо полномочий органа.",
          stepId: "pdn",
          actId: "pdn-58",
          key: "R-06:basis",
        });
      }

      if (model.pdn.crossBorder) {
        findings.push({
          ruleId: "R-06",
          severity: "warning",
          title: "Заявлена трансграничная передача персональных данных",
          detail:
            "Передача возможна при обеспечении принимающей стороной уровня защиты не ниже установленного законодательством Кыргызской Республики. Обоснуйте необходимость передачи и укажите принимающую сторону.",
          stepId: "pdn",
          actId: "pdn-58",
          key: "R-06:crossborder",
        });
      }

      return findings;
    },
  },

  {
    id: "R-07",
    severity: "blocking",
    title: "Требования к защите информации",
    actId: "gis-protect",
    implemented: true,
    check: ({ model }) => {
      const findings: Finding[] = [];
      const chosen = new Set(model.whole.securityMeasures);

      const names: Record<string, string> = {
        rbac: "разграничение доступа по ролям",
        audit: "журналирование действий пользователей",
        backup: "резервное копирование",
        tls: "шифрование канала передачи",
        at_rest: "шифрование данных при хранении",
      };

      if (model.flags.isStateIS) {
        for (const code of REQUIRED_SECURITY_FOR_GIS) {
          if (!chosen.has(code)) {
            findings.push({
              ruleId: "R-07",
              severity: "blocking",
              title: `Не заложена мера защиты: ${names[code] ?? code}`,
              detail:
                "Система заявлена как государственная информационная система. Требования к защите информации в базах данных ГИС обязательны и не могут быть опущены.",
              stepId: "whole",
              actId: "gis-protect",
              key: `R-07:gis:${code}`,
            });
          }
        }
      }

      if (model.flags.processesPersonalData) {
        for (const code of REQUIRED_SECURITY_FOR_PDN) {
          if (!chosen.has(code)) {
            findings.push({
              ruleId: "R-07",
              severity: "blocking",
              title: `Не заложена мера защиты: ${names[code] ?? code}`,
              detail:
                "Система обрабатывает информацию персонального характера — шифрование при передаче и хранении обязательно.",
              stepId: "whole",
              actId: "pdn-58",
              key: `R-07:pdn:${code}`,
            });
          }
        }
      }

      return findings;
    },
  },

  {
    id: "R-08",
    severity: "warning",
    title: "Межведомственный обмен через «Түндүк»",
    actId: "tunduk",
    implemented: true,
    check: ({ model }) => {
      if (!model.flags.needsTunduk) return [];

      const text = model.whole.integrations.toLowerCase();
      if (text.includes("түндүк") || text.includes("тундук") || text.includes("tunduk")) return [];

      return [
        {
          ruleId: "R-08",
          severity: "warning",
          title: "Не описан обмен через систему «Түндүк»",
          detail:
            "Заявлен межведомственный обмен данными, но в требованиях к интеграции он не описан. Прямое подключение к базам данных иных органов не допускается.",
          stepId: "whole",
          actId: "tunduk",
          key: "R-08:missing",
        },
      ];
    },
  },

  {
    id: "R-09",
    severity: "blocking",
    title: "Передача исходного кода и исключительных прав",
    actId: "gk-kr",
    implemented: true,
    check: ({ model }) => {
      const findings: Finding[] = [];

      if (!model.works.sourceCodeTransfer) {
        findings.push({
          ruleId: "R-09",
          severity: "blocking",
          title: "Исходный код не передаётся заказчику",
          detail:
            "Без передачи исходного кода орган не сможет сопровождать и развивать систему без исполнителя, а следующая закупка окажется безальтернативной.",
          stepId: "works",
          actId: "gk-kr",
          key: "R-09:source",
        });
      }

      if (!model.works.exclusiveRightsTransfer) {
        findings.push({
          ruleId: "R-09",
          severity: "blocking",
          title: "Исключительные права не переходят к заказчику",
          detail:
            "Права на созданное за бюджетные средства программное обеспечение остаются у исполнителя. Условие о переходе прав должно быть прямо указано.",
          stepId: "works",
          actId: "gk-kr",
          key: "R-09:rights",
        });
      }

      return findings;
    },
  },

  {
    id: "R-10",
    severity: "blocking",
    title: "Государственный и официальный языки интерфейса",
    actId: "state-language",
    implemented: true,
    check: ({ model }) => {
      if (!model.flags.isStateIS) return [];

      const missing = REQUIRED_LANGUAGES.filter((l) => !model.whole.languages.includes(l));
      if (missing.length === 0) return [];

      const names: Record<string, string> = { ky: "кыргызский", ru: "русский" };
      return [
        {
          ruleId: "R-10",
          severity: "blocking",
          title: `Интерфейс не предусмотрен на языках: ${missing.map((l) => names[l] ?? l).join(", ")}`,
          detail:
            "Государственная информационная система должна быть доступна на государственном и официальном языках.",
          stepId: "whole",
          actId: "state-language",
          key: `R-10:${missing.join("+")}`,
        },
      ];
    },
  },

  {
    id: "R-11",
    severity: "warning",
    title: "Квалификационные требования не ограничивают круг поставщиков",
    actId: "zakup-27",
    // В модели пока нет раздела квалификационных требований — правило появится
    // вместе с ним. Реестр показывает его, чтобы было видно: эта проверка не выполнялась.
    implemented: false,
  },

  {
    id: "R-12",
    severity: "warning",
    title: "Гарантийный срок и техническая поддержка",
    actId: "gk-kr",
    implemented: true,
    check: ({ model }) => {
      if (model.works.warrantyMonths > 0) return [];
      return [
        {
          ruleId: "R-12",
          severity: "warning",
          title: "Гарантийный срок не установлен",
          detail:
            "Гарантийный срок равен нулю. Устранение дефектов после приёмки придётся закупать отдельно.",
          stepId: "works",
          actId: "gk-kr",
          key: "R-12:warranty",
        },
      ];
    },
  },

  {
    id: "R-13",
    severity: "warning",
    title: "Сроки этапов заданы и непротиворечивы",
    implemented: true,
    check: ({ model, derived }) => {
      const findings: Finding[] = [];

      if (!model.meta.startDate) {
        findings.push({
          ruleId: "R-13",
          severity: "warning",
          title: "Не указана дата начала работ",
          detail: "Без даты начала календарные границы этапов в разделе 5 не рассчитываются.",
          stepId: "general",
          key: "R-13:startdate",
        });
      }

      if (derived.totalDays > 730) {
        findings.push({
          ruleId: "R-13",
          severity: "warning",
          title: `Общий срок работ — ${derived.totalDays} календарных дней`,
          detail:
            "Срок превышает два года. Проверьте, что работы не следует разделить на несколько закупок по годам финансирования.",
          stepId: "works",
          key: "R-13:toolong",
        });
      }

      const unnamed = model.works.stages.filter((s) => s.name.trim().length === 0);
      if (unnamed.length > 0) {
        findings.push({
          ruleId: "R-13",
          severity: "warning",
          title: `Этапов без наименования: ${unnamed.length}`,
          detail: "Безымянный этап нельзя принять и оплатить.",
          stepId: "works",
          key: "R-13:unnamed",
        });
      }

      return findings;
    },
  },

  {
    id: "R-14",
    severity: "blocking",
    title: "Ссылки на нормативные акты существуют и подтверждены",
    implemented: true,
    check: ({ derived }) =>
      derived.sources.flatMap((ref): Finding[] => {
        const act = actById(ref.actId);

        if (!act) {
          return [
            {
              ruleId: "R-14",
              severity: "blocking" as const,
              title: `Ссылка на отсутствующий в справочнике акт: ${ref.actId}`,
              detail:
                "Документ ссылается на норму, которой нет в справочнике. Выпуск невозможен: ссылка может оказаться несуществующей.",
              actId: ref.actId,
              key: `R-14:missing:${ref.actId}`,
            },
          ];
        }

        if (act.status === "unverified") {
          return [
            {
              ruleId: "R-14",
              severity: "warning" as const,
              title: `Реквизиты акта не подтверждены: ${act.short}`,
              detail: `${act.citation}. ${act.note ?? "Требуется подтверждение юристом действующей редакции и применимости."} До подтверждения ссылку следует проверить вручную.`,
              actId: act.id,
              key: `R-14:unverified:${act.id}`,
            },
          ];
        }

        return [];
      }),
  },
];

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}

