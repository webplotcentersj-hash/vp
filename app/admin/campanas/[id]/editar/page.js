"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiCall } from "@/lib/api";
import QRChupete from "@/components/QRChupete";

const MapLocationPicker = dynamic(() => import("@/components/MapLocationPicker"), { ssr: false });

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
        // Todas las ubicaciones de la base de datos para el mapa
        setLocations(Array.isArray(locs) ? locs : []);
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
    if (typeof window !== "undefined" && link.short_code) return `${window.location.origin}/api/track?c=${link.short_code}`;
    if (link.tracking_url) return link.tracking_url;
    return "";
  }

  if (loadingData) return <div className="py-12 text-black">Cargando...</div>;
  if (!campaign) return <div className="text-red-600">Campaña no encontrada.</div>;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/admin/campanas/${id}`} className="text-orange-600 hover:underline font-medium">← Campaña</Link>
        <h1 className="text-2xl font-bold text-black">Editar campaña</h1>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-lg border border-stone-200 bg-white p-3">
        <p className="text-black text-sm mb-2">Ubicaciones de la base de datos (con coordenadas). Tocá los marcadores para sumar o quitar.</p>
        <MapLocationPicker locations={locations} selectedIds={form.locations} onToggle={toggleLocation} height="320px" />
      </div>

      <form onSubmit={submitCampaign} className="space-y-4 bg-white p-6 rounded-xl border border-stone-200 shadow">
        <div>
          <label className="block text-sm font-medium text-black mb-1">Nombre *</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Producto</label>
            <input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Público</label>
            <input value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-black mb-1">Slogan</label>
          <input value={form.slogan} onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-black mb-1">Objetivo</label>
          <input value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-black mb-1">Estado</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
            <option value="draft">Borrador</option>
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
            <option value="completed">Completada</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Fecha inicio *</label>
            <input required type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Fecha fin *</label>
            <input required type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-black mb-1">Presupuesto</label>
          <input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-black mb-2">Ubicaciones (al menos una) – mapa arriba o lista</label>
          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-stone-50">
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.locations.includes(l.id)} onChange={() => toggleLocation(l.id)} className="rounded border-stone-400 text-orange-600" />
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
        <h2 className="text-lg font-bold text-black mb-2">Links trackables</h2>
        <p className="text-sm text-black mb-4">Cada link se genera a partir de la URL que quieras trackear. Al escanear el QR (o abrir el link) se registra el click y se redirige a esa URL.</p>
        <ul className="space-y-6 mb-6">
          {links.map((link) => {
            const url = trackingUrl(link);
            const chupeteNum = link.location_id ?? link.locationId;
            return (
              <li key={link.id} className="flex flex-wrap items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex-shrink-0">
                  {url ? <QRChupete url={url} chupeteNumber={chupeteNum} size={160} /> : <div className="w-40 h-40 rounded-lg bg-stone-200 flex items-center justify-center text-black text-sm">Sin short code</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black">{link.name}</p>
                  <p className="text-sm text-black truncate">Destino: {link.url}</p>
                  <p className="text-xs text-black mt-1">Clicks: {link.total_clicks ?? 0}</p>
                  {url && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <input readOnly value={url} className="flex-1 min-w-0 max-w-md text-xs px-2 py-1.5 border rounded-lg bg-white" />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(url)}
                        className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200"
                      >
                        Copiar link
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEditLink(link)} className="px-2 py-1 text-sm text-blue-600 hover:underline">Editar</button>
                  <button type="button" onClick={() => deleteLink(link.id)} className="px-2 py-1 text-sm text-red-600 hover:underline">Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>

        {editingLink ? (
          <form onSubmit={saveLink} className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-black">Editar link</p>
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
            <p className="text-sm font-medium text-black">Nuevo link trackable</p>
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
