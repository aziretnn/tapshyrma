/**
 * Чтение и запись по строковому пути внутри модели ТЗ ("purpose.goals", "meta.title").
 * Анкета описана декларативно (lib/questionnaire/steps.ts), поэтому поле знает
 * не свойство объекта, а путь до него.
 */

export function getAtPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Возвращает новый объект — исходный не мутируется, чтобы React увидел изменение. */
export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: unknown = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) };

  let cursor = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    cursor[key] = Array.isArray(next) ? [...next] : { ...(next as object) };
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;

  return clone as T;
}

/**
 * Идентификатор элемента повторяемого списка.
 *
 * crypto.randomUUID существует только в защищённом контексте: по адресу
 * http://localhost он есть, а по адресу вида http://10.0.0.187:3000 — нет,
 * и вызов падает с TypeError. Для пользователя это выглядит как кнопка
 * «Добавить», которая молча ничего не делает. Поэтому две ступени запаса.
 */
export function newId(): string {
  const c: Crypto | undefined = globalThis.crypto;

  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  // getRandomValues доступен и вне защищённого контекста — собираем UUID v4 сами.
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Совсем древний браузер: идентификатор нужен только для ключа React
  // и связи полей внутри документа, криптостойкость здесь не требуется.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
