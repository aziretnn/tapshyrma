/**
 * Словари для текстовых правил.
 *
 * Наполняются из корпуса реальных ТЗ (неделя 1 плана). Пока — стартовый набор,
 * собранный по типовым формулировкам государственных ИТ-закупок. Список
 * заведомо неполный, поэтому правило R-01 никогда не считается достаточной
 * проверкой: оно ловит частые случаи, а не все.
 */

/**
 * Торговые марки, наименования производителей и продуктов.
 *
 * Ключ — то, что показывается в замечании; список — варианты написания
 * в нижнем регистре, включая латиницу и кириллицу.
 */
export const BRANDS: { name: string; forms: string[] }[] = [
  { name: "Microsoft", forms: ["microsoft", "майкрософт", "ms office", "мс офис"] },
  { name: "Windows", forms: ["windows", "виндовс"] },
  { name: "Microsoft Office", forms: ["ms word", "ms excel", "microsoft word", "microsoft excel"] },
  { name: "Oracle", forms: ["oracle", "оракл"] },
  { name: "1С", forms: ["1с", "1c:", "1с-битрикс"] },
  { name: "Битрикс", forms: ["битрикс", "bitrix"] },
  { name: "SAP", forms: ["sap "] },
  { name: "Cisco", forms: ["cisco", "циско"] },
  { name: "Kaspersky", forms: ["kaspersky", "касперск"] },
  { name: "Adobe", forms: ["adobe", "адоб"] },
  { name: "Intel", forms: ["intel", "интел"] },
  { name: "AMD", forms: ["amd "] },
  { name: "Dell", forms: ["dell"] },
  { name: "Hewlett-Packard", forms: ["hewlett", "hp proliant"] },
  { name: "IBM", forms: ["ibm"] },
  { name: "Apple", forms: ["apple", "macos", "ios "] },
  { name: "VMware", forms: ["vmware"] },
  { name: "Red Hat", forms: ["red hat", "redhat"] },
  { name: "Astra Linux", forms: ["astra linux", "астра линукс"] },
];

/** Оговорка, при которой указание марки допустимо. */
export const EQUIVALENT_MARKERS = ["или эквивалент", "либо эквивалент", "или аналог"];

/**
 * Неизмеримые формулировки. Требование, содержащее такое слово и не содержащее
 * ни одной цифры, невозможно проверить на приёмке.
 */
export const VAGUE_TERMS = [
  "современный",
  "современном",
  "удобный",
  "удобном",
  "дружественный",
  "интуитивно понятн",
  "качественн",
  "надёжн",
  "надежн",
  "оптимальн",
  "высокая производительность",
  "высокопроизводительн",
  "быстрый отклик",
  "в кратчайшие сроки",
  "минимально возможн",
  "достаточн",
  "при необходимости",
  "и тому подобное",
  "и т.п.",
  "и т.д.",
  "по согласованию с заказчиком",
  "по усмотрению исполнителя",
];

/**
 * Минимальный набор мер защиты для государственной информационной системы.
 * Коды — из lib/questionnaire/steps.ts (SECURITY_MEASURES).
 */
export const REQUIRED_SECURITY_FOR_GIS = ["rbac", "audit", "backup"];

/** Минимальный набор мер защиты, если система обрабатывает персональные данные. */
export const REQUIRED_SECURITY_FOR_PDN = ["tls", "at_rest"];

/** Языки, обязательные для интерфейса государственной информационной системы. */
export const REQUIRED_LANGUAGES = ["ky", "ru"];

export function containsBrand(text: string): { name: string; form: string } | null {
  const lower = text.toLowerCase();
  for (const brand of BRANDS) {
    for (const form of brand.forms) {
      if (lower.includes(form)) return { name: brand.name, form };
    }
  }
  return null;
}

export function hasEquivalentClause(text: string): boolean {
  const lower = text.toLowerCase();
  return EQUIVALENT_MARKERS.some((m) => lower.includes(m));
}

export function findVagueTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return VAGUE_TERMS.filter((t) => lower.includes(t));
}

/** Есть ли в тексте хоть одно число — грубый признак измеримости требования. */
export function hasNumber(text: string): boolean {
  return /\d/.test(text);
}
