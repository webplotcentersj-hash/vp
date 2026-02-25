"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function AlquileresPage() {
  const [rentals, setRentals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ locationId: "", clientId: "", startDate: "", endDate: "" });

  async function load() {
    try {
      const [r, locs, cl] = await Promise.all([
        apiCall("rentals"),
        apiCall("locations"),
        apiCall("clients"),
      ]);
      setRentals(Array.isArray(r) ? r : []);
      setLocations(Array.isArray(locs) ? locs : []);
      setClients(Array.isArray(cl) ? cl : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    try {
      if (modal?.id) {
        await apiCall("rentals", "PUT", { ...form, id: modal.id });
      } else {
        await apiCall("rentals", "POST", form);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function endRental(id) {
    if (!confirm("¿Finalizar este alquiler? La ubicación quedará disponible.")) return;
    try {
      await apiCall("rentals", "PUT", { id, action: "end" });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="py-12 text-black">Cargando...</div>;

  const availableLocations = locations.filter((l) => l.status === "available" || (modal?.id && form.locationId === l.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-black">Alquileres</h1>
        <button
          onClick={() => {
            setForm({ locationId: availableLocations[0]?.id ?? "", clientId: clients[0]?.id ?? "", startDate: "", endDate: "" });
            setModal({});
          }}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          Nuevo alquiler
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-black text-sm uppercase">
            <tr>
              <th className="p-3">N° Chupete</th>
              <th className="p-3">Ubicación</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Desde</th>
              <th className="p-3">Hasta</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rentals.map((r) => (
              <tr key={r.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="p-3 font-medium">{r.locationId}</td>
                <td className="p-3">{r.locationAddress}</td>
                <td className="p-3">{r.clientName}</td>
                <td className="p-3">{r.startDate}</td>
                <td className="p-3">{r.endDate}</td>
                <td className="p-3">
                  <button onClick={() => { setForm({ locationId: r.locationId, clientId: r.clientId, startDate: r.startDate, endDate: r.endDate }); setModal({ id: r.id }); }} className="text-blue-600 hover:underline mr-2">Editar</button>
                  <button onClick={() => endRental(r.id)} className="text-amber-600 hover:underline">Finalizar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{modal.id ? "Editar" : "Nuevo"} alquiler</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Ubicación</label>
                <select required value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>N° {l.id} - {l.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Cliente</label>
                <select required value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Desde</label>
                  <input required type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Hasta</label>
                  <input required type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 bg-stone-200 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
