"use client";

import { useState, useEffect, useMemo } from "react";
import { apiCall } from "@/lib/api";

const DAYS_WARNING = 30;
const DAYS_URGENT = 7;

function getDaysUntil(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (24 * 60 * 60 * 1000));
}

function getExpiryStatus(endDate) {
  const days = getDaysUntil(endDate);
  if (days === null) return null;
  if (days < 0) return "vencido";
  if (days <= DAYS_URGENT) return "urgente";
  if (days <= DAYS_WARNING) return "por_vencer";
  return "ok";
}

export default function AlquileresPage() {
  const [rentals, setRentals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ locationId: "", clientId: "", startDate: "", endDate: "" });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let activos = 0;
    let porVencer = 0;
    let urgentes = 0;
    let vencidos = 0;
    rentals.forEach((r) => {
      if (!r.endDate) return;
      if (r.endDate < today) vencidos++;
      else {
        activos++;
        const days = getDaysUntil(r.endDate);
        if (days <= DAYS_URGENT) urgentes++;
        else if (days <= DAYS_WARNING) porVencer++;
      }
    });
    return { activos, porVencer, urgentes, vencidos };
  }, [rentals]);

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

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <p className="text-sm font-semibold text-green-700">Activos</p>
          <p className="text-2xl font-black text-black mt-1">{stats.activos}</p>
          <p className="text-xs text-stone-500 mt-0.5">Alquileres vigentes</p>
        </div>
        <div className="p-5 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <p className="text-sm font-semibold text-amber-700">Por vencer (30 d)</p>
          <p className="text-2xl font-black text-black mt-1">{stats.porVencer}</p>
          <p className="text-xs text-stone-500 mt-0.5">Próximos 30 días</p>
        </div>
        <div className="p-5 rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50">
          <p className="text-sm font-semibold text-orange-700">Urgentes (7 d)</p>
          <p className="text-2xl font-black text-black mt-1">{stats.urgentes}</p>
          <p className="text-xs text-stone-500 mt-0.5">Vencen en 7 días</p>
        </div>
        <div className="p-5 rounded-2xl border-2 border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100">
          <p className="text-sm font-semibold text-stone-600">Total</p>
          <p className="text-2xl font-black text-black mt-1">{rentals.length}</p>
          <p className="text-xs text-stone-500 mt-0.5">Todos los alquileres</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
          Por vencer (30 días)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-orange-100 border border-orange-300" />
          Urgente (7 días)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-red-100 border border-red-300" />
          Vencido
        </span>
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
            {rentals.map((r) => {
              const status = getExpiryStatus(r.endDate);
              const rowClass =
                status === "urgente"
                  ? "border-t border-stone-100 bg-orange-50 hover:bg-orange-100"
                  : status === "por_vencer"
                    ? "border-t border-stone-100 bg-amber-50 hover:bg-amber-100"
                    : status === "vencido"
                      ? "border-t border-stone-100 bg-red-50/50 hover:bg-red-50"
                      : "border-t border-stone-100 hover:bg-stone-50";
              const days = getDaysUntil(r.endDate);
              const badge =
                status === "urgente"
                  ? { text: `${days} días`, class: "bg-orange-500 text-white" }
                  : status === "por_vencer"
                    ? { text: `${days} días`, class: "bg-amber-500 text-white" }
                    : status === "vencido"
                      ? { text: "Vencido", class: "bg-red-500 text-white" }
                      : null;
              return (
              <tr key={r.id} className={rowClass}>
                <td className="p-3 font-medium">{r.locationId}</td>
                <td className="p-3">{r.locationAddress}</td>
                <td className="p-3">{r.clientName}</td>
                <td className="p-3">{r.startDate}</td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    {r.endDate}
                    {badge && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${badge.class}`}>
                        {badge.text}
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => { setForm({ locationId: r.locationId, clientId: r.clientId, startDate: r.startDate, endDate: r.endDate }); setModal({ id: r.id }); }} className="text-blue-600 hover:underline mr-2">Editar</button>
                  <button onClick={() => endRental(r.id)} className="text-amber-600 hover:underline">Finalizar</button>
                </td>
              </tr>
            );
            })}
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
