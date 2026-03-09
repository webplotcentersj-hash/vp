"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;

function extractStreetKey(addr) {
  if (!addr || !addr.trim()) return "Sin calle";
  const t = addr.trim();
  const withoutTrailingNum = t.replace(/\s+\d+[\s,]*$/, "").trim();
  return withoutTrailingNum || t;
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
  const [showStreetTraces, setShowStreetTraces] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleRef = useRef(() => {});

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

  const streetsWithCount = useMemo(() => {
    const withCoords = filteredLocations.filter(
      (l) => (l.coordinates?.lat != null && l.coordinates?.lng != null) || (l.lat != null && l.lng != null)
    );
    const byStreet = {};
    withCoords.forEach((loc) => {
      const key = extractStreetKey(loc.address);
      if (!byStreet[key]) byStreet[key] = [];
      byStreet[key].push(loc);
    });
    return Object.entries(byStreet)
      .map(([street, locs]) => ({ street, locs, count: locs.length }))
      .filter((x) => x.count >= 1)
      .sort((a, b) => b.count - a.count);
  }, [filteredLocations]);

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
      marker.on("click", () => { if (toggleRef.current) toggleRef.current(loc.id); });
      markersRef.current.push(marker);
    });

    if (showStreetTraces && streetsWithCount.length > 0) {
      const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
      streetsWithCount.forEach(({ street, locs, count }, i) => {
        if (count < 2) return;
        const points = locs
          .map((l) => {
            const lat = Number(l.coordinates?.lat ?? l.lat);
            const lng = Number(l.coordinates?.lng ?? l.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
          })
          .filter(Boolean);
        if (points.length < 2) return;
        points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const poly = L.polyline(points, {
          color: colors[i % colors.length],
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
        poly.bindTooltip(`<strong>${street.replace(/</g, "&lt;")}</strong><br/>${count} ubicaciones`, {
          permanent: false,
          direction: "top",
          className: "tooltip-trace",
        });
        polylinesRef.current.push(poly);
      });
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mapReady, filteredLocations, showStreetTraces, streetsWithCount, selectedIds]);

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
          onClick={() => setShowStreetTraces((v) => !v)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${
            showStreetTraces ? "bg-blue-600 text-white border-blue-600" : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
          }`}
        >
          {showStreetTraces ? "Ocultar trazados" : "Trazar por calles"}
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
        {showStreetTraces && streetsWithCount.length > 0 && (
          <div className="absolute top-2 right-2 bottom-2 w-56 max-h-[70vh] overflow-auto bg-white/95 backdrop-blur rounded-xl border border-stone-200 shadow-lg p-3 z-[1000]">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Calles por cantidad</p>
            <div className="space-y-1.5">
              {streetsWithCount.map(({ street, count }) => (
                <div
                  key={street}
                  className="flex justify-between items-center text-sm py-1.5 px-2 rounded-lg bg-stone-50 hover:bg-stone-100"
                >
                  <span className="text-stone-800 truncate flex-1" title={street}>{street}</span>
                  <span className="font-bold text-orange-600 ml-2 flex-shrink-0">{count}</span>
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
