"use client";

import { useState, useEffect } from "react";
import { apiCall } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  logoPreview: null,
  logoBase64: null,
  logoMimeType: null,
  removeLogo: false,
  hadLogo: false,
};

function compressLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const max = 400;
      if (w > max || h > max) {
        if (w >= h) {
          h = Math.round((h * max) / w);
          w = max;
        } else {
          w = Math.round((w * max) / h);
          h = max;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo comprimir el logo."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const base64 = typeof dataUrl === "string" ? dataUrl.split(",")[1] : "";
            resolve({ base64, mimeType: blob.type || "image/png", preview: dataUrl });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/png",
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

export default function ClientesPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setModal({});
  }

  function openEdit(c) {
    setForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      logoPreview: c.hasLogo ? `/api/clients/logo/${c.id}?v=${Date.now()}` : null,
      logoBase64: null,
      logoMimeType: null,
      removeLogo: false,
      hadLogo: Boolean(c.hasLogo),
    });
    setModal({ id: c.id });
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Elegí un archivo de imagen (PNG, JPG, WebP).");
      return;
    }
    try {
      const { base64, mimeType, preview } = await compressLogo(file);
      setForm((f) => ({
        ...f,
        logoPreview: preview,
        logoBase64: base64,
        logoMimeType: mimeType,
        removeLogo: false,
      }));
    } catch (err) {
      alert(err.message || "No se pudo cargar el logo.");
    }
  }

  function removeLogo() {
    setForm((f) => ({
      ...f,
      logoPreview: null,
      logoBase64: null,
      logoMimeType: null,
      removeLogo: true,
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
      };
      if (form.logoBase64) {
        payload.logoBase64 = form.logoBase64;
        payload.logoMimeType = form.logoMimeType;
      } else if (form.removeLogo) {
        payload.removeLogo = true;
      }
      if (modal?.id) {
        await apiCall("clients", "PUT", { ...payload, id: modal.id });
      } else {
        await apiCall("clients", "POST", payload);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
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

  if (loading) return <div className="py-12 text-black">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-black">Clientes</h1>
        <div className="flex gap-3">
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-lg" />
          <button
            onClick={openNew}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 text-black text-sm uppercase">
            <tr>
              <th className="p-3 w-16">Logo</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="p-3">
                  {c.hasLogo ? (
                    <img
                      src={`/api/clients/logo/${c.id}`}
                      alt=""
                      className="w-10 h-10 rounded-lg object-contain bg-stone-50 border border-stone-200"
                    />
                  ) : (
                    <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-stone-100 text-stone-400 text-xs">—</span>
                  )}
                </td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
                <td className="p-3">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline mr-2">Editar</button>
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
                <label className="block text-sm font-medium text-black mb-1">Nombre</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Logo</label>
                <p className="text-xs text-stone-500 mb-2">Se muestra en el mapa embebido cuando el cliente tiene un chupete alquilado.</p>
                <div className="flex items-center gap-3">
                  {form.logoPreview ? (
                    <img src={form.logoPreview} alt="" className="w-16 h-16 rounded-lg object-contain bg-stone-50 border border-stone-200" />
                  ) : (
                    <span className="inline-flex w-16 h-16 items-center justify-center rounded-lg bg-stone-100 text-stone-400 text-xs border border-dashed border-stone-300">Sin logo</span>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center justify-center px-3 py-2 text-sm bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer">
                      {form.logoPreview ? "Cambiar logo" : "Subir logo"}
                      <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                    </label>
                    {(form.logoPreview || form.hadLogo) && !form.removeLogo && (
                      <button type="button" onClick={removeLogo} className="text-sm text-red-600 hover:underline text-left">
                        Quitar logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 bg-stone-200 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-60">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
