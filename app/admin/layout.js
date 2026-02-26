"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/ubicaciones", label: "Ubicaciones", icon: "📍" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/alquileres", label: "Alquileres", icon: "📄" },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "📈" },
  { href: "/admin/campanas", label: "Campañas", icon: "📢" },
  { href: "/admin/ia", label: "Asistente IA", icon: "🤖" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [checkDone, setCheckDone] = useState(false);

  useEffect(() => {
    setEmail(sessionStorage.getItem("userEmail"));
    setCheckDone(true);
  }, []);

  useEffect(() => {
    if (checkDone && !email) router.replace("/");
  }, [checkDone, email, router]);

  function logout() {
    sessionStorage.removeItem("userEmail");
    router.replace("/");
  }

  if (!checkDone || !email) return null;

  return (
    <div className="flex min-h-screen bg-stone-100 text-stone-900">
      <aside className="w-64 flex-shrink-0 bg-stone-800 text-white flex flex-col border-r border-white/10">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-bold text-stone-100">Plot Center</h2>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === item.href ? "bg-orange-600 text-white" : "hover:bg-white/10"
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-stone-400 truncate mb-2">{email}</p>
          <button
            onClick={logout}
            className="w-full py-2 text-sm font-medium bg-red-600/90 hover:bg-red-600 rounded-xl"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 overflow-auto bg-stone-100">{children}</main>
    </div>
  );
}
