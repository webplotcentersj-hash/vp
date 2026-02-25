"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

export default function CampanasPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("campaigns")
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function remove(id) {
    if (!confirm("¿Eliminar esta campaña? Se perderán métricas asociadas.")) return;
    try {
      await apiCall(`campaigns?id=${id}`, "DELETE");
      setList((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const statusLabel = { draft: "Borrador", active: "Activa", paused: "Pausada", completed: "Completada" };
  const statusClass = { draft: "bg-stone-100 text-stone-800", active: "bg-green-100 text-green-800", paused: "bg-amber-100 text-amber-800", completed: "bg-blue-100 text-blue-800" };

  if (loading) return <div className="py-12 text-stone-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Campañas publicitarias</h1>
        <Link href="/admin/campanas/nueva" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
          Nueva campaña
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-500 text-white p-6 rounded-xl">Total: {list.length}</div>
        <div className="bg-green-500 text-white p-6 rounded-xl">Activas: {list.filter((c) => c.status === "active").length}</div>
        <div className="bg-violet-500 text-white p-6 rounded-xl">Impresiones: {list.reduce((s, c) => s + (Number(c.total_impressions) || 0), 0).toLocaleString()}</div>
        <div className="bg-orange-500 text-white p-6 rounded-xl">Conversiones: {list.reduce((s, c) => s + (Number(c.total_conversions) || 0), 0).toLocaleString()}</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-stone-500 text-sm uppercase">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Producto</th>
              <th className="p-3">Público</th>
              <th className="p-3 text-center">Ubicaciones</th>
              <th className="p-3 text-center">Clicks</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.product || "—"}</td>
                <td className="p-3">{c.audience || "—"}</td>
                <td className="p-3 text-center">{c.total_locations ?? 0}</td>
                <td className="p-3 text-center">{c.total_clicks ?? 0}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass[c.status] || statusClass.draft}`}>
                    {statusLabel[c.status] || c.status}
                  </span>
                </td>
                <td className="p-3">
                  <Link href={`/admin/campanas/${c.id}`} className="text-blue-600 hover:underline mr-2">Ver</Link>
                  <Link href={`/admin/campanas/${c.id}/editar`} className="text-orange-600 hover:underline mr-2">Editar</Link>
                  <Link href={`/admin/campanas/${c.id}/metricas`} className="text-violet-600 hover:underline mr-2">Métricas</Link>
                  <button onClick={() => remove(c.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
