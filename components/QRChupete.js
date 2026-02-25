"use client";

import { useState, useEffect } from "react";

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

  if (error) return <div className="text-xs text-red-500">Error al generar QR</div>;
  if (!dataUrl) return <div className="bg-stone-100 rounded animate-pulse" style={{ width: size, height: size }} />;

  const fileName = `qr-chupete-${chupeteNumber != null ? chupeteNumber : "link"}.png`;

  return (
    <div className="inline-flex flex-col items-center">
      <img src={dataUrl} alt={`QR Chupete ${chupeteNumber ?? ""}`} width={size} height={size} className="rounded-lg border-2 border-stone-200 bg-white" />
      {chupeteNumber != null && (
        <span className="mt-1.5 text-sm font-bold text-stone-700">Chupete N° {chupeteNumber}</span>
      )}
      <a
        href={dataUrl}
        download={fileName}
        className="mt-2 text-xs text-orange-600 hover:underline"
      >
        Descargar QR
      </a>
    </div>
  );
}
