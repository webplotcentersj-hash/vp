"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

const statusLabels = { draft: "Borrador", active: "Activa", paused: "Pausada", completed: "Completada" };
const statusClass = {
  draft: "bg-stone-100 text-stone-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiCall("dashboard-stats")
      .then((res) => setStats(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-black">Cargando...</div>;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;

  const s = stats?.data || {};
  const campaigns = s.campaigns || {};
  const metrics = s.metrics || {};
  const links = s.links || {};
  const topCampaigns = s.top_campaigns || [];
  const statusDistribution = s.status_distribution || [];
  const trend30 = s.trend_30_days || [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-black">Dashboard – Campañas</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Campañas activas" value={campaigns.active_campaigns ?? 0} sub={`de ${campaigns.total_campaigns ?? 0} totales`} />
        <Card title="Total clicks" value={Number(metrics.total_clicks || 0).toLocaleString()} sub={`CTR: ${Number(metrics.global_ctr || 0).toFixed(2)}%`} />
        <Card title="Conversiones" value={Number(metrics.total_conversions || 0).toLocaleString()} sub={`Tasa: ${Number(metrics.global_conversion_rate || 0).toFixed(2)}%`} />
        <Card title="Links activos" value={links.active_links ?? 0} sub={`de ${links.total_links ?? 0} links`} />
      </div>

      {statusDistribution.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <h2 className="text-lg font-bold text-black mb-3">Campañas por estado</h2>
          <div className="flex flex-wrap gap-3">
            {statusDistribution.map((row) => (
              <span key={row.status} className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusClass[row.status] || "bg-stone-100"}`}>
                {statusLabels[row.status] || row.status}: {row.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {trend30.length > 0 && (() => {
        const maxClicks = Math.max(1, ...trend30.map((x) => Number(x.clicks || 0)));
        return (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <h2 className="text-lg font-bold text-black p-4 border-b">Clicks por día (últimos 30 días)</h2>
            <div className="p-4 overflow-x-auto">
              <div className="flex items-end gap-1 min-w-max" style={{ height: 130 }}>
                {trend30.map((d, i) => (
                  <div key={d.date || i} className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                    <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                      <div className="w-full bg-orange-500 rounded-t" style={{ height: `${Math.max(6, (Number(d.clicks || 0) / maxClicks) * 100)}%`, minHeight: 4 }} title={`${d.date}: ${d.clicks || 0}`} />
                    </div>
                    <span className="text-[10px] text-black mt-1">{d.date ? new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <h2 className="text-lg font-bold text-black p-4 border-b">Campañas (por clicks)</h2>
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-black text-sm uppercase">
            <tr>
              <th className="p-3">Campaña</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Clicks</th>
              <th className="p-3 text-right">Conversiones</th>
              <th className="p-3 text-right">Ubicaciones</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {topCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-black">
                  No hay campañas. <Link href="/admin/campanas/nueva" className="text-orange-600 hover:underline">Crear una</Link>.
                </td>
              </tr>
            ) : (
              topCampaigns.map((c) => (
                <tr key={c.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium text-black">{c.name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass[c.status] || "bg-stone-100"}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold text-orange-600">{c.real_clicks ?? 0}</td>
                  <td className="p-3 text-right text-black">{c.total_conversions ?? 0}</td>
                  <td className="p-3 text-right text-black">{c.num_locations ?? 0}</td>
                  <td className="p-3">
                    <Link href={`/admin/campanas/${c.id}`} className="text-orange-600 hover:underline text-sm">Ver</Link>
                    {" · "}
                    <Link href={`/admin/campanas/${c.id}/metricas`} className="text-orange-600 hover:underline text-sm">Métricas</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
      <p className="text-black text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-black mt-1">{value}</p>
      {sub != null && sub !== "" && <p className="text-xs text-black mt-1">{sub}</p>}
    </div>
  );
}
