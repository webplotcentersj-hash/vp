"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;
const LIVE_REFRESH_MS = 30000;

const statusLabels = { draft: "Borrador", active: "Activa", paused: "Pausada", completed: "Completada" };
const statusColors = { draft: "bg-stone-200", active: "bg-green-500", paused: "bg-amber-500", completed: "bg-blue-500" };

function getTier(index, total) {
  if (total <= 0) return 0;
  return Math.min(4, Math.floor((1 - index / total) * 5));
}

export default function EstadisticasPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [readyToInitMap, setReadyToInitMap] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);

  function load() {
    setLoading(true);
    setError("");
    apiCall("statistics")
      .then((res) => { setData(res); setError(""); })
      .catch((e) => {
        let msg = e?.message || "Error al cargar estadísticas";
        try {
          const parsed = JSON.parse(msg);
          if (parsed.message) msg = parsed.message;
          if (parsed.error && (parsed.error.includes("ETIMEDOUT") || parsed.error.includes("ECONNREFUSED"))) {
            msg = "No se pudo conectar al servidor. Revisá la base de datos de campañas.";
          }
        } catch (_) {}
        setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const locsWithCoords = (data?.campaigns?.top_locations_by_clicks || []).filter(
    (x) => x.lat != null && x.lng != null && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))
  );

  useEffect(() => {
    const n = (data?.campaigns?.top_locations_by_clicks || []).filter(
      (x) => x.lat != null && x.lng != null && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))
    ).length;
    if (n > 0) setReadyToInitMap(true);
  }, [data]);

  useEffect(() => {
    if (!readyToInitMap || !mapContainerRef.current || mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      LRef.current = L;
      if (!mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
      setMapReady(false);
    };
  }, [readyToInitMap]);

  useEffect(() => {
    const withCoords = (data?.campaigns?.top_locations_by_clicks || []).filter(
      (x) => x.lat != null && x.lng != null && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))
    );
    if (!mapReady || !mapRef.current || !LRef.current || withCoords.length === 0) return;
    const L = LRef.current;
    const map = mapRef.current;
    markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
    markersRef.current = [];
    const sorted = [...withCoords].sort((a, b) => Number(b.clicks ?? 0) - Number(a.clicks ?? 0));
    const bounds = [];
    sorted.forEach((loc, i) => {
      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      bounds.push([lat, lng]);
      const tier = getTier(i, sorted.length);
      const icon = L.divIcon({
        className: "stats-marker-wrap",
        html: `<span class="stats-marker stats-marker-tier-${tier}">${loc.location_id}</span>`,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const addr = (loc.address || "Sin dirección").replace(/</g, "&lt;");
      marker.bindTooltip(
        `<strong>Chupete N° ${loc.location_id}</strong><br/>${addr}<br/><strong>${Number(loc.clicks ?? 0).toLocaleString()} clicks</strong>`,
        { permanent: false, direction: "top", offset: [0, -28], className: "tooltip-stats" }
      );
      markersRef.current.push(marker);
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
  }, [mapReady, data]);

  useEffect(() => {
    const id = setInterval(load, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) return <div className="py-12 text-black text-center">Cargando...</div>;
  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-black">Estadísticas – Campañas y ubicaciones</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
          <p className="font-medium">{error}</p>
          <button type="button" onClick={load} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Reintentar</button>
        </div>
      </div>
    );
  }

  const camp = data?.campaigns || {};
  const loc = data?.locations || {};
  const metrics = camp.metrics || {};
  const topCampaigns = camp.top_campaigns || [];
  const trend30 = camp.trend_30_days || [];
  const trendByHour = camp.trend_by_hour || [];
  const statusDist = camp.status_distribution || [];
  const topLocClicks = camp.top_locations_by_clicks || [];

  const totalClicks = Number(metrics.total_clicks ?? 0);
  const totalConv = Number(metrics.total_conversions ?? 0);
  const convRate = Number(metrics.global_conversion_rate ?? 0);
  const totalCampaigns = Number(camp.campaigns?.total_campaigns ?? 0);
  const activeCampaigns = Number(camp.campaigns?.active_campaigns ?? 0);
  const totalLinks = Number(camp.links?.total_links ?? 0);
  const activeLinks = Number(camp.links?.active_links ?? 0);
  const maxClicks = Math.max(1, ...topCampaigns.map((c) => Number(c.real_clicks ?? 0)));
  const maxTrend = Math.max(1, ...trend30.map((d) => Number(d.clicks ?? 0)));
  const maxTrendHour = Math.max(1, ...trendByHour.map((d) => Number(d.clicks ?? 0)));
  const totalLoc = Number(loc.total ?? 0);
  const locAvailable = Number(loc.available ?? 0);
  const locRented = Number(loc.rented ?? 0);
  const occupancy = Number(loc.occupancy_rate ?? 0);

  const generatedAt = data?.generated_at ? new Date(data.generated_at) : null;
  const dateTimeStr = generatedAt
    ? generatedAt.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
      ", " +
      generatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-black">Estadísticas – Campañas y ubicaciones</h1>
        <div className="flex items-center gap-3">
          {dateTimeStr && (
            <p className="text-sm text-stone-500 font-medium">
              Día y horario: <span className="text-stone-700">{dateTimeStr}</span>
            </p>
          )}
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-stone-200 text-stone-800 hover:bg-stone-300"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon="📢" title="Campañas activas" value={activeCampaigns} sub={`de ${totalCampaigns} total`} accent="orange" />
        <KpiCard icon="👆" title="Total clicks" value={totalClicks.toLocaleString()} sub="en todas las campañas" accent="amber" />
        <KpiCard icon="✓" title="Conversiones" value={totalConv.toLocaleString()} sub={`Tasa ${convRate}%`} accent="green" />
        <KpiCard icon="🔗" title="Links activos" value={activeLinks} sub={`de ${totalLinks} links`} accent="sky" />
        <KpiCard icon="📍" title="Ubicaciones" value={totalLoc} sub={`${locAvailable} disp. · ${locRented} alq.`} accent="violet" />
        <KpiCard icon="📊" title="Ocupación" value={`${occupancy}%`} sub="ubicaciones alquiladas" accent="rose" />
      </div>

      {/* Clicks por campaña (bar chart) */}
      {topCampaigns.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Clicks por campaña</h2>
            <p className="text-sm text-stone-500 mt-0.5">Top 15 campañas por cantidad de clicks</p>
          </div>
          <div className="p-6 space-y-4">
            {topCampaigns.slice(0, 15).map((c) => {
              const clicks = Number(c.real_clicks ?? 0);
              const pct = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;
              return (
                <div key={c.id} className="group">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-black truncate pr-2 group-hover:text-orange-600 transition-colors">{c.name}</span>
                    <span className="font-bold text-orange-600 tabular-nums">{clicks.toLocaleString()}</span>
                  </div>
                  <div className="h-8 bg-stone-100 rounded-xl overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-xl transition-all duration-500 ease-out bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 shadow-sm"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tendencia últimos 30 días */}
      {trend30.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Clicks por día</h2>
            <p className="text-sm text-stone-500 mt-0.5">Últimos 30 días</p>
          </div>
          <div className="p-6 overflow-x-auto">
            <div className="flex items-end gap-1.5 min-w-max pb-2" style={{ height: 160 }}>
              {trend30.map((d, i) => {
                const h = maxTrend > 0 ? Math.max(8, (Number(d.clicks || 0) / maxTrend) * 100) : 8;
                return (
                  <div key={d.date || i} className="flex flex-col items-center flex-shrink-0 group" style={{ width: 24 }}>
                    <div className="w-full flex flex-col justify-end flex-1 min-h-[80px]" style={{ height: 100 }}>
                      <div
                        className="w-full min-w-[10px] rounded-t-lg bg-gradient-to-t from-orange-500 to-amber-400 shadow-md hover:from-orange-600 hover:to-amber-500 transition-all duration-200"
                        style={{ height: `${h}%` }}
                        title={`${d.date}: ${d.clicks || 0} clicks`}
                      />
                    </div>
                    <span className="text-[10px] text-stone-500 mt-2 font-medium">{d.date ? new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Clicks por hora – últimas 24 h */}
      {trendByHour.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Clicks por hora</h2>
            <p className="text-sm text-stone-500 mt-0.5">Últimas 24 horas</p>
          </div>
          <div className="p-6 overflow-x-auto">
            <div className="flex items-end gap-1 min-w-max pb-2" style={{ height: 140 }}>
              {trendByHour.map((d, i) => {
                const h = maxTrendHour > 0 ? Math.max(6, (Number(d.clicks ?? 0) / maxTrendHour) * 100) : 6;
                return (
                  <div key={`${d.hour_key}-${i}`} className="flex flex-col items-center flex-shrink-0 group" style={{ width: 28 }}>
                    <div className="w-full flex flex-col justify-end flex-1 min-h-[72px]" style={{ height: 88 }}>
                      <div
                        className="w-full min-w-[12px] rounded-t-md bg-gradient-to-t from-teal-500 to-cyan-400 shadow-md hover:from-teal-600 hover:to-cyan-500 transition-all duration-200"
                        style={{ height: `${h}%` }}
                        title={`${d.hour_label}: ${d.clicks ?? 0} clicks`}
                      />
                    </div>
                    <span className="text-[10px] text-stone-500 mt-1.5 font-medium truncate w-full text-center">{d.hour_label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Distribución por estado */}
      {statusDist.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Campañas por estado</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-2 h-12 rounded-xl overflow-hidden shadow-inner mb-4">
              {statusDist.map((row) => {
                const total = statusDist.reduce((s, r) => s + Number(r.count || 0), 0);
                const pct = total > 0 ? (Number(row.count || 0) / total) * 100 : 0;
                return (
                  <div
                    key={row.status}
                    className={`flex items-center justify-center min-w-[60px] ${statusColors[row.status] || "bg-stone-300"} text-white font-bold text-sm shadow-sm transition-transform hover:scale-105`}
                    style={{ width: `${pct}%` }}
                    title={`${statusLabels[row.status]}: ${row.count}`}
                  >
                    {pct > 15 ? row.count : ""}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-6">
              {statusDist.map((row) => (
                <div key={row.status} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full shadow-sm ${statusColors[row.status] || "bg-stone-300"}`} />
                  <span className="text-sm font-medium text-black">{statusLabels[row.status] || row.status}: <strong>{row.count}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top ubicaciones por clicks */}
      {topLocClicks.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-sky-50 to-indigo-50 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Ubicaciones con más clicks</h2>
            <p className="text-sm text-stone-500 mt-0.5">Chupetes por cantidad de clicks</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {topLocClicks.slice(0, 18).map((row, i) => (
                <div
                  key={row.location_id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 hover:bg-sky-50 border border-transparent hover:border-sky-200 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex w-8 h-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-bold text-sm">{i + 1}</span>
                    <span className="font-semibold text-black group-hover:text-sky-700">N° {row.location_id}</span>
                  </span>
                  <span className="font-bold text-sky-600 tabular-nums">{Number(row.clicks || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 text-center">
              <Link href="/admin/ubicaciones" className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-medium text-sm">Ver todas las ubicaciones →</Link>
            </div>
          </div>
        </section>
      )}

      {/* Mapa en tiempo real – Clicks por ubicación */}
      {locsWithCoords.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-black flex items-center gap-2">
                Mapa de clicks por ubicación
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  En vivo
                </span>
              </h2>
              <p className="text-sm text-stone-500 mt-0.5">Colores por nivel de clicks · Se actualiza cada 30 s</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm" /> Menos
              </span>
              <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm" />
              <span className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-violet-500 shadow-sm" /> Más clicks
              </span>
            </div>
          </div>
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="w-full bg-stone-200"
              style={{ minHeight: 360, height: 360 }}
            />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-200/90 text-stone-600 font-medium">
                Cargando mapa…
              </div>
            )}
          </div>
        </section>
      )}

      {/* Estado de ubicaciones */}
      {totalLoc > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Estado de ubicaciones</h2>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-100 shadow-sm">
              <p className="text-3xl font-black text-black">{totalLoc}</p>
              <p className="text-sm font-medium text-stone-600 mt-1">Total</p>
            </div>
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 shadow-sm">
              <p className="text-3xl font-black text-green-700">{locAvailable}</p>
              <p className="text-sm font-medium text-green-600 mt-1">Disponibles</p>
            </div>
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 shadow-sm">
              <p className="text-3xl font-black text-amber-700">{locRented}</p>
              <p className="text-sm font-medium text-amber-600 mt-1">Alquiladas</p>
            </div>
            <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 shadow-sm">
              <p className="text-3xl font-black text-orange-600">{occupancy}%</p>
              <p className="text-sm font-medium text-orange-600 mt-1">Ocupación</p>
            </div>
          </div>
        </section>
      )}

      {/* Tabla campañas */}
      {topCampaigns.length > 0 && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-stone-50 border-b border-stone-100">
            <h2 className="text-lg font-bold text-black">Todas las campañas</h2>
            <p className="text-sm text-stone-500 mt-0.5">Ordenadas por clicks</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-100/80">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-stone-500">Campaña</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-stone-500">Estado</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-stone-500">Clicks</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-stone-500">Conversiones</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-stone-500">Ubicaciones</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-stone-500">Acción</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((c, i) => (
                  <tr key={c.id} className={`border-t border-stone-100 hover:bg-orange-50/50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}`}>
                    <td className="p-4 font-semibold text-black">{c.name}</td>
                    <td className="p-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full shadow-sm ${statusColors[c.status] || "bg-stone-200"} ${c.status === "draft" ? "text-stone-800" : "text-white"}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-orange-600 tabular-nums">{Number(c.real_clicks ?? 0).toLocaleString()}</td>
                    <td className="p-4 text-right text-black tabular-nums">{c.total_conversions ?? 0}</td>
                    <td className="p-4 text-right text-black tabular-nums">{c.num_locations ?? 0}</td>
                    <td className="p-4">
                      <Link href={`/admin/campanas/${c.id}/metricas`} className="inline-flex items-center font-medium text-orange-600 hover:text-orange-700 hover:underline text-sm">Métricas →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalCampaigns === 0 && totalLoc === 0 && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-8 text-center text-black">
          <p>Aún no hay campañas ni datos de ubicaciones.</p>
          <Link href="/admin/campanas/nueva" className="text-orange-600 hover:underline mt-2 inline-block">Crear campaña</Link>
          {" · "}
          <Link href="/admin/ubicaciones" className="text-orange-600 hover:underline">Ubicaciones</Link>
        </div>
      )}
    </div>
  );
}

const accentStyles = {
  orange: "from-orange-500/10 to-amber-500/10 border-orange-200 text-orange-600",
  amber: "from-amber-500/10 to-yellow-500/10 border-amber-200 text-amber-600",
  green: "from-green-500/10 to-emerald-500/10 border-green-200 text-green-600",
  sky: "from-sky-500/10 to-blue-500/10 border-sky-200 text-sky-600",
  violet: "from-violet-500/10 to-purple-500/10 border-violet-200 text-violet-600",
  rose: "from-rose-500/10 to-pink-500/10 border-rose-200 text-rose-600",
};

function KpiCard({ icon, title, value, sub, accent = "orange" }) {
  const style = accentStyles[accent] || accentStyles.orange;
  return (
    <div className={`p-5 rounded-2xl border-2 bg-gradient-to-br ${style} shadow-sm hover:shadow-md transition-shadow`}>
      <p className="text-sm font-semibold text-stone-600 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        {title}
      </p>
      <p className="text-2xl font-black mt-2 text-black">{value}</p>
      {sub != null && sub !== "" && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
    </div>
  );
}
