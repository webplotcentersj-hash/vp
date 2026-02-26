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
    const withCoords = locations.filter(
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
  }, [mapReady, locations]);

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

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-100 z-40">
      <div className="flex items-center gap-2 p-3 bg-white border-b border-stone-200 shadow-sm flex-shrink-0">
        <Link href="/admin/ubicaciones" className="px-3 py-2 text-orange-600 hover:underline font-medium rounded-lg">
          ← Ubicaciones
        </Link>
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-xl">
          <input
            type="text"
            placeholder="Buscar dirección o lugar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-stone-200 rounded-lg text-black placeholder-stone-400"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
          >
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </form>
        <span className="text-sm text-black hidden sm:inline">{locations.length} ubicaciones</span>
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
