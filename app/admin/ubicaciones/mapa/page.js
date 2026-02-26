"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiCall } from "@/lib/api";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 12;

export default function MapaPantallaCompletaPage() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [downloadingMapPdf, setDownloadingMapPdf] = useState(false);
  const [filterNumber, setFilterNumber] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const filteredLocations = locations.filter((loc) => {
    if (filterNumber.trim()) {
      const num = filterNumber.trim();
      if (!String(loc.id).includes(num)) return false;
    }
    if (filterStatus !== "all") {
      if (filterStatus === "available" && loc.status !== "available") return false;
      if (filterStatus === "rented" && loc.status !== "rented") return false;
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
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch (_) {}
    });
    markersRef.current = [];
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
      const icon = L.divIcon({
        className: "fullscreen-marker",
        html: `<span class="marker-pin-fs">${loc.id}</span>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindTooltip(
        `<strong>Chupete N° ${loc.id}</strong><br/>${(loc.address || "Sin dirección").replace(/</g, "&lt;")}`,
        { permanent: false, direction: "top", offset: [0, -24], className: "tooltip-fs" }
      );
      markersRef.current.push(marker);
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mapReady, filteredLocations]);

  async function handleSearch(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": "es", "User-Agent": "PlotCenter-Ubicaciones/1.0" } }
      );
      const data = await res.json();
      if (data && data[0] && mapRef.current) {
        const { lat, lon } = data[0];
        mapRef.current.setView([Number(lat), Number(lon)], 16);
      } else {
        alert("No se encontraron resultados para \"" + q + "\".");
      }
    } catch (err) {
      alert("Error al buscar: " + (err.message || err));
    } finally {
      setSearching(false);
    }
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
        </div>
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 min-w-[200px] max-w-xl">
          <input
            type="text"
            placeholder="Buscar dirección o lugar en el mapa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-stone-200 rounded-lg text-black placeholder-stone-400"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
          >
            {searching ? "…" : "Buscar"}
          </button>
        </form>
        <span className="text-sm text-black">
          {filteredLocations.length} de {locations.length} ubicaciones
        </span>
        <button
          type="button"
          onClick={downloadMapAsPdf}
          disabled={!mapReady || downloadingMapPdf}
          className="px-4 py-2 bg-stone-700 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 text-sm font-medium"
        >
          {downloadingMapPdf ? "Generando…" : "Descargar mapa en PDF"}
        </button>
      </div>
      <div ref={containerRef} className="flex-1 w-full min-h-0" />
      <style jsx global>{`
        .fullscreen-marker { background: none; border: none; }
        .marker-pin-fs {
          width: 28px; height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: #f97316;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
        }
        .tooltip-fs { font-size: 13px; }
      `}</style>
    </div>
  );
}
