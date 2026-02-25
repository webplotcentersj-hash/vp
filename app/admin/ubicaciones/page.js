"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function UbicacionesPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ address: "", reference: "", measurements: "", lat: "", lng: "" });

  async function load() {
    try {
      const data = await apiCall("locations");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = list.filter(
    (l) =>
      (l.address || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.reference || "").toLowerCase().includes(search.toLowerCase()) ||
      String(l.id).includes(search)
  );

  async function save(e) {
    e.preventDefault();
    try {
      if (modal?.id) {
        await apiCall("locations", "PUT", { ...form, id: modal.id });
      } else {
        await apiCall("locations", "POST", form);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("¿Eliminar esta ubicación?")) return;
    try {
      await apiCall(`locations?id=${id}`, "DELETE");
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function openEdit(loc) {
    setForm({
      address: loc.address ?? "",
      reference: loc.reference ?? "",
      measurements: loc.measurements ?? "",
      lat: loc.coordinates?.lat ?? loc.lat ?? "",
      lng: loc.coordinates?.lng ?? loc.lng ?? "",
    });
    setModal({ id: loc.id });
  }

  if (loading) return <div className="py-12 text-stone-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-800">Ubicaciones</h1>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/api/locations/export-pdf");
                if (!res.ok) throw new Error(await res.text());
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ubicaciones-${new Date().toISOString().slice(0, 10)}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                alert("Error al generar el PDF: " + (e.message || e));
              }
            }}
            className="px-4 py-2 bg-stone-700 text-white rounded-lg hover:bg-stone-800 inline-flex items-center gap-2"
          >
            Descargar PDF
          </button>
          <button
            onClick={() => {
              setForm({ address: "", reference: "", measurements: "", lat: "", lng: "" });
              setModal({});
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Nueva ubicación
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-stone-500 text-sm uppercase">
            <tr>
              <th className="p-3">N°</th>
              <th className="p-3">Dirección</th>
              <th className="p-3">Referencia</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((loc) => (
              <tr key={loc.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="p-3 font-medium">{loc.id}</td>
                <td className="p-3">{loc.address}</td>
                <td className="p-3 text-sm text-stone-600">{loc.reference || "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${loc.status === "available" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {loc.status === "available" ? "Disponible" : "Alquilado"}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => openEdit(loc)} className="text-blue-600 hover:underline mr-2">Editar</button>
                  <button onClick={() => remove(loc.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{modal.id ? "Editar" : "Nueva"} ubicación</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Dirección</label>
                <input required value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Referencia</label>
                <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Medidas</label>
                <input value={form.measurements} onChange={(e) => setForm((f) => ({ ...f, measurements: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Lat</label>
                  <input required type="number" step="any" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Lng</label>
                  <input required type="number" step="any" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 bg-stone-200 rounded-lg hover:bg-stone-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
