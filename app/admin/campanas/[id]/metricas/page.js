"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api";
import QRChupete from "@/components/QRChupete";
import CampaignMetricsMap from "@/components/CampaignMetricsMap";

export default function MetricasCampanaPage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiCall(`metrics?campaign_id=${params.id}`),
      apiCall("campaigns").then((list) => {
        const c = Array.isArray(list) ? list.find((x) => String(x.id) === String(params.id)) : null;
        return c || null;
      }),
    ])
      .then(([metrics, camp]) => {
        setData(metrics);
        setCampaign(camp);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="py-12 text-stone-500">Cargando...</div>;

  const totals = data?.totals || {};
  const daily = data?.daily || [];
  const links = data?.links || [];
  const events = data?.events || [];
  const clicksByDate = data?.clicksByDate || [];
  const recentClicks = data?.recentClicks || [];
  const referrerCounts = data?.referrerCounts || [];
  const campaignLocations = campaign?.locations || [];

  const locationClicks = {};
  links.forEach((l) => {
    const lid = l.location_id ?? l.locationId;
    if (lid != null) locationClicks[lid] = (locationClicks[lid] || 0) + (l.clicks || 0);
  });

  const maxDaily = Math.max(1, ...daily.map((d) => (d.impressions || 0) + (d.clicks || 0) + (d.conversions || 0)));
  const maxLinkClicks = Math.max(1, ...links.map((l) => l.clicks || 0));
  const maxClicksByDate = Math.max(1, ...clicksByDate.map((d) => d.clicks || 0));
  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const eventCounts = eventTypes.map((t) => ({ type: t, count: events.filter((e) => e.event_type === t).reduce((s, e) => s + (e.count || 0), 0) }));
  const maxEvents = Math.max(1, ...eventCounts.map((e) => e.count));
  const totalReferrers = referrerCounts.reduce((s, r) => s + (r.total || 0), 0);

  const trackingUrl = (link) => (typeof window !== "undefined" && link.short_code ? `${window.location.origin}/api/track?c=${link.short_code}` : "");

  const formatUA = (ua) => {
    if (!ua) return "—";
    const m = ua.match(/\((.*?)\)/);
    return m ? m[1].slice(0, 50) + "…" : ua.slice(0, 40) + "…";
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link href={`/admin/campanas/${params.id}`} className="text-orange-600 hover:underline font-medium">← Volver a campaña</Link>
        <h1 className="text-2xl font-bold text-stone-800">Métricas de campaña</h1>
      </div>

      {/* Resumen KPIs – datos reales de clicks desde links trackables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative bg-gradient-to-br from-stone-50 to-white p-5 rounded-2xl border border-stone-200 shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-stone-200/30 rounded-bl-full" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-stone-500 text-sm font-medium uppercase tracking-wide">Impresiones</p>
              <p className="text-3xl font-extrabold text-stone-800 mt-1">{(totals.total_impressions || 0).toLocaleString()}</p>
            </div>
            <span className="text-3xl opacity-60" aria-hidden>👁</span>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-orange-50 to-white p-5 rounded-2xl border border-orange-200 shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-300/20 rounded-bl-full" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-orange-700 text-sm font-medium uppercase tracking-wide">Clicks</p>
              <p className="text-3xl font-extrabold text-orange-600 mt-1">{(totals.total_clicks || 0).toLocaleString()}</p>
              <p className="text-xs text-orange-600/80 mt-0.5">desde links trackables</p>
            </div>
            <span className="text-3xl opacity-60" aria-hidden>👆</span>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-emerald-50 to-white p-5 rounded-2xl border border-emerald-200 shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-300/20 rounded-bl-full" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-emerald-700 text-sm font-medium uppercase tracking-wide">Conversiones</p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{(totals.total_conversions || 0).toLocaleString()}</p>
            </div>
            <span className="text-3xl opacity-60" aria-hidden>✓</span>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-violet-50 to-white p-5 rounded-2xl border border-violet-200 shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-300/20 rounded-bl-full" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-violet-700 text-sm font-medium uppercase tracking-wide">CTR</p>
              <p className="text-3xl font-extrabold text-violet-700 mt-1">{totals.ctr != null ? `${Number(totals.ctr).toFixed(1)}%` : "—"}</p>
            </div>
            <span className="text-3xl opacity-60" aria-hidden>%</span>
          </div>
        </div>
      </div>

      {/* Mapa: ubicaciones de la campaña con clicks */}
      {campaignLocations.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Mapa – chupetes de la campaña (número y clicks)</h2>
          <div className="p-4">
            <CampaignMetricsMap locations={campaignLocations} locationClicks={locationClicks} height="340px" />
          </div>
        </div>
      )}

      {/* Clicks por día (desde links trackables) */}
      {clicksByDate.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Clicks por día (links trackables, últimos 30 días)</h2>
          <div className="p-4 overflow-x-auto">
            <div className="flex items-end gap-1.5 min-w-max" style={{ height: 200 }}>
              {clicksByDate.map((d, i) => (
                <div key={d.date || i} className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                  <div className="w-full bg-stone-100 rounded-t" style={{ height: 160 }}>
                    <div
                      className="w-full bg-orange-500 rounded-t transition-all"
                      style={{ height: `${Math.min(100, ((d.clicks || 0) / maxClicksByDate) * 100)}%` }}
                      title={`${d.date}: ${d.clicks || 0} clicks`}
                    />
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1">{d.date ? new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* De dónde vino el disparo: referrers */}
      {referrerCounts.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">De dónde vino el disparo (origen de los clicks)</h2>
          <p className="px-4 pt-2 text-sm text-stone-600">Referrer: página o app desde la que se hizo click en el link trackable.</p>
          <div className="p-4 space-y-3">
            {referrerCounts.map((r) => {
              const pct = totalReferrers > 0 ? ((r.total / totalReferrers) * 100).toFixed(0) : 0;
              return (
                <div key={r.referrer}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate pr-2 text-stone-700" title={r.referrer}>{r.referrer === "(directo)" ? "Directo (sin referrer)" : r.referrer}</span>
                    <span className="font-semibold text-orange-600">{r.total} ({pct}%)</span>
                  </div>
                  <div className="h-6 bg-stone-100 rounded-lg overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla: últimos clicks (origen detallado) */}
      {recentClicks.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b">Últimos clicks – detalle (origen del disparo)</h2>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500 sticky top-0">
                <tr>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Link / Chupete</th>
                  <th className="p-2">Referrer</th>
                  <th className="p-2">Dispositivo / Navegador</th>
                </tr>
              </thead>
              <tbody>
                {recentClicks.map((c) => (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="p-2 text-stone-600">{c.clicked_at ? new Date(c.clicked_at).toLocaleString("es-AR") : "—"}</td>
                    <td className="p-2 font-medium">{c.link_name || `Link ${c.link_id}`}{c.location_id ? ` (Chupete N° ${c.location_id})` : ""}</td>
                    <td className="p-2 truncate max-w-xs" title={c.referrer || ""}>{c.referrer && c.referrer.trim() ? c.referrer : "(directo)"}</td>
                    <td className="p-2 text-stone-600" title={c.user_agent || ""}>{formatUA(c.user_agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolución diaria (métricas manuales) */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Evolución diaria (impresiones, clicks, conversiones)</h2>
          <div className="p-4 overflow-x-auto">
            <div className="flex items-end gap-1 min-w-max" style={{ height: 220 }}>
              {daily.slice(0, 30).reverse().map((d, i) => {
                const imp = ((d.impressions || 0) / maxDaily) * 100;
                const clk = ((d.clicks || 0) / maxDaily) * 100;
                const conv = ((d.conversions || 0) / maxDaily) * 100;
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

      {/* Links trackables + QR (alta calidad) */}
      {links.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b border-stone-100">Links trackables + QR (descarga en alta calidad)</h2>
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
                      <input readOnly value={trackingUrl(l)} className="flex-1 min-w-0 max-w-md text-xs px-2 py-1 border border-stone-200 rounded bg-white" />
                      <button type="button" onClick={() => navigator.clipboard.writeText(trackingUrl(l))} className="text-xs text-blue-600 hover:underline">Copiar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla links */}
      {links.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <h2 className="p-4 font-bold text-stone-800 border-b">Links – detalle</h2>
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

      {/* Eventos por tipo */}
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
                  <div className="h-full bg-violet-400 rounded-lg" style={{ width: `${Math.min(100, (e.count / maxEvents) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
