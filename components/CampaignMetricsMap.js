"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 13;

export default function CampaignMetricsMap({ locations = [], locationClicks = {}, height = "320px" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);

  const withCoords = locations.filter(
    (l) => (l.coordinates?.lat != null && l.coordinates?.lng != null) || (l.lat != null && l.lng != null)
  );
  const getLat = (l) => Number(l.coordinates?.lat ?? l.lat);
  const getLng = (l) => Number(l.coordinates?.lng ?? l.lng);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;
    (async () => {
      const L = (await import("leaflet")).default;
      LRef.current = L;
      if (!containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const map = mapRef.current;
    const L = LRef.current;
    markersRef.current.forEach((m) => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];
    const bounds = [];
    withCoords.forEach((loc) => {
      const lat = getLat(loc);
      const lng = getLng(loc);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      bounds.push([lat, lng]);
      const clicks = locationClicks[loc.id] ?? 0;
      const icon = L.divIcon({
        className: "metrics-marker",
        html: `<span class="metrics-pin"><span class="metrics-num">${loc.id}</span><span class="metrics-clicks">${clicks}</span></span>`,
        iconSize: [44, 52],
        iconAnchor: [22, 52],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindTooltip(`Chupete N° ${loc.id} – ${(loc.address || "").slice(0, 40)}… · ${clicks} clicks`, { permanent: false, direction: "top" });
      markersRef.current.push(marker);
    });
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [ready, locations, locationClicks]);

  return (
    <div className="rounded-xl overflow-hidden border-2 border-stone-200 bg-stone-100">
      <div ref={containerRef} style={{ height }} className="w-full" />
      <style jsx global>{`
        .metrics-marker { background: none; border: none; }
        .metrics-pin {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 42px; min-height: 42px; padding: 2px 0;
          border-radius: 8px; background: #ea580c; border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .metrics-num { font-size: 14px; font-weight: 700; color: #fff; }
        .metrics-clicks { font-size: 11px; color: rgba(255,255,255,0.9); }
      `}</style>
    </div>
  );
}
