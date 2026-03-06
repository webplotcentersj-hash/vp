"use client";

import { useState, useEffect, useRef } from "react";

const DEFAULT_CENTER = [-31.5375, -68.5364];
const DEFAULT_ZOOM = 13;
const WHATSAPP_NUMBER = "2644442538";

export default function EmbedMapaPage() {
  const [locations, setLocations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const LRef = useRef(null);
  const toggleRef = useRef(() => {});

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;
      if (!mapContainerRef.current || mapRef.current) return;
      const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
      setMapReady(false);
    };
  }, []);

  function toggleSelect(id, status) {
    if (status !== "available") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleRef.current = toggleSelect;

  const filteredLocations = locations.filter((loc) => {
    if (filter === "available" && loc.status !== "available") return false;
    if (filter === "rented" && loc.status !== "rented") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !String(loc.id).includes(q) &&
        !(loc.address || "").toLowerCase().includes(q) &&
        !(loc.reference || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    if (!mapReady || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    markersRef.current.forEach((m) => { try { m.remove(); } catch (_) {} });
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
      const isAvailable = loc.status === "available";
      const isSelected = selectedIds.has(loc.id);
      const baseColor = isAvailable ? "#22c55e" : "#ef4444";
      const borderColor = isSelected ? "#fbbf24" : "#fff";
      const borderWidth = isSelected ? 4 : 2;
      const scale = isSelected ? 1.15 : 1;
      const icon = L.divIcon({
        className: "embed-marker-wrap",
        html: `<span class="embed-marker${isSelected ? " selected" : ""}" style="background:${baseColor};border:${borderWidth}px solid ${borderColor};transform:rotate(-45deg) scale(${scale});">${loc.id}</span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const statusLabel = isAvailable ? "Disponible" : "Ocupada";
      const addr = (loc.address || "Sin dirección").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const tooltipText = `<strong>N° ${loc.id}</strong><br/>${addr}<br/><span style="color:${baseColor};font-weight:600;">${statusLabel}</span>${isAvailable ? (isSelected ? "<br/><em>✓ Seleccionado</em>" : "<br/><em>Tocá para seleccionar</em>") : ""}`;
      marker.bindTooltip(tooltipText, { 
        permanent: false, 
        direction: "top", 
        offset: [0, -28], 
        className: "embed-tooltip" 
      });
      marker.on("click", () => {
        if (toggleRef.current) toggleRef.current(loc.id, loc.status);
      });
      markersRef.current.push(marker);
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [mapReady, filteredLocations, selectedIds]);

  function sendWhatsApp() {
    if (selectedIds.size === 0) return;
    const selectedLocs = locations.filter((l) => selectedIds.has(l.id));
    const lines = selectedLocs.map((l) => `• N° ${l.id} - ${l.address || "Sin dirección"}`);
    const text = `Hola! Me interesan las siguientes ubicaciones:\n\n${lines.join("\n")}\n\n¿Podrían darme más información?`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  const availableCount = locations.filter((l) => l.status === "available").length;
  const rentedCount = locations.filter((l) => l.status === "rented").length;
  const selectedCount = selectedIds.size;
  const shownCount = filteredLocations.length;

  return (
    <div className="embed-root">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .embed-root {
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, sans-serif;
          background: #f5f5f4;
          overflow: hidden;
        }
        .embed-header {
          background: #fff;
          border-bottom: 1px solid #e7e5e4;
          padding: 12px 16px;
        }
        .embed-header-top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .embed-header h1 {
          font-size: 16px;
          font-weight: 700;
          color: #1c1917;
        }
        .embed-header .sub {
          font-size: 12px;
          color: #78716c;
          margin-top: 2px;
        }
        .embed-selected-count {
          font-size: 12px;
          color: #57534e;
          white-space: nowrap;
          background: #f5f5f4;
          padding: 4px 10px;
          border-radius: 8px;
        }
        .embed-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }
        .embed-search {
          flex: 1;
          min-width: 120px;
          max-width: 220px;
          padding: 8px 12px;
          border: 1px solid #d6d3d1;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .embed-search:focus {
          border-color: #22c55e;
        }
        .embed-search::placeholder {
          color: #a8a29e;
        }
        .embed-filters {
          display: flex;
          gap: 4px;
        }
        .embed-filter-btn {
          padding: 6px 12px;
          border: 1px solid #d6d3d1;
          border-radius: 8px;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #57534e;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .embed-filter-btn:hover {
          background: #f5f5f4;
        }
        .embed-filter-btn.active {
          background: #1c1917;
          color: #fff;
          border-color: #1c1917;
        }
        .embed-filter-btn.active-green {
          background: #22c55e;
          color: #fff;
          border-color: #22c55e;
        }
        .embed-filter-btn.active-red {
          background: #ef4444;
          color: #fff;
          border-color: #ef4444;
        }
        .embed-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 8px 16px;
          background: #fafaf9;
          border-bottom: 1px solid #e7e5e4;
        }
        .embed-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #57534e;
        }
        .embed-legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .embed-map-wrap {
          flex: 1;
          position: relative;
          min-height: 250px;
        }
        .embed-map-container {
          position: absolute;
          inset: 0;
        }
        .embed-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e7e5e4;
          color: #57534e;
          font-size: 14px;
        }
        .embed-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 50px;
          border: none;
          background: #25d366;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(37,211,102,0.5);
          transition: all 0.2s;
          touch-action: manipulation;
        }
        .embed-fab:disabled {
          background: #a8a29e;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          cursor: not-allowed;
        }
        .embed-fab:not(:disabled):hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(37,211,102,0.6);
        }
        .embed-fab:not(:disabled):active {
          transform: scale(0.98);
        }
        .embed-fab svg {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }
        .embed-fab .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 11px;
          background: #fff;
          color: #25d366;
          font-size: 12px;
          font-weight: 800;
        }
        .embed-marker-wrap { cursor: pointer; }
        .embed-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .embed-marker.selected {
          animation: marker-pulse 1.5s ease-in-out infinite;
        }
        @keyframes marker-pulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(251,191,36,0.35), 0 2px 8px rgba(0,0,0,0.3); }
        }
        .leaflet-container { font-family: inherit; }
        .embed-tooltip {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          padding: 10px 14px;
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          max-width: 240px;
          white-space: normal;
          word-break: break-word;
        }
        .embed-tooltip em {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #78716c;
        }
        @media (max-width: 480px) {
          .embed-header { padding: 10px 12px; }
          .embed-header h1 { font-size: 15px; }
          .embed-header .sub { font-size: 11px; }
          .embed-controls { gap: 6px; margin-top: 8px; }
          .embed-search { padding: 7px 10px; font-size: 12px; max-width: 160px; }
          .embed-filter-btn { padding: 5px 8px; font-size: 11px; }
          .embed-legend { padding: 6px 12px; gap: 8px; }
          .embed-legend-item { font-size: 10px; }
          .embed-legend-dot { width: 10px; height: 10px; }
          .embed-fab { bottom: 16px; right: 16px; padding: 12px 16px; font-size: 13px; }
          .embed-fab svg { width: 20px; height: 20px; }
        }
        @media (max-width: 360px) {
          .embed-header h1 { font-size: 14px; }
          .embed-selected-count { display: none; }
          .embed-search { min-width: 100px; max-width: 130px; }
          .embed-filter-btn { padding: 5px 6px; font-size: 10px; }
          .embed-fab { padding: 10px 14px; font-size: 12px; right: 12px; bottom: 12px; }
        }
        @media (min-height: 700px) {
          .embed-map-wrap { min-height: 400px; }
        }
      `}</style>

      <header className="embed-header">
        <div className="embed-header-top">
          <div>
            <h1>Ubicaciones</h1>
            <p className="sub">{availableCount} disponibles · {rentedCount} ocupadas</p>
          </div>
          <span className="embed-selected-count">
            {selectedCount > 0 ? `${selectedCount} seleccionadas` : "Ninguna seleccionada"}
          </span>
        </div>
        <div className="embed-controls">
          <input
            type="search"
            className="embed-search"
            placeholder="Buscar N°, dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="embed-filters">
            <button
              type="button"
              className={`embed-filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Todas ({locations.length})
            </button>
            <button
              type="button"
              className={`embed-filter-btn ${filter === "available" ? "active-green" : ""}`}
              onClick={() => setFilter("available")}
            >
              Disponibles ({availableCount})
            </button>
            <button
              type="button"
              className={`embed-filter-btn ${filter === "rented" ? "active-red" : ""}`}
              onClick={() => setFilter("rented")}
            >
              Ocupadas ({rentedCount})
            </button>
          </div>
        </div>
      </header>

      <div className="embed-legend">
        <span className="embed-legend-item">
          <span className="embed-legend-dot" style={{ background: "#22c55e", border: "2px solid #fff" }} />
          Disponible
        </span>
        <span className="embed-legend-item">
          <span className="embed-legend-dot" style={{ background: "#ef4444", border: "2px solid #fff" }} />
          Ocupada
        </span>
        <span className="embed-legend-item">
          <span className="embed-legend-dot" style={{ background: "#22c55e", border: "3px solid #fbbf24" }} />
          Seleccionada
        </span>
        {(search || filter !== "all") && (
          <span className="embed-legend-item" style={{ marginLeft: "auto", fontWeight: 600 }}>
            Mostrando {shownCount} de {locations.length}
          </span>
        )}
      </div>

      <div className="embed-map-wrap">
        <div ref={mapContainerRef} className="embed-map-container" />
        {loading && <div className="embed-loading">Cargando ubicaciones…</div>}
        {!loading && !mapReady && <div className="embed-loading">Cargando mapa…</div>}
      </div>

      <button
        className="embed-fab"
        onClick={sendWhatsApp}
        disabled={selectedCount === 0}
        aria-label="Enviar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span>WhatsApp</span>
        {selectedCount > 0 && <span className="badge">{selectedCount}</span>}
      </button>
    </div>
  );
}
