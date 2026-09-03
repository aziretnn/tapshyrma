import type { TzModel } from "@/lib/tz/model";
import type { AuditResult, Finding } from "@/lib/rules/types";
import { derive } from "@/lib/tz/derive";
import { RULES } from "@/lib/rules/rules";

/**
 * Стадия 05 конвейера: прогон документа через реестр правил.
 *
 * Функция чистая и синхронная — она вызывается на каждый ввод в мастере,
 * поэтому не ходит в сеть и не обращается к базе. Всё, что ей нужно,
 * уже лежит в модели и справочниках.
 */

const SEVERITY_ORDER = { blocking: 0, warning: 1 } as const;

export function audit(model: TzModel, justifications: Record<string, string> = {}): AuditResult {
  const ctx = { model, derived: derive(model) };

  const findings: Finding[] = RULES.filter((r) => r.implemented && r.check).flatMap((r) =>
    r.check!(ctx),
  );

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.ruleId.localeCompare(b.ruleId);
  });

  const blocking = findings.filter((f) => f.severity === "blocking");
  const unjustified = findings.filter(
    (f) => f.severity === "warning" && !(justifications[f.key] ?? "").trim(),
  );

  return {
    findings,
    blocking,
    unjustified,
    pending: RULES.filter((r) => !r.implemented),
    // Блокирующее замечание обосновать нельзя — только устранить.
    canApprove: blocking.length === 0 && unjustified.length === 0,
  };
}

/**
 * Обоснования, потерявшие своё замечание, — например, требование удалили
 * или формулировку исправили. Их нужно убирать при сохранении, иначе документ
 * копит обоснования к несуществующим замечаниям.
 */
export function pruneJustifications(
  justifications: Record<string, string>,
  findings: Finding[],
): Record<string, string> {
  const live = new Set(findings.map((f) => f.key));
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(justifications)) {
    if (live.has(key)) kept[key] = value;
  }
  return kept;
}
