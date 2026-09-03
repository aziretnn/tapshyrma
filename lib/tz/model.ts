import { z } from "zod";

/**
 * Модель технического задания.
 *
 * Это машиночитаемое представление документа, а не его текст. Текст ГОСТ-документа
 * всегда выводится из модели (см. components/Preview.tsx), никогда наоборот.
 * Версия документа хранит снимок именно этой структуры — см. db/schema.ts.
 */

export const SYSTEM_KINDS = {
  new_as: "Создание новой автоматизированной системы",
  develop_as: "Развитие (модернизация) существующей системы",
  software: "Разработка программного изделия без создания АС",
} as const;
export type SystemKind = keyof typeof SYSTEM_KINDS;

export const PRIORITIES = {
  must: "Обязательное",
  should: "Желательное",
} as const;
export type Priority = keyof typeof PRIORITIES;

/** Цель создания системы с измеримым показателем (раздел 2). */
export const zGoal = z.object({
  id: z.string(),
  statement: z.string().default(""),
  /** Показатель, по которому цель считается достигнутой. Без него цель — декларация. */
  indicator: z.string().default(""),
});
export type Goal = z.infer<typeof zGoal>;

/** Группа пользователей объекта автоматизации (раздел 3). */
export const zUserGroup = z.object({
  id: z.string(),
  name: z.string().default(""),
  headcount: z.number().int().nonnegative().default(0),
  duties: z.string().default(""),
});
export type UserGroup = z.infer<typeof zUserGroup>;

/**
 * Функциональное требование (раздел 4.2).
 * Критерий приёмки обязателен по правилу R-05: требование, которое нельзя
 * проверить, невозможно защитить на приёмке.
 */
export const zFunctionalRequirement = z.object({
  id: z.string(),
  /** Человекочитаемый код вида ФТ-01 — на него ссылается раздел 6. */
  code: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  priority: z.enum(["must", "should"]).default("must"),
  acceptance: z.string().default(""),
});
export type FunctionalRequirement = z.infer<typeof zFunctionalRequirement>;

/** Этап работ (раздел 5). */
export const zStage = z.object({
  id: z.string(),
  code: z.string().default(""),
  name: z.string().default(""),
  deliverables: z.string().default(""),
  durationDays: z.number().int().positive().default(30),
});
export type Stage = z.infer<typeof zStage>;

/** Документ, передаваемый заказчику (раздел 8). */
export const zDocItem = z.object({
  id: z.string(),
  name: z.string().default(""),
  standard: z.string().default(""),
});
export type DocItem = z.infer<typeof zDocItem>;

/** Ссылка на НПА (раздел 9). Заполняется только из справочника lib/reference/legal-acts.ts. */
export const zLegalRef = z.object({
  actId: z.string(),
  citation: z.string(),
  reason: z.string().default(""),
});
export type LegalRef = z.infer<typeof zLegalRef>;

