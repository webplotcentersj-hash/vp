"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function EstadisticasPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-black">Cargando...</div>;
  const s = stats || {};

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-black">Estadísticas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-stone-200 text-center">
          <p className="text-black text-sm font-medium">Tasa de ocupación</p>
          <p className="text-4xl font-bold text-black mt-2">{s.occupancy_rate ?? 0}%</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200 text-center">
          <p className="text-black text-sm font-medium">Cliente más valioso</p>
          <p className="text-2xl font-bold text-black mt-2">{s.top_client?.name ?? "N/A"}</p>
          <p className="text-sm text-black">{s.top_client?.rental_count ?? 0} alquileres</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200 text-center">
          <p className="text-black text-sm font-medium">Estado de ubicaciones</p>
          <p className="text-black mt-2">Alquiladas: <strong>{s.locations_status?.rented ?? 0}</strong></p>
          <p className="text-black">Disponibles: <strong>{s.locations_status?.available ?? 0}</strong></p>
        </div>
      </div>
      {Array.isArray(s.monthly_revenue) && s.monthly_revenue.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <h2 className="text-lg font-bold text-black mb-4">Ingresos mensuales (últimos 12 meses)</h2>
          <ul className="space-y-2">
            {s.monthly_revenue.map((m, i) => (
              <li key={i} className="flex justify-between">
                <span>{m.month}</span>
                <span className="font-medium">${(m.revenue || 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
