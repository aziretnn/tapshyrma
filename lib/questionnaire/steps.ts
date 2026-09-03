import type { TzModel } from "@/lib/tz/model";
import { OKGZ_IT } from "@/lib/reference/okgz";

/**
 * Мастер-анкета: декларативное описание вопросов с ветвлением.
 *
 * Один шаг анкеты соответствует одному разделу ГОСТ 34.602 — так пользователь
 * видит, какую часть документа он сейчас заполняет, а не абстрактную форму.
 * Ветвление задаётся предикатом showIf и работает на двух уровнях: шаг целиком
 * и отдельное поле внутри шага.
 */

export type Option = { value: string; label: string };

type FieldBase = {
  path: string;
  label: string;
  hint?: string;
  showIf?: (m: TzModel) => boolean;
};

export type Field = FieldBase &
  (
    | { kind: "text"; placeholder?: string }
    | { kind: "textarea"; rows?: number; placeholder?: string }
    | { kind: "date" }
    | { kind: "number"; min?: number; max?: number; step?: number; suffix?: string }
    | { kind: "select"; options: Option[] }
    | { kind: "radio"; options: Option[] }
    | { kind: "checkbox" }
    | { kind: "multicheck"; options: Option[] }
    | {
        kind: "list";
        addLabel: string;
        /** Поля элемента списка. Пути относительные, внутри элемента. */
        item: Field[];
        /** Путь до поля, которое показывается в шапке карточки элемента. */
        titlePath: string;
        template: () => Record<string, unknown>;
      }
  );

export type Step = {
  id: string;
  /** Номер раздела ГОСТ 34.602, который заполняет этот шаг. */
  section: string;
  title: string;
  intro?: string;
  fields: Field[];
  showIf?: (m: TzModel) => boolean;
};

const SECURITY_MEASURES: Option[] = [
  { value: "rbac", label: "Разграничение доступа по ролям" },
  { value: "audit", label: "Журналирование действий пользователей" },
  { value: "tls", label: "Шифрование канала передачи данных" },
  { value: "at_rest", label: "Шифрование данных при хранении" },
  { value: "backup", label: "Резервное копирование и восстановление" },
  { value: "mfa", label: "Двухфакторная аутентификация" },
  { value: "pentest", label: "Тестирование на проникновение перед вводом в эксплуатацию" },
];

const TEST_TYPES: Option[] = [
  { value: "functional", label: "Функциональное тестирование" },
  { value: "integration", label: "Интеграционное тестирование" },
  { value: "load", label: "Нагрузочное тестирование" },
  { value: "security", label: "Проверка защиты информации" },
  { value: "trial", label: "Опытная эксплуатация" },
];

const PDN_CATEGORIES: Option[] = [
  { value: "fio", label: "Фамилия, имя, отчество" },
  { value: "pin", label: "Персональный идентификационный номер" },
  { value: "contacts", label: "Контактные данные" },
  { value: "address", label: "Адрес проживания" },
  { value: "biometric", label: "Биометрические данные" },
  { value: "special", label: "Данные о здоровье, судимости и иные особой категории" },
];

