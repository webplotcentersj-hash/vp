"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 14;

export default function EditableLocationMap({ lat, lng, onMove, height = "280px" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const [ready, setReady] = useState(false);

  const hasCoords = lat != null && lng != null && lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const initialLat = hasCoords ? Number(lat) : DEFAULT_CENTER[0];
  const initialLng = hasCoords ? Number(lng) : DEFAULT_CENTER[1];

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;
      LRef.current = L;
      if (mapRef.current) return;
      const map = L.map(containerRef.current).setView([initialLat, initialLng], DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: "editable-marker",
        html: '<span class="marker-dot">📍</span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });
      const marker = L.marker([initialLat, initialLng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onMove?.(pos.lat, pos.lng);
      });
      markerRef.current = marker;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      LRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !markerRef.current || !hasCoords) return;
    const newLat = Number(lat);
    const newLng = Number(lng);
    if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return;
    markerRef.current.setLatLng([newLat, newLng]);
  }, [ready, lat, lng, hasCoords]);

  return (
    <div className="rounded-lg overflow-hidden border border-stone-200 bg-stone-100">
      <p className="text-xs text-black px-2 py-1.5 bg-stone-100 border-b border-stone-200">Arrastrá el marcador para ubicar. Las coordenadas se actualizan al soltar.</p>
      <div ref={containerRef} style={{ height }} className="w-full z-0" />
      <style jsx global>{`
        .editable-marker { background: none; border: none; }
        .marker-dot { font-size: 28px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
      `}</style>
    </div>
  );
}
