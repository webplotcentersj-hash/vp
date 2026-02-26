"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "ubicaciones_session_id";
const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = "s_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export default function UbicacionesPublicPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/public-selections?session=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => {
        const ids = Array.isArray(data?.selectedIds) ? data.selectedIds : [];
        setSelectedIds(new Set(ids));
      })
      .catch(() => {});
  }, [sessionId]);

  const filtered = list.filter(
    (l) =>
      (l.address || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      String(l.id).includes(search)
  );

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const arr = Array.from(next);
      if (sessionId) {
        fetch("/api/public-selections", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, selectedIds: arr }),
        }).catch(() => {});
      }
      return next;
    });
  }

  // Mapa solo cuando showMap y hay contenedor (client-side)
  useEffect(() => {
    if (!showMap || !mapContainerRef.current || typeof window === "undefined") return;
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !mapContainerRef.current) return;
      LRef.current = L;
      if (mapRef.current) return;
      const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const withCoords = list.filter(
        (loc) =>
          (loc.coordinates?.lat != null && loc.coordinates?.lng != null) ||
          (loc.lat != null && loc.lng != null)
      );
      const bounds = [];
      withCoords.forEach((loc) => {
        const lat = Number(loc.coordinates?.lat ?? loc.lat);
        const lng = Number(loc.coordinates?.lng ?? loc.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        bounds.push([lat, lng]);
        const selected = selectedIds.has(loc.id);
        const icon = L.divIcon({
          className: "public-marker",
          html: `<span class="marker-pin-public ${selected ? "marker-selected" : ""}">${loc.id}</span>`,
          iconSize: [36, 44],
          iconAnchor: [18, 44],
        });
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindTooltip(
          `<strong>N° ${loc.id}</strong><br/>${(loc.address || "").replace(/</g, "&lt;")}`,
          { permanent: false, direction: "top", className: "tooltip-public" }
        );
        markersRef.current.push(marker);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    })();
    return () => {
      mounted = false;
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch (_) {}
      });
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
    };
  }, [showMap]);

  // Actualizar marcadores cuando cambia selectedIds (solo si el mapa ya está)
  useEffect(() => {
    if (!showMap || !mapRef.current || !LRef.current || list.length === 0) return;
    const L = LRef.current;
    const map = mapRef.current;
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch (_) {}
    });
    markersRef.current = [];
    const withCoords = list.filter(
      (loc) =>
        (loc.coordinates?.lat != null && loc.coordinates?.lng != null) ||
        (loc.lat != null && loc.lng != null)
    );
    withCoords.forEach((loc) => {
      const lat = Number(loc.coordinates?.lat ?? loc.lat);
      const lng = Number(loc.coordinates?.lng ?? loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const selected = selectedIds.has(loc.id);
      const icon = L.divIcon({
        className: "public-marker",
        html: `<span class="marker-pin-public ${selected ? "marker-selected" : ""}">${loc.id}</span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindTooltip(
        `<strong>N° ${loc.id}</strong><br/>${(loc.address || "").replace(/</g, "&lt;")}`,
        { permanent: false, direction: "top", className: "tooltip-public" }
      );
      markersRef.current.push(marker);
    });
  }, [showMap, selectedIds, list]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 safe-area-pb">
        <p className="text-stone-600 text-lg">Cargando ubicaciones...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-black flex flex-col safe-area-pb">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-stone-900">Ubicaciones</h1>
          <p className="text-sm text-stone-500 mt-0.5">Tocá una para seleccionarla</p>
          <input
            type="search"
            placeholder="Buscar por número, dirección o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-3 w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            autoComplete="off"
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          {filtered.map((loc) => {
            const selected = selectedIds.has(loc.id);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleSelect(loc.id)}
                className={`w-full text-left rounded-xl p-4 border-2 transition-all touch-manipulation active:scale-[0.99] ${
                  selected
                    ? "bg-amber-100 border-amber-500 shadow-md"
                    : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      selected ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {loc.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 truncate">{loc.address || "Sin dirección"}</p>
                    {loc.reference && (
                      <p className="text-sm text-stone-500 mt-0.5 truncate">{loc.reference}</p>
                    )}
                    <span
                      className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                        loc.status === "available"
                          ? "bg-green-100 text-green-800"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {loc.status === "available" ? "Disponible" : "Alquilado"}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-2xl" aria-hidden>
                    {selected ? "✓" : "○"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-stone-500 py-8">No hay ubicaciones que coincidan con la búsqueda.</p>
        )}

        {list.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="w-full py-3 px-4 rounded-xl bg-stone-800 text-white font-medium active:bg-stone-900"
            >
              {showMap ? "Ocultar mapa" : "Ver en mapa"}
            </button>
            {showMap && (
              <div
                ref={mapContainerRef}
                className="mt-4 rounded-xl overflow-hidden border border-stone-200 bg-stone-200 h-[320px]"
              />
            )}
          </div>
        )}
      </main>

    </div>
  );
}
