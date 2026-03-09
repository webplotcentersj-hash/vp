"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;
const TRACE_BUFFER_M = 45; // metros de tolerancia a cada lado de la línea

function distMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function closestPointOnSegment(latP, lngP, latA, lngA, latB, lngB) {
  const dx = lngB - lngA;
  const dy = latB - latA;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-18) return [latA, lngA];
  let t = ((lngP - lngA) * dx + (latP - latA) * dy) / d2;
  t = Math.max(0, Math.min(1, t));
  return [latA + t * dy, lngA + t * dx];
}

function locsWithinLine(locs, latA, lngA, latB, lngB, bufferM) {
  return locs.filter((loc) => {
    const lat = Number(loc.coordinates?.lat ?? loc.lat);
    const lng = Number(loc.coordinates?.lng ?? loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const [qLat, qLng] = closestPointOnSegment(lat, lng, latA, lngA, latB, lngB);
    return distMeters(lat, lng, qLat, qLng) <= bufferM;
  });
}

export default function MapaPantallaCompletaPage() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const LRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [downloadingMapPdf, setDownloadingMapPdf] = useState(false);
  const [filterNumber, setFilterNumber] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStreet, setFilterStreet] = useState("");
  const [manualTraceMode, setManualTraceMode] = useState(false);
  const [traceStart, setTraceStart] = useState(null);
  const [traceEnd, setTraceEnd] = useState(null);
  const [tracedLocs, setTracedLocs] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleRef = useRef(() => {});
  const traceStartRef = useRef(null);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  toggleRef.current = toggleSelect;

  const filteredLocations = locations.filter((loc) => {
    if (filterNumber.trim()) {
      const num = filterNumber.trim();
      if (!String(loc.id).includes(num)) return false;
    }
    if (filterStatus !== "all") {
      if (filterStatus === "available" && loc.status !== "available") return false;
      if (filterStatus === "rented" && loc.status !== "rented") return false;
    }
    if (filterStreet.trim()) {
      const q = filterStreet.toLowerCase();
      const addr = (loc.address || "").toLowerCase();
      const ref = (loc.reference || "").toLowerCase();
      if (!addr.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    apiCall("locations").then((data) => setLocations(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    (async () => {
      const L = (await import("leaflet")).default;
      LRef.current = L;
      if (!containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
      LRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return;
    const map = mapRef.current;
    const L = LRef.current;
    markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
    markersRef.current = [];
    polylinesRef.current.forEach((p) => { try { map.removeLayer(p); } catch (_) {} });
    polylinesRef.current = [];

    const withCoords = filteredLocations.filter(
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
      const isAvailable = loc.status === "available";
      const isSelected = selectedIds.has(loc.id);
      const color = isAvailable ? "#22c55e" : "#ef4444";
      const borderStyle = isSelected ? "3px solid #fbbf24" : "2px solid #fff";
      const icon = L.divIcon({
        className: "fullscreen-marker",
        html: `<span class="marker-pin-fs" style="background:${color};border:${borderStyle}">${loc.id}</span>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindTooltip(
        `<strong>Chupete N° ${loc.id}</strong><br/>${(loc.address || "Sin dirección").replace(/</g, "&lt;")}<br/><span style="color:${color};font-weight:600;">${isAvailable ? "Disponible" : "Alquilado"}</span>${isSelected ? "<br/><em>✓ Seleccionado</em>" : "<br/><em>Tocá para seleccionar</em>"}`,
        { permanent: false, direction: "top", offset: [0, -24], className: "tooltip-fs" }
      );
      marker.on("click", (e) => {
        if (manualTraceMode) {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          const pt = { lat, lng, loc };
          const start = traceStartRef.current;
          if (!start) {
            traceStartRef.current = pt;
            setTraceStart(pt);
            setTraceEnd(null);
            setTracedLocs([]);
          } else {
            const withCoords = filteredLocations.filter(
              (l) =>
                (l.coordinates?.lat != null && l.coordinates?.lng != null) || (l.lat != null && l.lng != null)
            );
            setTraceEnd(pt);
            setTracedLocs(locsWithinLine(withCoords, start.lat, start.lng, pt.lat, pt.lng, TRACE_BUFFER_M));
            traceStartRef.current = null;
          }
        } else if (toggleRef.current) {
          toggleRef.current(loc.id);
        }
      });
      markersRef.current.push(marker);
    });

    if (traceStart && traceEnd) {
      const poly = L.polyline(
        [
          [traceStart.lat, traceStart.lng],
          [traceEnd.lat, traceEnd.lng],
        ],
        { color: "#ea580c", weight: 5, opacity: 0.9, dashArray: "8, 6" }
      ).addTo(map);
      polylinesRef.current.push(poly);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mapReady, filteredLocations, selectedIds, manualTraceMode, traceStart, traceEnd]);

  function clearTrace() {
    traceStartRef.current = null;
    setTraceStart(null);
    setTraceEnd(null);
    setTracedLocs([]);
  }

  function goToNumber() {
    const num = filterNumber.trim();
    if (!num || !mapRef.current) return;
    const loc = filteredLocations.find((l) => String(l.id) === num);
    if (loc) {
      const lat = Number(loc.coordinates?.lat ?? loc.lat);
      const lng = Number(loc.coordinates?.lng ?? loc.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.current.setView([lat, lng], 17);
      }
    }
  }

  async function downloadMapAsPdf() {
    if (!containerRef.current) return;
    setDownloadingMapPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { PDFDocument } = await import("pdf-lib");
      const canvas = await html2canvas(containerRef.current, {
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
      page.drawImage(img, { x: (pageWidth - w) / 2, y: pageHeight - h, width: w, height: h });
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

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-100 z-40">
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-b border-stone-200 shadow-sm flex-shrink-0">
        <Link href="/admin/ubicaciones" className="px-3 py-2 text-orange-600 hover:underline font-medium rounded-lg">
          ← Ubicaciones
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-black font-medium">Filtros:</span>
          <input
            type="text"
            placeholder="Por número (chupete)"
            value={filterNumber}
            onChange={(e) => setFilterNumber(e.target.value)}
            className="w-28 px-3 py-2 border border-stone-200 rounded-lg text-black placeholder-stone-400"
          />
          <button
            type="button"
            onClick={goToNumber}
            className="px-3 py-2 bg-stone-600 text-white rounded-lg hover:bg-stone-700 text-sm"
          >
            Ir al N°
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-black bg-white"
          >
            <option value="all">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="rented">Alquilado</option>
          </select>
          <input
            type="text"
            placeholder="Por calle"
            value={filterStreet}
            onChange={(e) => setFilterStreet(e.target.value)}
            className="w-36 px-3 py-2 border border-stone-200 rounded-lg text-black placeholder-stone-400"
          />
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/30 ring-2 ring-orange-400/50">
          <span className="opacity-90 text-xs font-medium uppercase tracking-wider">Ubicaciones</span>
          <span className="tabular-nums">{filteredLocations.length}</span>
          <span className="opacity-80">/</span>
          <span className="tabular-nums opacity-90">{locations.length}</span>
        </div>
        {selectedIds.size > 0 && (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300">
            <span className="font-bold text-amber-800">{selectedIds.size} seleccionados</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-amber-700 hover:underline"
            >
              Limpiar
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (manualTraceMode) clearTrace();
            setManualTraceMode((v) => !v);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${
            manualTraceMode ? "bg-orange-600 text-white border-orange-600" : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
          }`}
        >
          {manualTraceMode ? "Cancelar trazado" : "Trazar manualmente"}
        </button>
        <button
          type="button"
          onClick={downloadMapAsPdf}
          disabled={!mapReady || downloadingMapPdf}
          className="px-4 py-2 bg-stone-700 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm font-medium"
        >
          {downloadingMapPdf ? "Generando…" : "Descargar mapa en PDF"}
        </button>
      </div>
      <div className="flex-1 flex min-h-0 relative">
        <div ref={containerRef} className="flex-1 w-full min-h-0" />
        {manualTraceMode && !traceStart && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium shadow-lg">
            Tocá un chupete para empezar
          </div>
        )}
        {manualTraceMode && traceStart && !traceEnd && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow-lg animate-pulse">
            Tocá el chupete final
          </div>
        )}
        {tracedLocs.length > 0 && (
          <div className="absolute top-2 right-2 w-72 max-h-[70vh] overflow-auto bg-white/95 backdrop-blur rounded-xl border border-stone-200 shadow-lg p-3 z-[1000]">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                En la línea: {tracedLocs.length} ubicaciones
              </p>
              <button
                type="button"
                onClick={clearTrace}
                className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
              >
                Limpiar
              </button>
            </div>
            <div className="space-y-1.5">
              {tracedLocs.map((loc) => (
                <div
                  key={loc.id}
                  className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg bg-stone-50 hover:bg-stone-100"
                >
                  <span className="text-stone-800 truncate flex-1" title={loc.address}>
                    N°{loc.id} · {(loc.address || "Sin dirección").slice(0, 35)}
                    {(loc.address || "").length > 35 ? "…" : ""}
                  </span>
                  <span
                    className={`ml-2 flex-shrink-0 font-semibold ${
                      loc.status === "available" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {loc.status === "available" ? "Disp." : "Ocup."}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .fullscreen-marker { background: none; border: none; cursor: pointer; }
        .marker-pin-fs {
          width: 28px; height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
        }
        .tooltip-fs { font-size: 13px; }
        .tooltip-trace { font-size: 12px; padding: 6px 10px; }
      `}</style>
    </div>
  );
}
