"use client";

import { useCallback, useEffect, useState } from "react";

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const maxW = 1600;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
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
            reject(new Error("No se pudo comprimir."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const base64 = typeof dataUrl === "string" ? dataUrl.split(",")[1] : "";
            resolve({ base64, mimeType: blob.type || "image/jpeg" });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

export default function InstalacionesAuditoria({ slug, locations }) {
  const [photosByLoc, setPhotosByLoc] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/installations/${encodeURIComponent(slug)}/audit`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j.error || j.message || "Error al cargar auditoría");
      }
      setPhotosByLoc(j.photosByLocation || {});
    } catch (e) {
      setLoadError(e.message || String(e));
      setPhotosByLoc({});
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function onFile(locId, file) {
    if (!file) return;
    setUploading(locId);
    try {
      const { base64, mimeType } = await compressImage(file);
      const r = await fetch(`/api/installations/${encodeURIComponent(slug)}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: locId, imageBase64: base64, mimeType }),
      });
      const text = await r.text();
      if (!r.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j.error || msg;
        } catch {
          /* */
        }
        throw new Error(msg || "No se pudo subir");
      }
      await load();
    } catch (e) {
      alert(e.message || e);
    } finally {
      setUploading(null);
    }
  }

  function photoSrc(photoId) {
    return `/api/installations/audit-photo/${photoId}?slug=${encodeURIComponent(slug)}`;
  }

  if (loading && Object.keys(photosByLoc).length === 0 && !loadError) {
    return (
      <div className="px-4 py-12 text-center text-stone-500 text-sm max-w-lg mx-auto">Cargando auditoría…</div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{loadError}</p>
        <p className="text-xs text-stone-500 mt-2">
          Si acabás de desplegar, ejecutá en MySQL el script <code className="font-mono">sql/installation_audit_photos.sql</code>.
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pt-2 pb-8 space-y-4 max-w-lg mx-auto">
      <p className="text-xs text-stone-500 px-1">
        Relevá cada chupete y subí fotos del estado en terreno. Se guardan en esta lista.
      </p>
      {locations.length === 0 ? (
        <p className="text-sm text-stone-500 text-center py-8">No hay ubicaciones con el filtro actual.</p>
      ) : (
        locations.map((loc) => {
          const lid = Number(loc.id);
          const photos = photosByLoc[lid] || photosByLoc[String(lid)] || [];
          const busy = uploading === lid;
          return (
            <div
              key={lid}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-stone-900">N° {lid}</p>
                  <p className="text-sm text-stone-600 line-clamp-2">{loc.address || "—"}</p>
                  {loc.reference ? <p className="text-xs text-stone-400 mt-0.5">{loc.reference}</p> : null}
                </div>
                <label className="flex-shrink-0">
                  <span className="sr-only">Agregar foto N° {lid}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) onFile(lid, f);
                    }}
                  />
                  <span
                    className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium ${
                      busy
                        ? "bg-stone-200 text-stone-500"
                        : "bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
                    }`}
                  >
                    {busy ? "…" : "Foto"}
                  </span>
                </label>
              </div>
              {photos.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <li key={p.id} className="aspect-square rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                      <a href={photoSrc(p.id)} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                        <img
                          src={photoSrc(p.id)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-400">Sin fotos aún.</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
