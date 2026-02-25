"use client";

import { useState, useEffect } from "react";

const HIGH_QUALITY_SIZE = 512;

export default function QRChupete({ url, chupeteNumber, size = 160 }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url || typeof url !== "string") return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const data = await QRCode.toDataURL(url, { width: size, margin: 1 });
        if (!cancelled) setDataUrl(data);
      } catch (e) {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, size]);

  async function downloadHighQuality() {
    if (!url) return;
    try {
      const QRCode = (await import("qrcode")).default;
      const data = await QRCode.toDataURL(url, { width: HIGH_QUALITY_SIZE, margin: 2 });
      const fileName = `qr-chupete-${chupeteNumber != null ? chupeteNumber : "link"}.png`;
      const a = document.createElement("a");
      a.href = data;
      a.download = fileName;
      a.click();
    } catch (e) {
      console.error(e);
    }
  }

  if (error) return <div className="text-xs text-red-500">Error al generar QR</div>;
  if (!dataUrl) return <div className="bg-stone-100 rounded animate-pulse" style={{ width: size, height: size }} />;

  return (
    <div className="inline-flex flex-col items-center">
      <img src={dataUrl} alt={`QR Chupete ${chupeteNumber ?? ""}`} width={size} height={size} className="rounded-lg border-2 border-stone-200 bg-white" />
      {chupeteNumber != null && (
        <span className="mt-1.5 text-sm font-bold text-black">Chupete N° {chupeteNumber}</span>
      )}
      <button
        type="button"
        onClick={downloadHighQuality}
        className="mt-2 text-xs text-orange-600 hover:underline"
      >
        Descargar QR (alta calidad)
      </button>
    </div>
  );
}
