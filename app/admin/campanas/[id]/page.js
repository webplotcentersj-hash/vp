"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiCall } from "@/lib/api";

export default function CampanaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("campaigns")
      .then((data) => {
        const c = Array.isArray(data) ? data.find((x) => String(x.id) === String(params.id)) : null;
        setCampaign(c || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="py-12 text-black">Cargando...</div>;
  if (!campaign) return <div className="text-red-600">Campaña no encontrada.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/campanas" className="text-orange-600 hover:underline">← Campañas</Link>
        <h1 className="text-2xl font-bold text-black">{campaign.name}</h1>
      </div>
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <p><strong>Producto:</strong> {campaign.product || "—"}</p>
        <p><strong>Público:</strong> {campaign.audience || "—"}</p>
        <p><strong>Slogan:</strong> {campaign.slogan || "—"}</p>
        <p><strong>Estado:</strong> {campaign.status}</p>
        <p><strong>Ubicaciones:</strong> {campaign.total_locations ?? 0}</p>
        <p><strong>Impresiones:</strong> {(campaign.total_impressions || 0).toLocaleString()}</p>
        <p><strong>Clicks:</strong> {(campaign.total_clicks || 0).toLocaleString()}</p>
        <p><strong>Conversiones:</strong> {(campaign.total_conversions || 0).toLocaleString()}</p>
      </div>
      <div className="flex gap-2">
        <Link href={`/admin/campanas/${params.id}/editar`} className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Editar campaña</Link>
        <Link href={`/admin/campanas/${params.id}/metricas`} className="inline-block px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Ver métricas</Link>
      </div>
    </div>
  );
}
