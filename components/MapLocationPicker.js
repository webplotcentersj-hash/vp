"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 13;

export default function MapLocationPicker({ locations = [], selectedIds = [], onToggle, height = "400px" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const markersRef = useRef({});
  const [mapReady, setMapReady] = useState(false);

  const withCoords = locations.filter(
    (loc) =>
      (loc.coordinates?.lat != null && loc.coordinates?.lng != null) ||
      (loc.lat != null && loc.lng != null)
  );
  const getLat = (loc) => Number(loc.coordinates?.lat ?? loc.lat);
  const getLng = (loc) => Number(loc.coordinates?.lng ?? loc.lng);

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
      LRef.current = null;
      markersRef.current = {};
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return;
    const map = mapRef.current;
    const L = LRef.current;

    Object.values(markersRef.current).forEach((m) => {
      try { m.remove(); } catch (_) {}
    });
    markersRef.current = {};

    const bounds = [];
    withCoords.forEach((loc) => {
      const latitude = getLat(loc);
      const longitude = getLng(loc);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      bounds.push([latitude, longitude]);
      const isSelected = selectedIds.includes(loc.id);
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<span class="marker-pin ${isSelected ? "selected" : ""}">${loc.id}</span>`,
        iconSize: [28, 42],
        iconAnchor: [14, 42],
      });
      const marker = L.marker([latitude, longitude], { icon })
        .addTo(map)
        .on("click", () => onToggle?.(loc.id));
      marker.bindTooltip(`N° ${loc.id} – ${(loc.address || "Sin dirección").slice(0, 45)}${(loc.address || "").length > 45 ? "…" : ""}`, {
        permanent: false,
        direction: "top",
        offset: [0, -20],
      });
      markersRef.current[loc.id] = marker;
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [mapReady, locations]);

  useEffect(() => {
    Object.keys(markersRef.current).forEach((id) => {
      const marker = markersRef.current[id];
      const el = marker?.getElement?.();
      const pin = el?.querySelector?.(".marker-pin");
      if (pin) pin.classList.toggle("selected", selectedIds.includes(Number(id)));
    });
  }, [selectedIds]);

  return (
    <div className="rounded-xl overflow-hidden border-2 border-stone-200 shadow-lg bg-stone-100">
      {withCoords.length === 0 && locations.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 border-b border-amber-200">
          Ninguna ubicación de la base de datos tiene lat/lng. Cargá coordenadas en Ubicaciones para ver marcadores en el mapa.
        </p>
      )}
      <div ref={containerRef} style={{ height }} className="w-full z-0" />
      <style jsx global>{`
        .custom-marker { background: none; border: none; }
        .marker-pin {
          width: 26px; height: 26px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: #f97316;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
        }
        .marker-pin.selected {
          background: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.5);
        }
        .leaflet-tooltip { font-size: 12px; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
    </div>
  );
}
