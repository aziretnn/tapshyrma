"use client";

import { useMemo, useState, useTransition } from "react";
import type { TzModel } from "@/lib/tz/model";
import { visibleSteps, visibleFields } from "@/lib/questionnaire/steps";
import { setAtPath, newId } from "@/lib/tz/path";
import { completeness, defaultStages } from "@/lib/tz/derive";
import { audit, pruneJustifications } from "@/lib/rules/engine";
import FieldView from "@/components/Field";
import Findings from "@/components/Findings";
import Preview from "@/components/Preview";

/**
 * Мастер-анкета, аудит и живой документ на одном экране.
 *
 * Состояние модели держится здесь, на клиенте; на сервер уходит целиком при
 * сохранении — новая версия документа со снимком. Автосохранения намеренно нет:
 * версия документа должна создаваться осознанно, иначе история версий
 * превращается в шум и теряет смысл для аудита.
 *
 * Аудит пересчитывается на каждый ввод: движок правил синхронный и чистый,
 * поэтому замечание исчезает ровно тогда, когда пользователь его устранил.
 */

export type SaveResult = { ok: true; version: number } | { ok: false; error: string };

type Props = {
  initialModel: TzModel;
  currentVersion: number;
  save: (model: TzModel) => Promise<SaveResult>;
};

export default function Wizard({ initialModel, currentVersion, save }: Props) {
  const [model, setModel] = useState<TzModel>(initialModel);
  const [stepIdx, setStepIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(currentVersion);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const steps = useMemo(() => visibleSteps(model), [model]);
  // Ветвление может скрыть текущий шаг — тогда откатываемся к последнему видимому.
  const safeIdx = Math.min(stepIdx, steps.length - 1);
  const step = steps[safeIdx];

  const fields = useMemo(() => visibleFields(step, model), [step, model]);
  const progress = useMemo(() => completeness(model), [model]);
  const result = useMemo(() => audit(model, model.compliance.justifications), [model]);

  function onChange(path: string, value: unknown) {
    setModel((prev) => {
      let next = setAtPath(prev, path, value);

      // Смена типа предмета закупки предлагает соответствующие этапы работ,
      // но только если пользователь ещё ничего не вводил сам.
      if (path === "systemKind" && prev.works.stages.length === 0) {
        const stages = defaultStages(value as TzModel["systemKind"]).map((s) => ({
          ...s,
          id: newId(),
        }));
        next = setAtPath(next, "works.stages", stages);
      }

      return next;
    });
    setDirty(true);
    setError(null);
  }

  /**
   * Обоснования записываются отдельным обработчиком, а не через setAtPath:
   * ключ замечания содержит точки и двоеточия, и разбор его как пути по модели
   * создал бы вложенные объекты вместо одной записи в словаре.
   */
  function onJustify(key: string, text: string) {
    setModel((prev) => ({
      ...prev,
      compliance: {
        ...prev.compliance,
        justifications: { ...prev.compliance.justifications, [key]: text },
      },
    }));
    setDirty(true);
  }

  function goToStep(stepId: string) {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx >= 0) setStepIdx(idx);
  }

  function onSave() {
    // Обоснования к исчезнувшим замечаниям в снимок не попадают.
    const cleaned: TzModel = {
      ...model,
      compliance: {
        ...model.compliance,
        justifications: pruneJustifications(model.compliance.justifications, result.findings),
      },
    };

    startTransition(async () => {
      const saved = await save(cleaned);
      if (saved.ok) {
        setModel(cleaned);
        setVersion(saved.version);
        setDirty(false);
      } else {
        setError(saved.error);
      }
    });
  }

  return (
    <div className="editor">
      <section>
        <div className="savebar">
          <span>
            Версия {version}
            {dirty ? " · есть несохранённые изменения" : " · сохранено"}
          </span>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${Math.round((progress.filled / progress.total) * 100)}%` }} />
          </div>
          <span>
            заполнено {progress.filled} из {progress.total}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={pending || !dirty}
          >
            {pending ? "Сохранение…" : "Сохранить версию"}
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <Findings
          result={result}
          justifications={model.compliance.justifications}
          onJustify={onJustify}
          onGoToStep={goToStep}
        />

        <nav className="steps" aria-label="Разделы технического задания">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="step-tab"
              aria-current={i === safeIdx}
              onClick={() => setStepIdx(i)}
            >
              {s.section} · {s.title}
            </button>
          ))}
        </nav>

        <p className="eyebrow">{step.section}</p>
        <h2>{step.title}</h2>
        {step.intro ? <p className="lede">{step.intro}</p> : null}

        {fields.map((f) => (
          <FieldView key={f.path} field={f} model={model} onChange={onChange} />
        ))}

        <div className="step-nav">
          <button
            type="button"
            className="btn"
            onClick={() => setStepIdx(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
          >
            ← Назад
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setStepIdx(Math.min(steps.length - 1, safeIdx + 1))}
            disabled={safeIdx === steps.length - 1}
          >
            Далее →
          </button>
        </div>
      </section>

      <Preview model={model} />
    </div>
  );
}
