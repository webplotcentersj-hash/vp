"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InstalacionesAuditoria from "./InstalacionesAuditoria";

function locationMatchesQuery(loc, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    String(loc.id).includes(s) ||
    (loc.address || "").toLowerCase().includes(s) ||
    (loc.reference || "").toLowerCase().includes(s)
  );
}

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 13;
const POLL_MS_VISIBLE = 2500;
const POLL_MS_HIDDEN = 25000;

export default function InstalacionesPublic({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("instalacion");
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);
  const dataRef = useRef(null);
  const slugRef = useRef(slug);
  const searchRef = useRef("");
  const toggleRef = useRef(() => {});

  slugRef.current = slug;
  searchRef.current = search;

  const load = useCallback(async () => {
    const requestedSlug = slug;
    try {
      const r = await fetch(`/api/installations/${requestedSlug}`, { cache: "no-store" });
      if (!r.ok) {
        if (requestedSlug !== slugRef.current) return;
        if (r.status === 404) {
          setError("Lista no encontrada");
          setData(null);
        }
        return;
      }
      const j = await r.json();
      if (requestedSlug !== slugRef.current) return;
      setData(j);
      setError(null);
    } catch {
      if (requestedSlug !== slugRef.current) return;
      if (dataRef.current == null) {
        setError("Error de red");
        setData(null);
      }
    } finally {
      if (requestedSlug === slugRef.current) setLoading(false);
    }
  }, [slug]);

  const toggle = useCallback(
    async (loc, installed) => {
      setPendingId(loc.id);
      try {
        const r = await fetch(`/api/installations/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: loc.id, installed: !installed }),
        });
        if (!r.ok) {
          const t = await r.text();
          alert(t || "No se pudo actualizar");
          return;
        }
        await load();
      } finally {
        setPendingId(null);
      }
    },
    [slug, load]
  );

  toggleRef.current = toggle;
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let pollTimer = null;
    const clearPoll = () => {
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPoll = () => {
      clearPoll();
      const ms = document.visibilityState === "visible" ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;
      pollTimer = setInterval(load, ms);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        load();
        queueMicrotask(() => {
          try {
            mapRef.current?.invalidateSize();
          } catch (_) {}
        });
      }
      startPoll();
    };
    const onFocus = () => {
      load();
      queueMicrotask(() => {
        try {
          mapRef.current?.invalidateSize();
        } catch (_) {}
      });
    };
    const onResize = () => {
      try {
        mapRef.current?.invalidateSize();
      } catch (_) {}
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    startPoll();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      clearPoll();
    };
  }, [load]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch (_) {}
      });
      markersRef.current = [];
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (_) {}
        mapRef.current = null;
      }
      LRef.current = null;
    };
  }, [slug]);

  useEffect(() => {
    if (tab !== "instalacion" || !data || loading || !mapContainerRef.current) return;

    let cancelled = false;
    let resizeObserver = null;
    const containerEl = mapContainerRef.current;

    const scheduleInvalidate = () => {
      [0, 120, 400, 900].forEach((ms) => {
        setTimeout(() => {
          try {
            if (mapRef.current && !cancelled) mapRef.current.invalidateSize();
          } catch (_) {}
        }, ms);
      });
    };

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;
      if (cancelled || !mapContainerRef.current) return;

      if (!mapRef.current) {
        const el = mapContainerRef.current;
        const map = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        scheduleInvalidate();

        if (!cancelled) {
          resizeObserver = new ResizeObserver(() => {
            try {
              mapRef.current?.invalidateSize({ animate: false });
            } catch (_) {}
          });
          resizeObserver.observe(el);
        }
      }

      const map = mapRef.current;
      if (!map || cancelled) return;

      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch (_) {}
      });
      markersRef.current = [];

      const q = (typeof searchRef.current === "string" ? searchRef.current : "").trim();
      const baseLocs = data.locations;
      const visibleLocs = q ? baseLocs.filter((l) => locationMatchesQuery(l, q)) : baseLocs;

      const withCoords = visibleLocs.filter(
        (l) => typeof l.lat === "number" && typeof l.lng === "number"
      );

      withCoords.forEach((loc) => {
        const color = loc.installed ? "#16a34a" : "#ea580c";
        const border = "2px solid #fff";
        const icon = L.divIcon({
          className: "public-inst-marker-wrap",
          html: `<span class="public-inst-marker" style="background:${color};border:${border}">${loc.id}</span>`,
          iconSize: [34, 40],
          iconAnchor: [17, 40],
        });
        const m = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
        m.bindTooltip(`${loc.installed ? "✓ " : ""}N° ${loc.id} · tocar`, {
          direction: "top",
          offset: [0, -8],
        });
        const id = loc.id;
        m.on("click", () => {
          const cur = dataRef.current?.locations?.find((x) => x.id === id);
          if (cur) toggleRef.current(cur, cur.installed);
        });
        markersRef.current.push(m);
      });

      if (!cancelled && mapRef.current === map) {
        if (withCoords.length > 0) {
          const bounds = L.latLngBounds(withCoords.map((l) => [l.lat, l.lng]));
          map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
        } else {
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }
        scheduleInvalidate();
      }
    })();

    return () => {
      cancelled = true;
      if (resizeObserver && containerEl) {
        try {
          resizeObserver.disconnect();
        } catch (_) {}
      }
    };
  }, [data, loading, search, tab]);

  const filteredLocations = useMemo(() => {
    if (!data?.locations) return [];
    return data.locations.filter((l) => locationMatchesQuery(l, search));
  }, [data, search]);

  const withCoordsCount = useMemo(() => {
    if (!data?.locations) return 0;
    return data.locations.filter((l) => typeof l.lat === "number" && typeof l.lng === "number").length;
  }, [data]);

  const filteredWithCoordsCount = useMemo(
    () =>
      filteredLocations.filter((l) => typeof l.lat === "number" && typeof l.lng === "number").length,
    [filteredLocations]
  );

  if (loading && !data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-100 text-stone-600">
        Cargando…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-100 p-4">
        <p className="text-stone-700 text-center">{error || "Sin datos"}</p>
      </div>
    );
  }

  const pct = data.total ? Math.round((data.installedCount / data.total) * 100) : 0;

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900 pb-8">
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200 shadow-sm px-4 py-3">
        <h1 className="text-lg font-bold text-stone-900 leading-tight">{data.title || "Instalaciones"}</h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.installedCount} de {data.total} instalados · {pct}%
        </p>
        <div className="mt-2 h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => setTab("instalacion")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === "instalacion" ? "bg-orange-600 text-white shadow-sm" : "bg-stone-100 text-stone-600"
            }`}
          >
            Instalación
          </button>
          <button
            type="button"
            onClick={() => setTab("auditoria")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === "auditoria" ? "bg-orange-600 text-white shadow-sm" : "bg-stone-100 text-stone-600"
            }`}
          >
            Auditoría
          </button>
        </div>
        <label className="sr-only" htmlFor="inst-search">
          Buscar ubicación
        </label>
        <input
          id="inst-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar N°, dirección, referencia…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-3 w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
        {search.trim() ? (
          <p className="text-xs text-stone-500 mt-1.5">
            {filteredLocations.length === 0
              ? "Ningún resultado"
              : `${filteredLocations.length} resultado${filteredLocations.length !== 1 ? "s" : ""}`}
          </p>
        ) : null}
        {tab === "instalacion" ? (
          <p className="text-xs text-stone-400 mt-2">
            Mapa arriba · lista abajo. Tocá para marcar. Se actualiza casi al instante entre equipos (~{POLL_MS_VISIBLE / 1000}s).
          </p>
        ) : (
          <p className="text-xs text-stone-400 mt-2">
            Subí fotos por chupete para relevar el estado en campo. La búsqueda filtra la lista.
          </p>
        )}
      </header>

      {tab === "auditoria" ? (
        <InstalacionesAuditoria slug={slug} locations={filteredLocations} />
      ) : null}

      <div className={`px-0 pt-0 max-w-lg mx-auto w-full ${tab !== "instalacion" ? "hidden" : ""}`}>
        <div className="relative w-full h-[min(42vh,280px)] min-h-[200px] bg-stone-200 border-b border-stone-200 isolate">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 z-0 leaflet-instalaciones w-full h-full"
            style={{ minHeight: 200 }}
          />
          {withCoordsCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-500 px-4 text-center z-[1] pointer-events-none">
              Estas ubicaciones no tienen coordenadas en el mapa.
            </div>
          ) : search.trim() && filteredWithCoordsCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-500 px-4 text-center z-[1] pointer-events-none">
              Ninguno de los resultados tiene ubicación en el mapa.
            </div>
          ) : null}
        </div>
        <div className="flex justify-center gap-4 px-3 py-2 text-[10px] text-stone-500 uppercase tracking-wide">
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 align-middle mr-1" />
            Pendiente
          </span>
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600 align-middle mr-1" />
            Instalado
          </span>
        </div>
      </div>

      <ul className={`px-3 pt-1 space-y-2 max-w-lg mx-auto ${tab !== "instalacion" ? "hidden" : ""}`}>
        {filteredLocations.length === 0 && search.trim() ? (
          <li className="text-center text-sm text-stone-500 py-8">Probá con otro texto de búsqueda.</li>
        ) : null}
        {filteredLocations.map((loc) => {
          const busy = pendingId === loc.id;
          return (
            <li key={loc.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(loc, loc.installed)}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 flex gap-3 items-start transition-colors active:scale-[0.99] disabled:opacity-60 ${
                  loc.installed
                    ? "bg-green-50 border-green-400 shadow-sm"
                    : "bg-white border-stone-200 hover:border-orange-300"
                }`}
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    loc.installed ? "bg-green-600 text-white" : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {loc.installed ? "✓" : loc.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-stone-900 block">N° {loc.id}</span>
                  <span className="text-sm text-stone-600 line-clamp-2">{loc.address || "—"}</span>
                  {loc.reference ? (
                    <span className="text-xs text-stone-400 block mt-0.5">{loc.reference}</span>
                  ) : null}
                  {loc.installed && loc.markedAt ? (
                    <span className="text-xs text-green-700 mt-1 block">
                      Actualizado{" "}
                      {new Date(loc.markedAt).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <style jsx global>{`
        .public-inst-marker-wrap {
          background: transparent !important;
          border: none !important;
        }
        .public-inst-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .leaflet-instalaciones .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          z-index: 0;
          font-family: system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </div>
  );
}
