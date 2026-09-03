"use client";

import type { AuditResult, Finding } from "@/lib/rules/types";
import { actById } from "@/lib/reference/legal-acts";

/**
 * Результат аудита документа.
 *
 * Панель стоит над анкетой и видна сразу: замечания — это то, ради чего
 * продукт существует, а не сноска под формой. Блокирующее замечание нельзя
 * обосновать, только устранить; предупреждение требует текста обоснования,
 * который сохраняется в самом документе.
 */

type Props = {
  result: AuditResult;
  justifications: Record<string, string>;
  onJustify: (key: string, text: string) => void;
  onGoToStep: (stepId: string) => void;
};

function FindingRow({
  finding,
  justification,
  onJustify,
  onGoToStep,
}: {
  finding: Finding;
  justification: string;
  onJustify: (key: string, text: string) => void;
  onGoToStep: (stepId: string) => void;
}) {
  const act = finding.actId ? actById(finding.actId) : undefined;
  const isWarning = finding.severity === "warning";

  return (
    <li className={`finding finding-${finding.severity}`}>
      <div className="finding-head">
        <span className="finding-id">{finding.ruleId}</span>
        <span className="finding-title">{finding.title}</span>
        {finding.stepId ? (
          <button
            type="button"
            className="btn btn-quiet finding-goto"
            onClick={() => onGoToStep(finding.stepId!)}
          >
            Перейти
          </button>
        ) : null}
      </div>

      <p className="finding-detail">{finding.detail}</p>

      {act ? <p className="finding-act">{act.citation}</p> : null}

      {isWarning ? (
        <div className="just">
          <label htmlFor={`just-${finding.key}`}>
            Обоснование {justification.trim() ? "" : "— требуется"}
          </label>
          <textarea
            id={`just-${finding.key}`}
            rows={2}
            value={justification}
            placeholder="Почему требование остаётся в этой формулировке"
            onChange={(e) => onJustify(finding.key, e.target.value)}
          />
        </div>
      ) : null}
    </li>
  );
}

export default function Findings({ result, justifications, onJustify, onGoToStep }: Props) {
  const { findings, blocking, unjustified, pending, canApprove } = result;

  return (
    <section className="audit" aria-label="Результат проверки документа">
      <div className={`audit-sum ${canApprove ? "audit-ok" : ""}`}>
        {findings.length === 0 ? (
          <strong>Замечаний нет</strong>
        ) : (
          <strong>
            {blocking.length > 0 ? `Блокирующих: ${blocking.length}` : "Блокирующих нет"}
            {" · "}
            предупреждений: {findings.length - blocking.length}
            {unjustified.length > 0 ? ` (без обоснования: ${unjustified.length})` : ""}
          </strong>
        )}
        <span className="audit-verdict">
          {canApprove
            ? "Документ может быть передан на утверждение"
            : "Документ не может быть утверждён"}
        </span>
      </div>

      {findings.length > 0 ? (
        <ul className="findings">
          {findings.map((f) => (
            <FindingRow
              key={f.key}
              finding={f}
              justification={justifications[f.key] ?? ""}
              onJustify={onJustify}
              onGoToStep={onGoToStep}
            />
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <details className="audit-pending">
          <summary>Проверки, которые пока не выполняются ({pending.length})</summary>
          <ul>
            {pending.map((r) => (
              <li key={r.id}>
                <span className="finding-id">{r.id}</span> {r.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
