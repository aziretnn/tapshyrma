import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

/**
 * Оболочка авторизованной части. Всё, что лежит в группе (app), требует входа —
 * проверка здесь одна на все страницы группы.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="appbar">
        <Link href="/documents" className="brand">
          Тапшырма<span>.</span>
        </Link>
        <nav>
          <Link href="/documents">Документы</Link>
          <Link href="/org">Организация</Link>
          <form action={logout}>
            <button type="submit" className="btn btn-quiet">
              Выйти
            </button>
          </form>
        </nav>
        <div className="who">
          {user.fullName || user.email} · {user.org.shortName || user.org.name}
        </div>
      </header>
      {children}
    </>
  );
}