export const STEPS: Step[] = [
  {
    id: "general",
    section: "Раздел 1",
    title: "Общие сведения",
    intro:
      "Реквизиты заказчика подставляются из карточки организации; здесь уточняется, что и на каком основании закупается.",
    fields: [
      {
        kind: "text",
        path: "meta.title",
        label: "Наименование системы",
        placeholder: "Информационная система учёта обращений граждан",
      },
      {
        kind: "select",
        path: "meta.okgzCode",
        label: "Код ОКГЗ",
        hint: "Определяет профиль шаблона и попадает в конкурсную документацию.",
        options: OKGZ_IT.map((c) => ({ value: c.code, label: `${c.code} — ${c.title}` })),
      },
      {
        kind: "text",
        path: "meta.basis",
        label: "Основание для проведения работ",
        placeholder: "План государственных закупок на 2026 год, позиция 14",
      },
      {
        kind: "text",
        path: "meta.financing",
        label: "Источник финансирования",
        placeholder: "Республиканский бюджет",
      },
      { kind: "date", path: "meta.startDate", label: "Планируемая дата начала работ" },
    ],
  },

  {
    id: "kind",
    section: "Профиль",
    title: "Тип предмета закупки",
    intro: "Ответы здесь открывают обязательные блоки требований в разделах 4 и 6.",
    fields: [
      {
        kind: "radio",
        path: "systemKind",
        label: "Что закупается",
        options: [
          { value: "new_as", label: "Создание новой автоматизированной системы" },
          { value: "develop_as", label: "Развитие (модернизация) существующей системы" },
          { value: "software", label: "Разработка программного изделия без создания АС" },
        ],
      },
      {
        kind: "checkbox",
        path: "flags.isStateIS",
        label: "Система является государственной информационной системой",
        hint: "Включает обязательный блок требований к защите информации в базах данных ГИС.",
      },
      {
        kind: "checkbox",
        path: "flags.processesPersonalData",
        label: "Система обрабатывает информацию персонального характера",
        hint: "Открывает отдельный шаг анкеты и обязательный блок требований по Закону КР № 58.",
      },
      {
        kind: "checkbox",
        path: "flags.needsTunduk",
        label: "Требуется межведомственный обмен данными",
        hint: "Обмен описывается через систему «Түндүк», а не прямыми интеграциями между органами.",
        showIf: (m) => m.flags.isStateIS,
      },
      {
        kind: "checkbox",
        path: "flags.publicFacing",
        label: "У системы есть публичный интерфейс для граждан",
      },
    ],
  },

  {
    id: "purpose",
    section: "Раздел 2",
    title: "Назначение и цели создания системы",
    intro: "Цель без показателя — декларация. Показатель попадёт в раздел 6 как основание приёмки.",
    fields: [
      {
        kind: "textarea",
        path: "purpose.problem",
        label: "Какая проблема решается",
        rows: 4,
        placeholder:
          "Обращения граждан регистрируются в бумажном журнале, срок поиска обращения — до 3 рабочих дней.",
      },
      {
        kind: "list",
        path: "purpose.goals",
        label: "Цели создания системы",
        addLabel: "Добавить цель",
        titlePath: "statement",
        template: () => ({ id: "", statement: "", indicator: "" }),
        item: [
          {
            kind: "text",
            path: "statement",
            label: "Цель",
            placeholder: "Сократить срок рассмотрения обращения",
          },
          {
            kind: "text",
            path: "indicator",
            label: "Измеримый показатель достижения",
            hint: "Числовое значение и способ измерения.",
            placeholder: "Средний срок рассмотрения — не более 5 рабочих дней по данным журнала системы",
          },
        ],
      },
    ],
  },

  {
    id: "object",
    section: "Раздел 3",
    title: "Характеристика объекта автоматизации",
    fields: [
      {
        kind: "textarea",
        path: "object.processes",
        label: "Автоматизируемые процессы",
        rows: 4,
        placeholder:
          "Приём обращения, регистрация, назначение исполнителя, контроль срока, ответ заявителю.",
      },
      {
        kind: "list",
        path: "object.userGroups",
        label: "Группы пользователей",
        addLabel: "Добавить группу",
        titlePath: "name",
        template: () => ({ id: "", name: "", headcount: 0, duties: "" }),
        item: [
          {
            kind: "text",
            path: "name",
            label: "Наименование группы",
            placeholder: "Специалисты отдела делопроизводства",
          },
          { kind: "number", path: "headcount", label: "Численность", min: 0, suffix: "чел." },
          { kind: "text", path: "duties", label: "Что делает в системе" },
        ],
      },
      {
        kind: "textarea",
        path: "object.volumes",
        label: "Объёмы обрабатываемых данных",
        rows: 3,
        placeholder: "До 12 000 обращений в год, средний размер вложения 5 МБ.",
      },
      {
        kind: "textarea",
        path: "object.existingSystems",
        label: "Существующие системы, с которыми связан объект",
        rows: 3,
        hint: "Для модернизации — что именно дорабатывается и в каком состоянии находится сейчас.",
      },
    ],
  },

  {
    id: "pdn",
    section: "Раздел 4.1",
    title: "Обработка персональных данных",
    intro:
      "Шаг открылся, потому что система обрабатывает информацию персонального характера. Ответы формируют обязательный блок требований со ссылкой на Закон КР № 58.",
    showIf: (m) => m.flags.processesPersonalData,
    fields: [
      {
        kind: "multicheck",
        path: "pdn.categories",
        label: "Категории обрабатываемых данных",
        options: PDN_CATEGORIES,
      },
      {
        kind: "text",
        path: "pdn.subjectsCount",
        label: "Предполагаемое число субъектов данных",
        placeholder: "до 200 000 граждан",
      },
      {
        kind: "checkbox",
        path: "pdn.crossBorder",
        label: "Предполагается трансграничная передача данных",
        hint: "Требует адекватного уровня защиты у принимающей стороны — отдельно обосновывается.",
      },
      {
        kind: "textarea",
        path: "pdn.basis",
        label: "Основание обработки",
        rows: 2,
        placeholder: "Согласие субъекта; исполнение полномочий органа, установленных положением.",
      },
    ],
  },

  {
    id: "whole",
    section: "Раздел 4.1",
    title: "Требования к системе в целом",
    intro: "Числовые значения обязательны: требование без числа нельзя проверить на приёмке.",
    fields: [
      {
        kind: "number",
        path: "whole.concurrentUsers",
        label: "Одновременно работающих пользователей",
        min: 1,
        suffix: "чел.",
      },
      {
        kind: "number",
        path: "whole.availabilityPercent",
        label: "Коэффициент готовности",
        min: 90,
        max: 100,
        step: 0.1,
        suffix: "%",
      },
      {
        kind: "number",
        path: "whole.responseTimeMs",
        label: "Время отклика на типовую операцию",
        min: 100,
        step: 100,
        suffix: "мс",
      },
      { kind: "number", path: "whole.retentionYears", label: "Срок хранения данных", min: 1, suffix: "лет" },
      {
        kind: "multicheck",
        path: "whole.languages",
        label: "Языки интерфейса",
        hint: "Государственный и официальный языки обязательны для государственных систем.",
        options: [
          { value: "ky", label: "Кыргызский" },
          { value: "ru", label: "Русский" },
          { value: "en", label: "Английский" },
        ],
      },
      {
        kind: "text",
        path: "whole.authMethod",
        label: "Способ аутентификации пользователей",
        placeholder: "Учётная запись органа, двухфакторная аутентификация",
      },
      {
        kind: "multicheck",
        path: "whole.securityMeasures",
        label: "Меры защиты информации",
        options: SECURITY_MEASURES,
      },
      {
        kind: "textarea",
        path: "whole.integrations",
        label: "Требования к интеграции",
        rows: 3,
        hint: "Межведомственный обмен описывается через «Түндүк».",
        showIf: (m) => m.flags.needsTunduk || m.systemKind === "develop_as",
      },
    ],
  },

  {
    id: "functions",
    section: "Раздел 4.2",
    title: "Требования к функциям",
    intro:
      "Каждое требование получает код, по которому на него ссылается раздел 6, и критерий приёмки, по которому оно проверяется.",
    fields: [
      {
        kind: "list",
        path: "functions",
        label: "Функциональные требования",
        addLabel: "Добавить требование",
        titlePath: "title",
        template: () => ({
          id: "",
          code: "",
          title: "",
          description: "",
          priority: "must",
          acceptance: "",
        }),
        item: [
          { kind: "text", path: "title", label: "Краткое наименование", placeholder: "Регистрация обращения" },
          { kind: "textarea", path: "description", label: "Описание требования", rows: 3 },
          {
            kind: "radio",
            path: "priority",
            label: "Приоритет",
            options: [
              { value: "must", label: "Обязательное" },
              { value: "should", label: "Желательное" },
            ],
          },
          {
            kind: "textarea",
            path: "acceptance",
            label: "Критерий приёмки",
            rows: 2,
            hint: "Как проверяющий убедится, что требование выполнено.",
            placeholder:
              "Обращение регистрируется с присвоением номера, запись видна в журнале в течение 1 секунды.",
          },
        ],
      },
    ],
  },

  {
    id: "support",
    section: "Раздел 4.3",
    title: "Требования к видам обеспечения",
    fields: [
      { kind: "textarea", path: "support.information", label: "Информационное обеспечение", rows: 3 },
      {
        kind: "textarea",
        path: "support.software",
        label: "Программное обеспечение",
        rows: 3,
        hint: "Без наименований производителей: описывайте характеристики, а не продукт.",
      },
      { kind: "textarea", path: "support.hardware", label: "Техническое обеспечение", rows: 3 },
      { kind: "textarea", path: "support.linguistic", label: "Лингвистическое обеспечение", rows: 2 },
      { kind: "textarea", path: "support.organizational", label: "Организационное обеспечение", rows: 2 },
    ],
  },

  {
    id: "works",
    section: "Раздел 5",
    title: "Состав и содержание работ",
    intro: "Этапы предзаполняются по типу предмета закупки и правятся вручную.",
    fields: [
      {
        kind: "list",
        path: "works.stages",
        label: "Этапы работ",
        addLabel: "Добавить этап",
        titlePath: "name",
        template: () => ({ id: "", code: "", name: "", deliverables: "", durationDays: 30 }),
        item: [
          { kind: "text", path: "name", label: "Наименование этапа" },
          { kind: "textarea", path: "deliverables", label: "Результат этапа", rows: 2 },
          { kind: "number", path: "durationDays", label: "Длительность", min: 1, suffix: "кал. дней" },
        ],
      },
      {
        kind: "checkbox",
        path: "works.sourceCodeTransfer",
        label: "Исходный код передаётся заказчику",
        hint: "Типовой пробел в ТЗ госорганов: без этого условия орган не может сопровождать систему сам.",
      },
      {
        kind: "checkbox",
        path: "works.exclusiveRightsTransfer",
        label: "Исключительные права передаются заказчику",
      },
      { kind: "number", path: "works.warrantyMonths", label: "Гарантийный срок", min: 0, suffix: "мес." },
    ],
  },

  {
    id: "acceptance",
    section: "Раздел 6",
    title: "Порядок контроля и приёмки",
    intro: "Таблица соответствия требований и критериев приёмки строится автоматически из раздела 4.2.",
    fields: [
      { kind: "multicheck", path: "acceptance.testTypes", label: "Виды испытаний", options: TEST_TYPES },
      {
        kind: "textarea",
        path: "acceptance.order",
        label: "Порядок приёмки",
        rows: 3,
        placeholder:
          "Приёмка проводится комиссией заказчика в течение 10 рабочих дней с даты уведомления исполнителя.",
      },
    ],
  },

  {
    id: "preparation",
    section: "Раздел 7",
    title: "Подготовка объекта к вводу в действие",
    fields: [
      { kind: "textarea", path: "preparation.training", label: "Обучение пользователей", rows: 3 },
      { kind: "textarea", path: "preparation.migration", label: "Перенос существующих данных", rows: 3 },
      { kind: "textarea", path: "preparation.orgChanges", label: "Организационные изменения", rows: 2 },
    ],
  },
];

/** Шаги, видимые при текущем состоянии модели. */
export function visibleSteps(model: TzModel): Step[] {
  return STEPS.filter((s) => !s.showIf || s.showIf(model));
}

/** Поля шага, видимые при текущем состоянии модели. */
export function visibleFields(step: Step, model: TzModel): Field[] {
  return step.fields.filter((f) => !f.showIf || f.showIf(model));
}
