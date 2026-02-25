"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [dash, adv] = await Promise.all([
          apiCall("dashboard").catch(() => ({})),
          apiCall("dashboard-stats").catch(() => ({})),
        ]);
        setData(dash);
        setStats(adv?.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="text-center py-12 text-stone-500">Cargando...</div>;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;

  const d = data || {};
  const s = stats || {};
  const campaigns = s.campaigns || {};
  const metrics = s.metrics || {};
  const links = s.links || {};

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-800">Dashboard</h1>

      {stats?.success && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Campañas activas" value={campaigns.active_campaigns ?? 0} sub={`de ${campaigns.total_campaigns ?? 0} totales`} />
          <Card title="Total clicks" value={Number(metrics.total_clicks || 0).toLocaleString()} sub={`CTR: ${Number(metrics.global_ctr || 0).toFixed(2)}%`} />
          <Card title="Conversiones" value={Number(metrics.total_conversions || 0).toLocaleString()} sub={`Tasa: ${Number(metrics.global_conversion_rate || 0).toFixed(2)}%`} />
          <Card title="Links activos" value={links.active_links ?? 0} sub={`de ${links.total_links ?? 0} links`} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card title="Total Chupetes" value={d.totalChupetes ?? 0} />
        <Card title="Chupetes activos" value={d.chupetesActivos ?? 0} />
        <Card title="Próximos a vencer" value={d.proximosAVencer ?? 0} />
        <Card title="Total clientes" value={d.totalClientes ?? 0} />
        <Card title="Total ubicaciones" value={d.totalUbicaciones ?? 0} />
      </div>

      {Array.isArray(d.vencimientosProximos) && d.vencimientosProximos.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <h2 className="text-lg font-bold text-stone-800 p-4 border-b">Vencimientos próximos</h2>
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 text-sm uppercase">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Ubicación</th>
                <th className="p-3">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {d.vencimientosProximos.map((v, i) => (
                <tr key={i} className="border-t border-stone-100">
                  <td className="p-3">{v.clientName}</td>
                  <td className="p-3">{v.locationAddress}</td>
                  <td className="p-3">{v.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, sub }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
      <p className="text-stone-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-stone-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}
