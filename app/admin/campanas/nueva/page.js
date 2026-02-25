"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiCall } from "@/lib/api";

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
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiCall("locations").then((data) => setLocations(Array.isArray(data) ? data.filter((l) => l.status === "available") : []));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (form.locations.length === 0) {
      alert("Selecciona al menos una ubicación.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall("campaigns", "POST", {
        ...form,
        budget: form.budget !== "" ? form.budget : 0,
        locations: form.locations.map((id) => ({ id: Number(id), justification: "" })),
      });
      if (res?.success) router.push("/admin/campanas");
      else alert(res?.message || "Error");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleLocation(id) {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(id) ? f.locations.filter((x) => x !== id) : [...f.locations, id],
    }));
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Nueva campaña</h1>
      <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-xl border border-stone-200">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Producto</label>
            <input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Público</label>
            <input value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Slogan</label>
          <input value={form.slogan} onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Fecha inicio *</label>
            <input required type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Fecha fin *</label>
            <input required type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Presupuesto</label>
          <input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Ubicaciones (selecciona al menos una)</label>
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.locations.includes(l.id)} onChange={() => toggleLocation(l.id)} />
                <span>N° {l.id} - {l.address}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 bg-stone-200 rounded-lg">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-orange-600 text-white rounded-lg">Crear campaña</button>
        </div>
      </form>
    </div>
  );
}
