"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api";
import QRChupete from "@/components/QRChupete";

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
  const daily = data?.daily || [];
  const links = data?.links || [];
  const events = data?.events || [];

  const maxDaily = Math.max(1, ...daily.map((d) => (d.impressions || 0) + (d.clicks || 0) + (d.conversions || 0)));
  const maxLinkClicks = Math.max(1, ...links.map((l) => l.clicks || 0));
  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const eventCounts = eventTypes.map((t) => ({ type: t, count: events.filter((e) => e.event_type === t).reduce((s, e) => s + (e.count || 0), 0) }));
  const maxEvents = Math.max(1, ...eventCounts.map((e) => e.count));

  const trackingUrl = (link) => (typeof window !== "undefined" && link.short_code ? `${window.location.origin}/api/track?c=${link.short_code}` : "");

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href={`/admin/campanas/${params.id}`} className="text-orange-600 hover:underline font-medium">← Volver a campaña</Link>
        <h1 className="text-2xl font-bold text-stone-800">Métricas de campaña</h1>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-stone-500 text-sm">Impresiones</p>
          <p className="text-2xl font-bold text-stone-800">{(totals.total_impressions || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-stone-500 text-sm">Clicks</p>
          <p className="text-2xl font-bold text-orange-600">{(totals.total_clicks || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-stone-500 text-sm">Conversiones</p>
          <p className="text-2xl font-bold text-green-600">{(totals.total_conversions || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <p className="text-stone-500 text-sm">CTR</p>
          <p className="text-2xl font-bold text-stone-800">{totals.ctr != null ? `${Number(totals.ctr).toFixed(1)}%` : "—"}</p>
        </div>
      </div>

      {/* Gráfico: evolución diaria (últimos 30 días) */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Evolución diaria (impresiones, clicks, conversiones)</h2>
          <div className="p-4 overflow-x-auto">
            <div className="flex items-end gap-1 min-w-max" style={{ height: 220 }}>
              {daily.slice(0, 30).reverse().map((d, i) => {
                const imp = (d.impressions || 0) / maxDaily * 100;
                const clk = (d.clicks || 0) / maxDaily * 100;
                const conv = (d.conversions || 0) / maxDaily * 100;
                return (
                  <div key={d.date || i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 28 }}>
                    <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: 180 }}>
                      <div className="w-full bg-amber-200 rounded-t min-h-[2px]" style={{ height: `${conv}%` }} title={`Conversiones: ${d.conversions || 0}`} />
                      <div className="w-full bg-orange-400 rounded-t min-h-[2px]" style={{ height: `${clk}%` }} title={`Clicks: ${d.clicks || 0}`} />
                      <div className="w-full bg-stone-300 rounded-t min-h-[2px]" style={{ height: `${imp}%` }} title={`Impresiones: ${d.impressions || 0}`} />
                    </div>
                    <span className="text-[10px] text-stone-400 truncate w-full text-center">{d.date ? new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-stone-300" /> Impresiones</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400" /> Clicks</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200" /> Conversiones</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico: clicks por link trackable */}
      {links.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Clicks por link trackable + QR</h2>
          <div className="p-4 space-y-6">
            {links.map((l) => (
              <div key={l.id} className="flex flex-wrap items-start gap-4 p-3 bg-stone-50 rounded-lg">
                {trackingUrl(l) && (
                  <div className="flex-shrink-0">
                    <QRChupete url={trackingUrl(l)} chupeteNumber={l.location_id ?? l.locationId} size={120} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-stone-700 truncate pr-2">{l.name}</span>
                    <span className="text-orange-600 font-semibold">{l.clicks ?? 0} clicks</span>
                  </div>
                  <div className="h-8 bg-stone-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg transition-all"
                      style={{ width: `${Math.min(100, ((l.clicks || 0) / maxLinkClicks) * 100)}%` }}
                    />
                  </div>
                  {trackingUrl(l) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input readOnly value={trackingUrl(l)} className="flex-1 min-w-0 text-xs px-2 py-1 border border-stone-200 rounded bg-white" />
                      <button type="button" onClick={() => navigator.clipboard.writeText(trackingUrl(l))} className="text-xs text-blue-600 hover:underline">Copiar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla links (por si prefieren ver tabla) */}
      {links.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b">Links trackables – detalle</h2>
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-stone-500 text-sm">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">URL destino</th>
                <th className="p-3 text-right">Clicks</th>
                <th className="p-3 text-right">Conversiones</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className="p-3 text-sm text-stone-600 truncate max-w-xs">{l.url}</td>
                  <td className="p-3 text-right font-semibold text-orange-600">{l.clicks ?? 0}</td>
                  <td className="p-3 text-right">{l.conversions ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico: eventos por tipo (últimos 30 días) */}
      {eventCounts.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Eventos por tipo (últimos 30 días)</h2>
          <div className="p-4 space-y-3">
            {eventCounts.map((e) => (
              <div key={e.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-700 capitalize">{e.type}</span>
                  <span className="font-semibold text-stone-800">{e.count}</span>
                </div>
                <div className="h-6 bg-stone-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-lg"
                    style={{ width: `${Math.min(100, (e.count / maxEvents) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
