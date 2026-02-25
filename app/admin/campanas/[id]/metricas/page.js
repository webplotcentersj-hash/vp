"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api";

export default function MetricasCampanaPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall(`metrics?campaign_id=${params.id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="py-12 text-stone-500">Cargando...</div>;

  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      <Link href={`/admin/campanas/${params.id}`} className="text-orange-600 hover:underline">← Volver a campaña</Link>
      <h1 className="text-2xl font-bold text-stone-800">Métricas de campaña</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <p className="text-stone-500 text-sm">Impresiones</p>
          <p className="text-2xl font-bold">{(totals.total_impressions || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <p className="text-stone-500 text-sm">Clicks</p>
          <p className="text-2xl font-bold">{(totals.total_clicks || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <p className="text-stone-500 text-sm">Conversiones</p>
          <p className="text-2xl font-bold">{(totals.total_conversions || 0).toLocaleString()}</p>
        </div>
      </div>
      {data?.links?.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b">Links trackables</h2>
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 text-sm">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">Conversiones</th>
              </tr>
            </thead>
            <tbody>
              {data.links.map((l) => (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="p-3">{l.name}</td>
                  <td className="p-3">{l.clicks ?? 0}</td>
                  <td className="p-3">{l.conversions ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
