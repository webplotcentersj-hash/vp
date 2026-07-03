"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { apiCall } from "@/lib/api";
import { daysUntilIso, formatDateEs, todayIso, toIsoDateString } from "@/lib/dateUtils";

const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), { ssr: false });

const DAYS_WARNING = 30;
const DAYS_URGENT = 7;

const EMPTY_NEW_FORM = {
  clientId: "",
  startDate: "",
  endDate: "",
  locationIds: [],
  locationSearch: "",
};

function getDaysUntil(endDate) {
  return daysUntilIso(endDate);
}

function getExpiryStatus(endDate) {
  const days = getDaysUntil(endDate);
  if (days === null) return null;
  if (days < 0) return "vencido";
  if (days <= DAYS_URGENT) return "urgente";
  if (days <= DAYS_WARNING) return "por_vencer";
  return "ok";
}

function rentalOverlapsRange(rental, startDate, endDate, locationId) {
  if (Number(rental.locationId) !== Number(locationId)) return false;
  const rStart = toIsoDateString(rental.startDate);
  const rEnd = toIsoDateString(rental.endDate);
  return rStart <= endDate && rEnd >= startDate;
}

export default function AlquileresPage() {
  const [rentals, setRentals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listScope, setListScope] = useState("active");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_NEW_FORM);

  const displayRentals = useMemo(() => {
    const byLocation = new Map();
    for (const r of rentals) {
      const key = Number(r.locationId);
      const prev = byLocation.get(key);
      if (!prev) {
        byLocation.set(key, r);
        continue;
      }
      if (r.endDate > prev.endDate || (r.endDate === prev.endDate && r.id > prev.id)) {
        byLocation.set(key, r);
      }
    }
    return [...byLocation.values()].sort((a, b) => {
      if (a.endDate !== b.endDate) return String(a.endDate).localeCompare(String(b.endDate));
      return Number(a.locationId) - Number(b.locationId);
    });
  }, [rentals]);

  const stats = useMemo(() => {
    const today = todayIso();
    let activos = 0;
    let porVencer = 0;
    let urgentes = 0;
    let vencidos = 0;
    displayRentals.forEach((r) => {
      const end = toIsoDateString(r.endDate);
      if (!end) return;
      if (end < today) vencidos++;
      else {
        activos++;
        const days = getDaysUntil(r.endDate);
        if (days <= DAYS_URGENT) urgentes++;
        else if (days <= DAYS_WARNING) porVencer++;
      }
    });
    return { activos, porVencer, urgentes, vencidos };
  }, [displayRentals]);

  const selectableLocations = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return [];
    return locations.filter(
      (loc) =>
        !displayRentals.some((r) => rentalOverlapsRange(r, form.startDate, form.endDate, loc.id))
    );
  }, [locations, displayRentals, form.startDate, form.endDate]);

  const filteredAvailableLocations = useMemo(() => {
    const q = (form.locationSearch || "").trim().toLowerCase();
    if (!q) return selectableLocations;
    return selectableLocations.filter(
      (l) =>
        String(l.id).includes(q) ||
        (l.address || "").toLowerCase().includes(q) ||
        (l.reference || "").toLowerCase().includes(q)
    );
  }, [selectableLocations, form.locationSearch]);

  const canPickLocations = Boolean(form.clientId && form.startDate && form.endDate && !modal?.id);
  const datesInvalid = form.startDate && form.endDate && form.endDate < form.startDate;

  async function load(scope = listScope) {
    try {
      const [r, locs, cl] = await Promise.all([
        apiCall(`rentals?scope=${scope}`),
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
    load(listScope);
  }, [listScope]);

  function openNew() {
    setForm({
      ...EMPTY_NEW_FORM,
      clientId: clients[0]?.id != null ? String(clients[0].id) : "",
    });
    setModal({});
  }

  function openEdit(r) {
    setForm({
      clientId: String(r.clientId),
      startDate: toIsoDateString(r.startDate) || "",
      endDate: toIsoDateString(r.endDate) || "",
      locationIds: [Number(r.locationId)],
      locationSearch: "",
    });
    setModal({ id: r.id, locationId: r.locationId });
  }

  function toggleLocation(id) {
    const numId = Number(id);
    setForm((f) => {
      const ids = f.locationIds.map(Number);
      if (ids.includes(numId)) {
        return { ...f, locationIds: ids.filter((x) => x !== numId) };
      }
      return { ...f, locationIds: [...ids, numId] };
    });
  }

  function selectAllFiltered() {
    const ids = filteredAvailableLocations.map((l) => Number(l.id));
    setForm((f) => ({
      ...f,
      locationIds: [...new Set([...f.locationIds.map(Number), ...ids])],
    }));
  }

  function clearLocations() {
    setForm((f) => ({ ...f, locationIds: [] }));
  }

  async function save(e) {
    e.preventDefault();
    if (datesInvalid) {
      alert("La fecha de fin debe ser posterior o igual a la de inicio.");
      return;
    }
    if (!modal?.id && form.locationIds.length === 0) {
      alert("Seleccioná al menos una ubicación disponible.");
      return;
    }

    setSaving(true);
    try {
      if (modal?.id) {
        await apiCall("rentals", "PUT", {
          id: modal.id,
          locationId: modal.locationId,
          clientId: Number(form.clientId),
          startDate: form.startDate,
          endDate: form.endDate,
        });
      } else {
        await apiCall("rentals", "POST", {
          clientId: Number(form.clientId),
          startDate: form.startDate,
          endDate: form.endDate,
          locationIds: form.locationIds.map(Number),
        });
      }
      setModal(null);
      load(listScope);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function endRental(id) {
    if (!confirm("¿Finalizar este alquiler? La ubicación quedará disponible.")) return;
    try {
      await apiCall("rentals", "PUT", { id, action: "end" });
      load(listScope);
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="py-12 text-black">Cargando...</div>;

  const isEdit = Boolean(modal?.id);
  const editLocation = isEdit ? locations.find((l) => l.id === modal.locationId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-black">Alquileres</h1>
        <button
          onClick={openNew}
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
          <p className="text-2xl font-black text-black mt-1">{displayRentals.length}</p>
          <p className="text-xs text-stone-500 mt-0.5">En esta vista</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-stone-600">Ver:</span>
        {[
          { id: "active", label: "Activos" },
          { id: "all", label: "Todos" },
          { id: "expired", label: "Vencidos" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setListScope(id)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              listScope === id
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {label}
          </button>
        ))}
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
            {displayRentals.map((r) => {
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
                <td className="p-3">{formatDateEs(r.startDate)}</td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    {formatDateEs(r.endDate)}
                    {badge && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${badge.class}`}>
                        {badge.text}
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline mr-2">Editar</button>
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
          <div className={`bg-white rounded-xl shadow-xl w-full p-6 max-h-[92vh] overflow-y-auto ${isEdit ? "max-w-md" : "max-w-2xl"}`}>
            <h2 className="text-xl font-bold mb-4">{isEdit ? "Editar" : "Nuevo"} alquiler</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Cliente</label>
                <select
                  required
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Seleccionar cliente…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Desde</label>
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Hasta</label>
                  <input
                    required
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              {datesInvalid && (
                <p className="text-sm text-red-600">La fecha de fin debe ser posterior o igual a la de inicio.</p>
              )}

              {isEdit ? (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">Ubicación</label>
                  <div className="px-3 py-2 border rounded-lg bg-stone-50 text-stone-700">
                    N° {modal.locationId} — {editLocation?.address || "—"}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="block text-sm font-medium text-black">
                      Ubicaciones disponibles
                      {form.locationIds.length > 0 && (
                        <span className="ml-2 text-orange-600 font-semibold">
                          ({form.locationIds.length} seleccionadas)
                        </span>
                      )}
                    </label>
                  </div>

                  {!canPickLocations ? (
                    <p className="text-sm text-stone-500 px-3 py-4 border border-dashed border-stone-200 rounded-lg bg-stone-50">
                      Elegí cliente y fechas para ver las ubicaciones disponibles.
                    </p>
                  ) : selectableLocations.length === 0 ? (
                    <p className="text-sm text-stone-500 px-3 py-4 border border-dashed border-stone-200 rounded-lg bg-stone-50">
                      No hay ubicaciones libres en ese rango de fechas.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-stone-600 mb-2">
                        Tocá los chupetes en el mapa para seleccionarlos. Los marcados quedan en verde.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <input
                          type="search"
                          placeholder="Buscar por N° o dirección…"
                          value={form.locationSearch}
                          onChange={(e) => setForm((f) => ({ ...f, locationSearch: e.target.value }))}
                          className="flex-1 min-w-[160px] px-3 py-2 border rounded-lg text-sm"
                        />
                        {filteredAvailableLocations.length > 0 && (
                          <>
                            <button type="button" onClick={selectAllFiltered} className="px-3 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-lg">
                              Marcar visibles
                            </button>
                            <button type="button" onClick={clearLocations} className="px-3 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-lg">
                              Limpiar
                            </button>
                          </>
                        )}
                      </div>
                      <MapLocationPicker
                        locations={filteredAvailableLocations}
                        selectedIds={form.locationIds}
                        onToggle={toggleLocation}
                        height="340px"
                      />
                      {form.locationIds.length > 0 && (
                        <p className="text-xs text-stone-600 mt-2">
                          Seleccionados:{" "}
                          {[...form.locationIds]
                            .map(Number)
                            .sort((a, b) => a - b)
                            .map((id) => `N° ${id}`)
                            .join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-stone-500 mt-1">
                        {selectableLocations.length} libres en el rango elegido
                        {form.locationSearch.trim() ? ` · ${filteredAvailableLocations.length} en la búsqueda` : ""}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 bg-stone-200 rounded-lg">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || datesInvalid || (!isEdit && form.locationIds.length === 0)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving
                    ? "Guardando…"
                    : isEdit
                      ? "Guardar"
                      : form.locationIds.length <= 1
                        ? "Crear alquiler"
                        : `Crear ${form.locationIds.length} alquileres`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
