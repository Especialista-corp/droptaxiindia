import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";

const NAV = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/prestadores", label: "Prestadores" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/pedidos", label: "Pedidos" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[#E2E2E2] px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">MontaJá Admin</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-[#545454] hover:text-black">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm font-medium text-[#545454] hover:text-black">
            Sair
          </button>
        </form>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
