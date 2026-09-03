"use client";

import type { Field } from "@/lib/questionnaire/steps";
import type { TzModel } from "@/lib/tz/model";
import { getAtPath, newId } from "@/lib/tz/path";

/**
 * Рендер одного поля анкеты по его декларативному описанию.
 *
 * Поле не знает, где в модели лежит его значение, — знает только путь.
 * Благодаря этому добавление вопроса в lib/questionnaire/steps.ts не требует
 * никаких правок в интерфейсе.
 */

type Props = {
  field: Field;
  model: TzModel;
  /** Префикс пути для полей внутри элемента списка, например "functions.0". */
  base?: string;
  onChange: (path: string, value: unknown) => void;
};

function fullPath(base: string | undefined, path: string): string {
  return base ? `${base}.${path}` : path;
}

export default function FieldView({ field, model, base, onChange }: Props) {
  const path = fullPath(base, field.path);
  const raw = getAtPath(model, path);

  const label = (
    <span className="field-label">{field.label}</span>
  );
  const hint = field.hint ? <span className="field-hint">{field.hint}</span> : null;

  switch (field.kind) {
    case "text":
    case "date":
      return (
        <div className="field">
          <label htmlFor={path}>{field.label}</label>
          {hint}
          <input
            id={path}
            type={field.kind === "date" ? "date" : "text"}
            value={typeof raw === "string" ? raw : ""}
            placeholder={field.kind === "text" ? field.placeholder : undefined}
            onChange={(e) => onChange(path, e.target.value)}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="field">
          <label htmlFor={path}>{field.label}</label>
          {hint}
          <textarea
            id={path}
            rows={field.rows ?? 3}
            value={typeof raw === "string" ? raw : ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(path, e.target.value)}
          />
        </div>
      );

    case "number":
      return (
        <div className="field">
          <label htmlFor={path}>{field.label}</label>
          {hint}
          <div className="field-row">
            <input
              id={path}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={typeof raw === "number" ? raw : 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange(path, Number.isFinite(n) ? n : 0);
              }}
            />
            {field.suffix ? <span className="field-suffix">{field.suffix}</span> : null}
          </div>
        </div>
      );

    case "select":
      return (
        <div className="field">
          <label htmlFor={path}>{field.label}</label>
          {hint}
          <select
            id={path}
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => onChange(path, e.target.value)}
          >
            <option value="">— не выбрано —</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "radio":
      return (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 1.4rem" }}>
          <legend className="field-label" style={{ padding: 0 }}>
            {field.label}
          </legend>
          {hint}
          {field.options.map((o) => (
            <label key={o.value} className="opt-line">
              <input
                type="radio"
                name={path}
                checked={raw === o.value}
                onChange={() => onChange(path, o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      );

    case "checkbox":
      return (
        <div className="field">
          <label className="opt-line">
            <input
              type="checkbox"
              checked={raw === true}
              onChange={(e) => onChange(path, e.target.checked)}
            />
            <span>
              <span style={{ fontWeight: 600 }}>{field.label}</span>
              {field.hint ? (
                <>
                  <br />
                  <span className="field-hint">{field.hint}</span>
                </>
              ) : null}
            </span>
          </label>
        </div>
      );

    case "multicheck": {
      const selected = Array.isArray(raw) ? (raw as string[]) : [];
      return (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 1.4rem" }}>
          <legend className="field-label" style={{ padding: 0 }}>
            {field.label}
          </legend>
          {hint}
          {field.options.map((o) => (
            <label key={o.value} className="opt-line">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    path,
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((v) => v !== o.value),
                  )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }

    case "list": {
      const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];

      const add = () => onChange(path, [...items, { ...field.template(), id: newId() }]);
      const remove = (i: number) => onChange(path, items.filter((_, idx) => idx !== i));

      return (
        <div className="field">
          {label}
          {hint}

          {items.length === 0 ? (
            <p className="field-hint" style={{ margin: "0.4rem 0 0.8rem" }}>
              Пока ничего не добавлено.
            </p>
          ) : null}

          {items.map((item, i) => {
            const title = String(item[field.titlePath] ?? "").trim();
            return (
              <div className="item" key={String(item.id ?? i)}>
                <div className="item-head">
                  <span className="item-code">
                    {String(i + 1).padStart(2, "0")}
                    {title ? ` · ${title}` : ""}
                  </span>
                  <button type="button" className="btn btn-quiet" onClick={() => remove(i)}>
                    Удалить
                  </button>
                </div>
                {field.item.map((sub) => (
                  <FieldView
                    key={sub.path}
                    field={sub}
                    model={model}
                    base={`${path}.${i}`}
                    onChange={onChange}
                  />
                ))}
              </div>
            );
          })}

          <div>
            <button type="button" className="btn" onClick={add}>
              {field.addLabel}
            </button>
          </div>
        </div>
      );
    }
  }
}
