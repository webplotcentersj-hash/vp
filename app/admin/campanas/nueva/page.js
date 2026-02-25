"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiCall } from "@/lib/api";

const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), { ssr: false });

export default function NuevaCampanaPage() {
  const router = useRouter();
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    name: "",
    product: "",
    audience: "",
    slogan: "",
    objective: "",
    status: "draft",
    startDate: "",
    endDate: "",
    budget: "",
    locations: [],
    locationLinks: {}, // { [locationId]: { url: "", name: "" } } — link trackable por chupete
  });
  const [loading, setLoading] = useState(false);
  const [loadingLocs, setLoadingLocs] = useState(true);

  // Cargar todas las ubicaciones desde la base de datos (el mapa muestra solo las que tienen lat/lng)
  useEffect(() => {
    apiCall("locations")
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingLocs(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (form.locations.length === 0) {
      alert("Selecciona al menos una ubicación en el mapa o en la lista.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall("campaigns", "POST", {
        ...form,
        budget: form.budget !== "" ? form.budget : 0,
        locations: form.locations.map((id) => ({
          id: Number(id),
          justification: "",
          linkUrl: (form.locationLinks[id]?.url || "").trim(),
          linkName: (form.locationLinks[id]?.name || "").trim() || `Chupete N° ${id}`,
        })),
      });
      if (res?.success) {
        router.push(res.id ? `/admin/campanas/${res.id}/editar` : "/admin/campanas");
      } else alert(res?.message || "Error");
    } catch (err) {
      try {
        const data = JSON.parse(err.message);
        alert(data.message + (data.error ? "\n\nDetalle: " + data.error : ""));
      } catch (_) {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleLocation(id) {
    setForm((f) => {
      if (f.locations.includes(id)) {
        const nextLinks = { ...f.locationLinks };
        delete nextLinks[id];
        return { ...f, locations: f.locations.filter((x) => x !== id), locationLinks: nextLinks };
      }
      const loc = locations.find((l) => l.id === id);
      if (loc && loc.status !== "available") return f;
      return { ...f, locations: [...f.locations, id], locationLinks: { ...f.locationLinks, [id]: { url: "", name: "" } } };
    });
  }

  function setLocationLink(id, field, value) {
    setForm((f) => ({
      ...f,
      locationLinks: {
        ...f.locationLinks,
        [id]: { ...(f.locationLinks[id] || { url: "", name: "" }), [field]: value },
      },
    }));
  }

  const withCoords = locations.filter(
    (l) => (l.coordinates?.lat != null && l.coordinates?.lng != null) || (l.lat != null && l.lng != null)
  );
  const withoutCoords = locations.filter(
    (l) => (l.coordinates?.lat == null && l.coordinates?.lng == null) && (l.lat == null || l.lng == null)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/campanas" className="text-orange-600 hover:underline font-medium">← Campañas</Link>
        <h1 className="text-2xl md:text-3xl font-bold text-black">Nueva campaña</h1>
      </div>

      <p className="text-black text-sm">
        Tocá los marcadores en el mapa para sumar o quitar ubicaciones. Las que elijas se marcan en verde.
      </p>

      {/* Mapa: ubicaciones de la base de datos (OpenStreetMap) */}
      <div className="rounded-2xl overflow-hidden shadow-xl border border-stone-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-black mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Mapa – ubicaciones de la base de datos
        </h2>
        <p className="text-xs text-black mb-2">Se muestran todas las ubicaciones con coordenadas (lat/lng). Tocá un marcador para sumarlo o quitarlo de la campaña.</p>
        {loadingLocs ? (
          <div className="h-[380px] flex items-center justify-center bg-stone-100 rounded-xl text-black">Cargando mapa…</div>
        ) : (
          <MapLocationPicker
            locations={locations}
            selectedIds={form.locations}
            onToggle={toggleLocation}
            height="380px"
          />
        )}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna datos */}
        <div className="space-y-4 bg-white rounded-2xl border border-stone-200 shadow-lg p-6">
          <h2 className="text-lg font-bold text-black border-b border-stone-200 pb-2">Datos de la campaña</h2>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Nombre *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Ej: Se Vende"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Producto</label>
              <input
                value={form.product}
                onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: La misma Vía"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Público</label>
              <input
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                placeholder="Ej: Todos"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Slogan</label>
            <input
              value={form.slogan}
              onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))}
              className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
              placeholder="Ej: SE VENDE"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Fecha inicio *</label>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Fecha fin *</label>
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Presupuesto</label>
            <input
              type="number"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Columna ubicaciones + enviar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-6">
            <h2 className="text-lg font-bold text-black border-b border-stone-200 pb-2 mb-3">
              Ubicaciones elegidas ({form.locations.length})
            </h2>
            <p className="text-black text-sm mb-3">La app genera el <strong>link trackable</strong> a partir de la URL que quieras trackear: ingresá la URL destino y al crear la campaña se generará un link corto que redirige ahí y registra los clicks. En Editar campaña podrás ver el QR con el número de chupete para imprimir.</p>
            {form.locations.length === 0 ? (
              <p className="text-black text-sm">Tocá los marcadores en el mapa o marcá abajo.</p>
            ) : (
              <ul className="space-y-4 max-h-[420px] overflow-y-auto">
                {form.locations.map((id) => {
                  const loc = locations.find((l) => l.id === id);
                  const link = form.locationLinks[id] || { url: "", name: "" };
                  return (
                    <li key={id} className="border border-stone-200 rounded-lg p-3 bg-stone-50/50">
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        {loc ? `N° ${loc.id} – ${loc.address || "Sin dirección"}` : `N° ${id}`}
                        <button
                          type="button"
                          onClick={() => toggleLocation(id)}
                          className="ml-auto text-red-600 hover:underline text-xs"
                        >
                          Quitar
                        </button>
                      </div>
                      <p className="text-xs text-black mb-1.5">URL a trackear (la app generará un link corto y podrás obtener el QR en Editar)</p>
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/landing..."
                        value={link.url}
                        onChange={(e) => setLocationLink(id, "url", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-lg mb-1.5 focus:ring-2 focus:ring-orange-500"
                      />
                      <input
                        type="text"
                        placeholder="Nombre del link (ej: Landing chupete 139)"
                        value={link.name}
                        onChange={(e) => setLocationLink(id, "name", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {withoutCoords.length > 0 && (
              <>
                <p className="text-black text-xs mt-3 mb-1">Sin coordenadas en mapa (elegir por lista):</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border rounded-lg p-2 bg-stone-50">
                  {withoutCoords.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.locations.includes(l.id)}
                        onChange={() => toggleLocation(l.id)}
                        className="rounded border-stone-400 text-orange-600 focus:ring-orange-500"
                      />
                      N° {l.id} – {l.address}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-xl border-2 border-stone-300 text-black font-medium hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || form.locations.length === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creando…" : "Crear campaña"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
