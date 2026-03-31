"use client";

import { useCallback, useEffect, useState } from "react";

export default function InstalacionesPublic({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/installations/${slug}`, { cache: "no-store" });
      if (!r.ok) {
        setError(r.status === 404 ? "Lista no encontrada" : "Error al cargar");
        setData(null);
        return;
      }
      const j = await r.json();
      setData(j);
      setError(null);
    } catch {
      setError("Error de red");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(load, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [load]);

  async function toggle(loc, installed) {
    setPendingId(loc.id);
    try {
      const r = await fetch(`/api/installations/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, installed: !installed }),
      });
      if (!r.ok) {
        const t = await r.text();
        alert(t || "No se pudo actualizar");
        return;
      }
      await load();
    } finally {
      setPendingId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-100 text-stone-600">
        Cargando…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-stone-100 p-4">
        <p className="text-stone-700 text-center">{error || "Sin datos"}</p>
      </div>
    );
  }

  const pct = data.total ? Math.round((data.installedCount / data.total) * 100) : 0;

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900 pb-8">
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm px-4 py-3">
        <h1 className="text-lg font-bold text-stone-900 leading-tight">{data.title || "Instalaciones"}</h1>
        <p className="text-sm text-stone-500 mt-1">
          {data.installedCount} de {data.total} instalados · {pct}%
        </p>
        <div className="mt-2 h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Tocá para marcar o desmarcar. Todos ven el mismo estado.
        </p>
      </header>

      <ul className="px-3 pt-3 space-y-2 max-w-lg mx-auto">
        {data.locations.map((loc) => {
          const busy = pendingId === loc.id;
          return (
            <li key={loc.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(loc, loc.installed)}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 flex gap-3 items-start transition-colors active:scale-[0.99] disabled:opacity-60 ${
                  loc.installed
                    ? "bg-green-50 border-green-400 shadow-sm"
                    : "bg-white border-stone-200 hover:border-orange-300"
                }`}
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    loc.installed ? "bg-green-600 text-white" : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {loc.installed ? "✓" : loc.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-stone-900 block">N° {loc.id}</span>
                  <span className="text-sm text-stone-600 line-clamp-2">{loc.address || "—"}</span>
                  {loc.reference ? (
                    <span className="text-xs text-stone-400 block mt-0.5">{loc.reference}</span>
                  ) : null}
                  {loc.installed && loc.markedAt ? (
                    <span className="text-xs text-green-700 mt-1 block">
                      Actualizado{" "}
                      {new Date(loc.markedAt).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
