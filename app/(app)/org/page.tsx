import { requireUser } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  initiator: "Инициатор",
  drafter: "Составитель ТЗ",
  lawyer: "Юрист",
  secretary: "Секретарь конкурсной комиссии",
  head: "Руководитель",
};

/**
 * Карточка организации. Её реквизиты подставляются в раздел 1 и в гриф
 * утверждения каждого документа, поэтому заполняются один раз на орган,
 * а не в каждом ТЗ заново.
 */
export default async function OrgPage() {
  const user = await requireUser();
  const org = user.org;

  const rows: [string, string][] = [
    ["Полное наименование", org.name],
    ["Сокращённое наименование", org.shortName || "—"],
    ["Адрес", org.address || "—"],
    ["Руководитель", org.headName || "—"],
    ["Должность руководителя", org.headPosition || "—"],
  ];

  return (
    <main className="page">
      <p className="eyebrow">Организация</p>
      <h1>{org.name}</h1>
      <p className="lede">
        Эти реквизиты подставляются в гриф утверждения и раздел 1 каждого технического задания
        органа.
      </p>

      <div className="rows">
        {rows.map(([label, value]) => (
          <div className="row" key={label}>
            <span className="row-meta" style={{ marginTop: 0 }}>
              {label}
            </span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2.5rem" }}>Ваша учётная запись</h2>
      <div className="rows">
        <div className="row">
          <span className="row-meta" style={{ marginTop: 0 }}>
            Пользователь
          </span>
          <span>
            {user.fullName || "—"}
            {user.position ? `, ${user.position}` : ""}
          </span>
        </div>
        <div className="row">
          <span className="row-meta" style={{ marginTop: 0 }}>
            Роль в маршруте согласования
          </span>
          <span>{ROLE_LABEL[user.role] ?? user.role}</span>
        </div>
        <div className="row">
          <span className="row-meta" style={{ marginTop: 0 }}>
            Почта
          </span>
          <span>{user.email}</span>
        </div>
      </div>

      <p className="note">
        Редактирование карточки и управление пользователями появляются вместе с маршрутом
        согласования на этапе 11 плана. Роли уже заведены в схеме базы, но пока ни на что не влияют.
      </p>
    </main>
  );
}
