"use client";

import { useEffect, useMemo, useState } from "react";
import { apiCall } from "@/lib/api";

export default function InstalacionesAdminPage() {
  const [locations, setLocations] = useState([]);
  const [lists, setLists] = useState([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    try {
      const [locs, inst] = await Promise.all([
        apiCall("locations"),
        fetch("/api/installations").then((r) => (r.ok ? r.json() : [])),
      ]);
      setLocations(Array.isArray(locs) ? locs : []);
      setLists(Array.isArray(inst) ? inst : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(
    () =>
      locations.filter(
        (l) =>
          (l.address || "").toLowerCase().includes(search.toLowerCase()) ||
          (l.reference || "").toLowerCase().includes(search.toLowerCase()) ||
          String(l.id).includes(search)
      ),
    [locations, search]
  );

  function toggleId(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((l) => next.add(l.id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function createList() {
    const ids = [...selected];
    if (ids.length === 0) {
      alert("Seleccioná al menos una ubicación.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Instalación", locationIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error al crear");
      setTitle("");
      setSelected(new Set());
      await loadAll();
      const slug = data.publicSlug;
      if (slug && typeof window !== "undefined") {
        const url = `${window.location.origin}/instalaciones/${slug}`;
        try {
          await navigator.clipboard.writeText(url);
          alert(`Lista creada. Link copiado al portapapeles:\n${url}`);
        } catch {
          alert(`Lista creada. Compartí este link:\n${url}`);
        }
      }
    } catch (e) {
      alert(e.message || e);
    } finally {
      setSaving(false);
    }
  }

  async function removeList(id) {
    if (!confirm("¿Eliminar esta lista de instalación? (el link dejará de funcionar)")) return;
    try {
      const r = await fetch(`/api/installations?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      loadAll();
    } catch (e) {
      alert(e.message || e);
    }
  }

  function copyUrl(slug) {
    const url = `${window.location.origin}/instalaciones/${slug}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado: " + url);
  }

  if (loading) return <div className="py-12 text-black">Cargando…</div>;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-black">Instalaciones</h1>
        <p className="text-stone-600 mt-1 text-sm max-w-2xl">
          Elegí ubicaciones y generá un link para el celular. Sin login, el equipo marca lo instalado y todos ven el mismo
          progreso.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
        <h2 className="font-bold text-black text-lg">Listas activas</h2>
        {lists.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay listas. Creá una abajo.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 justify-between p-3 rounded-lg bg-stone-50 border border-stone-100"
              >
                <div>
                  <p className="font-medium text-black">{row.title}</p>
                  <p className="text-xs text-stone-500">
                    {row.installedCount}/{row.totalLocations} instalados ·{" "}
                    {row.createdAt ? new Date(row.createdAt).toLocaleString("es-AR") : ""}
                  </p>
                  <p className="text-xs font-mono text-orange-700 mt-1 break-all">
                    /instalaciones/{row.publicSlug}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyUrl(row.publicSlug)}
                    className="px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Copiar link
                  </button>
                  <button
                    type="button"
                    onClick={() => removeList(row.id)}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
        <h2 className="font-bold text-black text-lg">Nueva lista</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-stone-600 mb-1">Título (opcional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Campaña febrero — zona centro"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-black"
            />
          </div>
          <p className="text-sm text-stone-600 pb-2">
            {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            disabled={saving || selected.size === 0}
            onClick={createList}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear y copiar link"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar N°, dirección…"
            className="px-3 py-2 border border-stone-200 rounded-lg flex-1 min-w-[180px]"
          />
          <button type="button" onClick={selectAllVisible} className="text-sm text-orange-700 hover:underline">
            Marcar todas visibles
          </button>
          <button type="button" onClick={clearSelection} className="text-sm text-stone-600 hover:underline">
            Limpiar selección
          </button>
        </div>

        <div className="border border-stone-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 sticky top-0">
              <tr>
                <th className="p-2 w-10" />
                <th className="p-2 text-black">N°</th>
                <th className="p-2 text-black">Dirección</th>
                <th className="p-2 text-black hidden sm:table-cell">Ref.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc) => (
                <tr key={loc.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(loc.id)}
                      onChange={() => toggleId(loc.id)}
                      className="w-4 h-4 accent-orange-600"
                    />
                  </td>
                  <td className="p-2 font-medium">{loc.id}</td>
                  <td className="p-2">{loc.address}</td>
                  <td className="p-2 text-stone-600 hidden sm:table-cell">{loc.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
