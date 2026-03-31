"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 13;

export default function InstalacionesPublic({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/installations/${slug}`, { cache: "no-store" });
      if (!r.ok) {
        setError(r.status === 404 ? "Lista no encontrada" : "Error al cargar");
        setData(null);
        return;
      }
      const j = await r.json();
      setData(j);
      setError(null);
    } catch {
      setError("Error de red");
      setData(null);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(load, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
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
    if (!data || loading || !mapContainerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;
      if (cancelled || !mapContainerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current;
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch (_) {}
      });
      markersRef.current = [];

      const withCoords = data.locations.filter(
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
        m.on("click", () => toggle(loc, loc.installed));
        markersRef.current.push(m);
      });

      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map((l) => [l.lat, l.lng]));
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }

      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
    };
  }, [data, loading, toggle]);

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
  const withCoordsCount = data.locations.filter(
    (l) => typeof l.lat === "number" && typeof l.lng === "number"
  ).length;

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
        <p className="text-xs text-stone-400 mt-2">
          Mapa arriba · lista abajo. Tocá un punto del mapa o un renglón para marcar.
        </p>
      </header>

      <div className="px-0 pt-0 max-w-lg mx-auto w-full">
        <div className="relative w-full h-[min(42vh,280px)] min-h-[200px] bg-stone-200 border-b border-stone-200">
          <div ref={mapContainerRef} className="absolute inset-0 z-0 leaflet-instalaciones" />
          {withCoordsCount === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-500 px-4 text-center z-[1] pointer-events-none">
              Estas ubicaciones no tienen coordenadas en el mapa.
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

      <ul className="px-3 pt-1 space-y-2 max-w-lg mx-auto">
        {data.locations.map((loc) => {
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
          font-family: system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </div>
  );
}
