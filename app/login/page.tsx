"use client";

import { useActionState } from "react";
import { login } from "./actions";

/**
 * Вход. Учётные записи заводит администратор органа — самостоятельной
 * регистрации нет и не планируется: пользователь всегда принадлежит организации.
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="page" style={{ maxWidth: "26rem", paddingTop: "5rem" }}>
      <p className="eyebrow">Тапшырма</p>
      <h1>Вход в систему</h1>
      <p className="lede">
        Конструктор технических заданий на информационные системы для государственных органов.
      </p>

      <form action={formAction}>
        {state?.error ? <div className="error">{state.error}</div> : null}

        <div className="field">
          <label htmlFor="email">Служебная почта</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Проверка…" : "Войти"}
        </button>
      </form>

      <p className="note">
        Учётную запись заводит администратор органа. Для проверки развёрнутого стенда используйте
        учётную запись из сида: <code>drafter@example.kg</code> / <code>tapshyrma</code>.
      </p>
    </main>
  );
}