export const zTzModel = z.object({
  /** Версия схемы модели. Растёт при несовместимых изменениях — старые снимки читаются миграцией. */
  schemaVersion: z.literal(1).default(1),

  meta: z.object({
    title: z.string().default(""),
    okgzCode: z.string().default(""),
    /** Основание для проведения работ: решение, план закупок, поручение. */
    basis: z.string().default(""),
    financing: z.string().default(""),
    startDate: z.string().default(""),
    customerName: z.string().default(""),
    customerShortName: z.string().default(""),
    customerAddress: z.string().default(""),
    headName: z.string().default(""),
    headPosition: z.string().default(""),
  }).default({}),

  systemKind: z.enum(["new_as", "develop_as", "software"]).default("new_as"),

  /**
   * Признаки, которые открывают обязательные блоки требований и ветки анкеты.
   * На них же завязаны правила движка проверок (этап 7–8 плана).
   */
  flags: z.object({
    isStateIS: z.boolean().default(true),
    processesPersonalData: z.boolean().default(false),
    needsTunduk: z.boolean().default(false),
    publicFacing: z.boolean().default(false),
  }).default({}),

  /**
   * Обработка персональных данных. Заполняется, только если поднят флаг
   * flags.processesPersonalData; иначе блок в документ не выводится.
   */
  pdn: z.object({
    categories: z.array(z.string()).default([]),
    subjectsCount: z.string().default(""),
    crossBorder: z.boolean().default(false),
    basis: z.string().default(""),
  }).default({}),

  /** Раздел 2. Назначение и цели создания системы. */
  purpose: z.object({
    problem: z.string().default(""),
    purposeText: z.string().default(""),
    goals: z.array(zGoal).default([]),
  }).default({}),

  /** Раздел 3. Характеристика объектов автоматизации. */
  object: z.object({
    processes: z.string().default(""),
    userGroups: z.array(zUserGroup).default([]),
    volumes: z.string().default(""),
    existingSystems: z.string().default(""),
  }).default({}),

  /** Раздел 4.1. Требования к системе в целом. */
  whole: z.object({
    availabilityPercent: z.number().default(99.0),
    concurrentUsers: z.number().int().nonnegative().default(50),
    responseTimeMs: z.number().int().positive().default(3000),
    retentionYears: z.number().int().positive().default(5),
    /** Языки интерфейса. Кыргызский и русский — по требованию R-10. */
    languages: z.array(z.string()).default(["ky", "ru"]),
    authMethod: z.string().default(""),
    integrations: z.string().default(""),
    securityMeasures: z.array(z.string()).default([]),
  }).default({}),

  /** Раздел 4.2. Требования к функциям. */
  functions: z.array(zFunctionalRequirement).default([]),

  /** Раздел 4.3. Требования к видам обеспечения. */
  support: z.object({
    information: z.string().default(""),
    software: z.string().default(""),
    hardware: z.string().default(""),
    linguistic: z.string().default(""),
    organizational: z.string().default(""),
  }).default({}),

  /** Раздел 5. Состав и содержание работ. */
  works: z.object({
    stages: z.array(zStage).default([]),
    sourceCodeTransfer: z.boolean().default(true),
    exclusiveRightsTransfer: z.boolean().default(true),
    warrantyMonths: z.number().int().nonnegative().default(12),
  }).default({}),

  /** Раздел 6. Порядок контроля и приёмки. */
  acceptance: z.object({
    order: z.string().default(""),
    testTypes: z.array(z.string()).default([]),
  }).default({}),

  /** Раздел 7. Подготовка объекта автоматизации к вводу в действие. */
  preparation: z.object({
    training: z.string().default(""),
    migration: z.string().default(""),
    orgChanges: z.string().default(""),
  }).default({}),

  /** Раздел 8. Требования к документированию. */
  documentation: z.array(zDocItem).default([]),

  /** Раздел 9. Источники разработки. Собирается автоматически, вручную не правится. */
  sources: z.array(zLegalRef).default([]),

  /**
   * Обоснования предупреждений движка проверок: ключ замечания → текст.
   *
   * Хранится внутри документа, а не отдельной таблицей: обоснование — это
   * решение составителя, и оно должно попадать в снимок версии вместе со всем
   * остальным. Иначе при разборе спорного ТЗ будет видно требование, но не
   * будет видно, чем составитель объяснил замечание к нему.
   */
  compliance: z.object({
    justifications: z.record(z.string(), z.string()).default({}),
  }).default({}),
});

export type TzModel = z.infer<typeof zTzModel>;

/** Пустая модель со всеми умолчаниями. Единственный способ создать новый документ. */
export function emptyModel(): TzModel {
  return zTzModel.parse({});
}

/**
 * Разбирает снимок из БД. Снимок мог быть записан более старой версией кода,
 * поэтому недостающие поля добираются умолчаниями, а не роняют страницу.
 */
export function parseModel(raw: unknown): TzModel {
  const result = zTzModel.safeParse(raw);
  return result.success ? result.data : emptyModel();
}
