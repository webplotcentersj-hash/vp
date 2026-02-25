"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function ClientesPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  async function load() {
    try {
      const data = await apiCall("clients");
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
    (c) =>
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
  );

  async function save(e) {
    e.preventDefault();
    try {
      if (modal?.id) {
        await apiCall("clients", "PUT", { ...form, id: modal.id });
      } else {
        await apiCall("clients", "POST", form);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("¿Eliminar este cliente y sus alquileres?")) return;
    try {
      await apiCall("clients", "DELETE", { id });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="py-12 text-stone-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-800">Clientes</h1>
        <div className="flex gap-3">
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg" />
          <button
            onClick={() => {
              setForm({ name: "", email: "", phone: "" });
              setModal({});
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-stone-500 text-sm uppercase">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
                <td className="p-3">
                  <button onClick={() => { setForm({ name: c.name, email: c.email || "", phone: c.phone || "" }); setModal({ id: c.id }); }} className="text-blue-600 hover:underline mr-2">Editar</button>
                  <button onClick={() => remove(c.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{modal.id ? "Editar" : "Nuevo"} cliente</h2>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
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
