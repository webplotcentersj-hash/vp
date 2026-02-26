"use client";

import { useState, useEffect, useRef } from "react";

const COOKIE_NAME = "ubicaciones_sid";
const COOKIE_MAX_AGE_DAYS = 365;
const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name.replace(/[\\.$*+?^()|[\]{}]/g, "\\$&") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; max-age=" + (days * 24 * 60 * 60) + "; SameSite=Lax";
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  let id = getCookie(COOKIE_NAME);
  if (!id) {
    id = "s_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    setCookie(COOKIE_NAME, id, COOKIE_MAX_AGE_DAYS);
  }
  return id;
}

export default function UbicacionesPublicPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [countsByLocation, setCountsByLocation] = useState({});
  const [totalPeople, setTotalPeople] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [downloadingMapPdf, setDownloadingMapPdf] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);
  const toggleSelectRef = useRef(() => {});

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
        setCountsByLocation(typeof data?.countsByLocation === "object" ? data.countsByLocation : {});
        setTotalPeople(Number(data?.totalSessionsWithSelections) || 0);
      })
      .catch(() => {});
  }, [sessionId]);

  function refreshCounts() {
    if (!sessionId) return;
    fetch(`/api/public-selections?session=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => {
        setCountsByLocation(typeof data?.countsByLocation === "object" ? data.countsByLocation : {});
        setTotalPeople(Number(data?.totalSessionsWithSelections) || 0);
      })
      .catch(() => {});
  }

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
        })
          .then(() => refreshCounts())
          .catch(() => {});
      }
      return next;
    });
  }
  toggleSelectRef.current = toggleSelect;

  async function downloadMapAsPdf() {
    const container = mapContainerRef.current;
    if (!container) return;
    setDownloadingMapPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { PDFDocument } = await import("pdf-lib");
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] || dataUrl;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const doc = await PDFDocument.create();
      const pageWidth = 2384;
      const pageHeight = 1684;
      const page = doc.addPage([pageWidth, pageHeight]);
      const img = await doc.embedPng(bytes);
      const r = Math.min(pageWidth / img.width, pageHeight / img.height);
      const w = img.width * r;
      const h = img.height * r;
      const x = (pageWidth - w) / 2;
      const y = pageHeight - h;
      page.drawImage(img, { x, y, width: w, height: h });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapa-ubicaciones-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el PDF del mapa. " + (e?.message || ""));
    } finally {
      setDownloadingMapPdf(false);
    }
  }

  // Inicializar mapa arriba (cuando hay lista y contenedor)
  useEffect(() => {
    const withCoords = list.filter(
      (l) =>
        (l.coordinates?.lat != null && l.coordinates?.lng != null) ||
        (l.lat != null && l.lng != null)
    );
    if (withCoords.length === 0 || !mapContainerRef.current || typeof window === "undefined") return;
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !mapContainerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      const bounds = withCoords.map((l) => [
        Number(l.coordinates?.lat ?? l.lat),
        Number(l.coordinates?.lng ?? l.lng),
      ]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      if (mounted) setMapReady(true);
    })();
    return () => {
      mounted = false;
      setMapReady(false);
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
  }, [list.length]);

  // Dibujar marcadores (y actualizar al cambiar selección); clic en marcador = toggle
  useEffect(() => {
    const withCoords = list.filter(
      (l) =>
        (l.coordinates?.lat != null && l.coordinates?.lng != null) ||
        (l.lat != null && l.lng != null)
    );
    if (!mapReady || !mapRef.current || !LRef.current || withCoords.length === 0) return;
    const L = LRef.current;
    const map = mapRef.current;
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch (_) {}
    });
    markersRef.current = [];
    withCoords.forEach((loc) => {
      const lat = Number(loc.coordinates?.lat ?? loc.lat);
      const lng = Number(loc.coordinates?.lng ?? loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const selected = selectedIds.has(loc.id);
      const markedByOthers = (countsByLocation[loc.id] || 0) > 0 && !selected;
      const markerClass = selected ? "marker-selected" : markedByOthers ? "marker-marked-by-others" : "";
      const icon = L.divIcon({
        className: "public-marker",
        html: `<span class="marker-pin-public ${markerClass}">${loc.id}</span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const count = countsByLocation[loc.id];
      const countText = count > 0 ? `<br/><strong>${count} ${count === 1 ? "persona marcó" : "personas marcaron"}</strong>` : "";
      marker.bindTooltip(
        `<strong>N° ${loc.id}</strong><br/>${(loc.address || "").replace(/</g, "&lt;")}${countText}<br/><em>Tocá para seleccionar</em>`,
        { permanent: false, direction: "top", className: "tooltip-public" }
      );
      marker.on("click", () => {
        if (toggleSelectRef.current) toggleSelectRef.current(loc.id);
      });
      markersRef.current.push(marker);
    });
  }, [list, selectedIds, mapReady, countsByLocation]);

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
          {totalPeople > 0 && (
            <p className="text-sm text-amber-700 mt-1 font-medium">
              {totalPeople} {totalPeople === 1 ? "persona marcó" : "personas marcaron"} ubicaciones
            </p>
          )}
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

      <main className="flex-1 flex flex-col px-4 py-4 max-w-2xl mx-auto w-full">
        {list.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <div
              ref={mapContainerRef}
              className="w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-200 h-[280px]"
            />
            <button
              type="button"
              onClick={downloadMapAsPdf}
              disabled={!mapReady || downloadingMapPdf}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-stone-800 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-900"
            >
              {downloadingMapPdf ? "Generando PDF…" : "Descargar mapa en PDF (gran formato)"}
            </button>
          </div>
        )}

        <div className="space-y-3 flex-1">
          {filtered.map((loc) => {
            const selected = selectedIds.has(loc.id);
            const markedByOthers = (countsByLocation[loc.id] || 0) > 0 && !selected;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleSelect(loc.id)}
                className={`w-full text-left rounded-xl p-4 border-2 transition-all touch-manipulation active:scale-[0.99] ${
                  selected
                    ? "bg-amber-100 border-amber-500 shadow-md"
                    : markedByOthers
                      ? "bg-sky-100 border-sky-400 shadow-sm"
                      : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      selected ? "bg-amber-500 text-white" : markedByOthers ? "bg-sky-500 text-white" : "bg-stone-200 text-stone-700"
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
                    {countsByLocation[loc.id] > 0 && (
                      <p className="text-xs text-amber-700 mt-1.5 font-medium">
                        {countsByLocation[loc.id]} {countsByLocation[loc.id] === 1 ? "persona marcó" : "personas marcaron"} este
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-2xl" aria-hidden>
                    {selected ? "✓" : markedByOthers ? "·" : "○"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-stone-500 py-8">No hay ubicaciones que coincidan con la búsqueda.</p>
        )}
      </main>

    </div>
  );
}
