"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api";

export default function EditarCampanaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;
  const [campaign, setCampaign] = useState(null);
  const [locations, setLocations] = useState([]);
  const [links, setLinks] = useState([]);
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
  const [linkForm, setLinkForm] = useState({ name: "", url: "", notes: "" });
  const [editingLink, setEditingLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([
      apiCall("campaigns"),
      apiCall("locations"),
      apiCall(`campaign-links?campaign_id=${id}`),
    ])
      .then(([campaigns, locs, linkList]) => {
        const c = Array.isArray(campaigns) ? campaigns.find((x) => String(x.id) === String(id)) : null;
        if (!c) {
          setCampaign(null);
          setLoadingData(false);
          return;
        }
        setCampaign(c);
        setForm({
          name: c.name ?? "",
          product: c.product ?? "",
          audience: c.audience ?? "",
          slogan: c.slogan ?? "",
          objective: c.objective ?? "",
          status: c.status ?? "draft",
          startDate: (c.startDate || "").slice(0, 10),
          endDate: (c.endDate || "").slice(0, 10),
          budget: c.budget != null ? String(c.budget) : "",
          locations: (c.locations || []).map((loc) => loc.id ?? loc.location_id),
        });
        const allLocs = Array.isArray(locs) ? locs : [];
        const availableOrSelected = allLocs.filter(
          (l) => l.status === "available" || (c.locations || []).some((cl) => (cl.id ?? cl.location_id) === l.id)
        );
        setLocations(availableOrSelected);
        setLinks(Array.isArray(linkList) ? linkList : []);
      })
      .catch((e) => {
        console.error(e);
        setCampaign(null);
      })
      .finally(() => setLoadingData(false));
  }, [id]);

  async function submitCampaign(e) {
    e.preventDefault();
    if (form.locations.length === 0) {
      alert("Selecciona al menos una ubicación.");
      return;
    }
    setLoading(true);
    try {
      await apiCall(`campaigns?id=${id}`, "PUT", {
        ...form,
        id: Number(id),
        budget: form.budget !== "" ? form.budget : 0,
        locations: form.locations.map((locId) => ({ id: Number(locId), justification: "" })),
      });
      setCampaign((c) => (c ? { ...c, ...form } : null));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addLink(e) {
    e.preventDefault();
    if (!linkForm.name.trim() || !linkForm.url.trim()) {
      alert("Nombre y URL son obligatorios.");
      return;
    }
    try {
      const res = await apiCall("campaign-links", "POST", {
        campaign_id: Number(id),
        name: linkForm.name.trim(),
        url: linkForm.url.trim(),
        notes: linkForm.notes.trim(),
      });
      setLinks((prev) => [...prev, { id: res.id, name: linkForm.name, url: linkForm.url, notes: linkForm.notes, total_clicks: 0, tracking_url: res.tracking_url, short_code: res.short_code }]);
      setLinkForm({ name: "", url: "", notes: "" });
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveLink(e) {
    e.preventDefault();
    if (!editingLink) return;
    try {
      await apiCall("campaign-links", "PUT", {
        id: editingLink.id,
        name: linkForm.name.trim(),
        url: linkForm.url.trim(),
        notes: linkForm.notes.trim(),
      });
      setLinks((prev) => prev.map((l) => (l.id === editingLink.id ? { ...l, name: linkForm.name, url: linkForm.url, notes: linkForm.notes } : l)));
      setEditingLink(null);
      setLinkForm({ name: "", url: "", notes: "" });
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteLink(linkId) {
    if (!confirm("¿Eliminar este link trackable?")) return;
    try {
      await apiCall("campaign-links", "DELETE", { id: linkId });
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleLocation(locId) {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(locId) ? f.locations.filter((x) => x !== locId) : [...f.locations, locId],
    }));
  }

  function startEditLink(link) {
    setEditingLink(link);
    setLinkForm({ name: link.name ?? "", url: link.url ?? "", notes: link.notes ?? "" });
  }

  function cancelEditLink() {
    setEditingLink(null);
    setLinkForm({ name: "", url: "", notes: "" });
  }

  function trackingUrl(link) {
    if (link.tracking_url) return link.tracking_url;
    if (typeof window !== "undefined" && link.short_code) return `${window.location.origin}/api/track?c=${link.short_code}`;
    return "";
  }

  if (loadingData) return <div className="py-12 text-stone-500">Cargando...</div>;
  if (!campaign) return <div className="text-red-600">Campaña no encontrada.</div>;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/admin/campanas/${id}`} className="text-orange-600 hover:underline">← Campaña</Link>
        <h1 className="text-2xl font-bold text-stone-800">Editar campaña</h1>
      </div>

      <form onSubmit={submitCampaign} className="space-y-4 bg-white p-6 rounded-xl border border-stone-200">
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
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Objetivo</label>
          <input value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Estado</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
            <option value="draft">Borrador</option>
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
            <option value="completed">Completada</option>
          </select>
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
          <label className="block text-sm font-medium text-stone-700 mb-2">Ubicaciones (al menos una)</label>
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
          <button type="submit" disabled={loading} className="px-4 py-2 bg-orange-600 text-white rounded-lg">Guardar campaña</button>
        </div>
      </form>

      <div className="bg-white p-6 rounded-xl border border-stone-200">
        <h2 className="text-lg font-bold text-stone-800 mb-4">Links trackables</h2>
        <ul className="space-y-3 mb-6">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-start justify-between gap-2 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-800">{link.name}</p>
                <p className="text-sm text-stone-600 truncate">{link.url}</p>
                <p className="text-xs text-stone-500 mt-1">Clicks: {link.total_clicks ?? 0}</p>
                {trackingUrl(link) && (
                  <div className="flex items-center gap-2 mt-2">
                    <input readOnly value={trackingUrl(link)} className="flex-1 min-w-0 text-xs px-2 py-1 border rounded bg-white" />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(trackingUrl(link))}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Copiar
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEditLink(link)} className="px-2 py-1 text-sm text-blue-600 hover:underline">Editar</button>
                <button type="button" onClick={() => deleteLink(link.id)} className="px-2 py-1 text-sm text-red-600 hover:underline">Eliminar</button>
              </div>
            </li>
          ))}
        </ul>

        {editingLink ? (
          <form onSubmit={saveLink} className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-stone-700">Editar link</p>
            <input placeholder="Nombre" value={linkForm.name} onChange={(e) => setLinkForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            <input placeholder="URL destino" value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            <input placeholder="Notas" value={linkForm.notes} onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm">Guardar</button>
              <button type="button" onClick={cancelEditLink} className="px-3 py-2 bg-stone-200 rounded-lg text-sm">Cancelar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={addLink} className="space-y-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <p className="text-sm font-medium text-stone-700">Nuevo link trackable</p>
            <input placeholder="Nombre *" value={linkForm.name} onChange={(e) => setLinkForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="URL destino *" value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="Notas" value={linkForm.notes} onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
            <button type="submit" className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm">Agregar link</button>
          </form>
        )}
      </div>
    </div>
  );
}
