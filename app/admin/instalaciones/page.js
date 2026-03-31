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

  const [editListId, setEditListId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSelected, setEditSelected] = useState(() => new Set());
  const [editSearch, setEditSearch] = useState("");
  const [editAddById, setEditAddById] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

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

  /**
   * Filas del modal Editar: coinciden con búsqueda O ya están incluidas en la lista
   * (así las incluidas no desaparecen al buscar otra cosa). Plus N° huérfanos solo-en-lista.
   */
  const filteredEditSorted = useMemo(() => {
    const q = (editSearch || "").toLowerCase();
    const matches = (l) =>
      (l.address || "").toLowerCase().includes(q) ||
      (l.reference || "").toLowerCase().includes(q) ||
      String(l.id).includes(editSearch);

    const catalogRows = locations.filter((l) => matches(l) || editSelected.has(Number(l.id)));

    const orphanIds = [...editSelected].filter(
      (id) => !locations.some((l) => Number(l.id) === id)
    );
    const orphanRows = orphanIds.map((id) => ({
      id,
      address: "No figura en Ubicaciones; sigue en la instalación hasta que lo saques de la lista",
      reference: "",
      ghost: true,
    }));

    const byKey = new Map();
    for (const l of catalogRows) {
      byKey.set(Number(l.id), { ...l, ghost: false });
    }
    for (const o of orphanRows) {
      if (!byKey.has(o.id)) byKey.set(o.id, o);
    }

    const combined = [...byKey.values()];
    const byId = (a, b) => Number(a.id) - Number(b.id);
    const inList = combined.filter((l) => editSelected.has(Number(l.id))).sort(byId);
    const notInList = combined.filter((l) => !editSelected.has(Number(l.id))).sort(byId);
    return [...inList, ...notInList];
  }, [locations, editSearch, editSelected]);

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

  async function openEdit(row) {
    setEditListId(row.id);
    setEditTitle(row.title ?? "");
    setEditSlug(row.publicSlug ?? "");
    setEditSearch("");
    setEditAddById("");
    setEditLoading(true);
    setEditSelected(new Set());
    try {
      const [locsRes, detailRes] = await Promise.all([
        apiCall("locations").catch(() => null),
        fetch(`/api/installations?id=${row.id}`),
      ]);
      if (Array.isArray(locsRes)) setLocations(locsRes);
      const d = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(d.message || "No se pudo cargar la lista.");
      setEditTitle(d.title ?? row.title ?? "");
      setEditSlug(d.publicSlug ?? row.publicSlug ?? "");
      const ids = (Array.isArray(d.locationIds) ? d.locationIds : [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
      setEditSelected(new Set(ids));
    } catch (e) {
      alert(e.message || e);
      setEditListId(null);
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditListId(null);
    setEditTitle("");
    setEditSlug("");
    setEditSearch("");
    setEditAddById("");
    setEditSelected(new Set());
  }

  function toggleEditId(locId) {
    const id = Number(locId);
    if (!Number.isFinite(id)) return;
    setEditSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisibleEdit() {
    setEditSelected((prev) => {
      const next = new Set(prev);
      filteredEditSorted.forEach((l) => next.add(Number(l.id)));
      return next;
    });
  }

  function addLocationByNumber() {
    const n = parseInt(String(editAddById).trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      alert("Ingresá un número de ubicación (N° chupete) válido.");
      return;
    }
    const loc = locations.find((l) => Number(l.id) === n);
    if (!loc) {
      alert(`No existe la ubicación N° ${n} en la base. Creala antes en Ubicaciones.`);
      return;
    }
    if (editSelected.has(n)) {
      alert(`El N° ${n} ya está en la lista.`);
      setEditAddById("");
      return;
    }
    setEditSelected((prev) => new Set(prev).add(n));
    setEditAddById("");
  }

  function clearEditSelection() {
    setEditSelected(new Set());
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editListId) return;
    const ids = [...editSelected].map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      alert("Seleccioná al menos una ubicación.");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/installations?id=${editListId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editListId,
          title: editTitle.trim() || "Instalación",
          locationIds: ids,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error al guardar.");
      await loadAll();
      closeEdit();
      alert("Lista actualizada. El link público sigue siendo el mismo.");
    } catch (err) {
      alert(err.message || err);
    } finally {
      setEditSaving(false);
    }
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="px-3 py-2 text-sm bg-stone-700 text-white rounded-lg hover:bg-stone-800"
                  >
                    Editar
                  </button>
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

      {editListId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-list-title"
            className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col my-4"
          >
            <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-list-title" className="text-lg font-bold text-black">
                  Editar lista de instalación
                </h2>
                <p className="text-xs font-mono text-orange-700 mt-1 break-all">/instalaciones/{editSlug}</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="text-stone-500 hover:text-black text-sm px-2 py-1 rounded-lg hover:bg-stone-100"
              >
                Cerrar
              </button>
            </div>

            {editLoading ? (
              <div className="p-8 text-center text-stone-600">Cargando…</div>
            ) : (
              <form onSubmit={saveEdit} className="flex flex-col flex-1 min-h-0">
                <div className="p-4 space-y-4 border-b border-stone-100">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Título</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Ej. Campaña febrero — zona centro"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-black"
                    />
                  </div>
                  <p className="text-sm text-stone-600">
                    {editSelected.size} ubicación{editSelected.size !== 1 ? "es" : ""} en la lista · marcá filas abajo o
                    sumá por N°
                  </p>
                  <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-green-900 mb-1">Agregar ubicación por N°</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAddById}
                        onChange={(e) => setEditAddById(e.target.value)}
                        placeholder="Ej. 42"
                        className="w-full px-3 py-2 border border-green-200 rounded-lg text-black"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addLocationByNumber();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addLocationByNumber}
                      className="px-3 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 shrink-0"
                    >
                      Incluir en la lista
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="search"
                      value={editSearch}
                      onChange={(e) => setEditSearch(e.target.value)}
                      placeholder="Buscar N°, dirección…"
                      className="px-3 py-2 border border-stone-200 rounded-lg flex-1 min-w-[160px]"
                    />
                    <button type="button" onClick={selectAllVisibleEdit} className="text-sm text-orange-700 hover:underline">
                      Marcar todas visibles
                    </button>
                    <button type="button" onClick={clearEditSelection} className="text-sm text-stone-600 hover:underline">
                      Limpiar selección
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 border-b border-stone-100 min-h-[200px] max-h-[45vh]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 sticky top-0">
                      <tr>
                        <th className="p-2 w-10" />
                        <th className="p-2 text-black">N°</th>
                        <th className="p-2 text-black">Dirección</th>
                        <th className="p-2 text-black hidden sm:table-cell">Ref.</th>
                        <th className="p-2 text-black hidden md:table-cell w-28">Lista</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEditSorted.map((loc) => {
                        const lid = Number(loc.id);
                        const on = editSelected.has(lid);
                        const isGhost = loc.ghost === true;
                        return (
                          <tr
                            key={`${lid}-${isGhost ? "g" : "c"}`}
                            className={`border-t border-stone-100 hover:bg-stone-50 ${on ? "bg-orange-50/40" : ""} ${isGhost ? "bg-amber-50/50" : ""}`}
                          >
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleEditId(lid)}
                                className="w-4 h-4 accent-orange-600"
                              />
                            </td>
                            <td className="p-2 font-medium">{lid}</td>
                            <td className="p-2">
                              {loc.address}
                              {isGhost && (
                                <span className="block text-xs text-amber-800 font-medium mt-0.5">Solo en esta lista</span>
                              )}
                            </td>
                            <td className="p-2 text-stone-600 hidden sm:table-cell">{loc.reference || "—"}</td>
                            <td className="p-2 hidden md:table-cell">
                              {on ? (
                                <span className="text-xs font-medium text-orange-800">Incluida</span>
                              ) : (
                                <span className="text-xs text-stone-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 flex flex-wrap gap-2 justify-end">
                  <button type="button" onClick={closeEdit} className="px-4 py-2 bg-stone-200 text-black rounded-lg hover:bg-stone-300">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving || editSelected.size === 0}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {editSaving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
