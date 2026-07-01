const MAX_LOGO_BYTES = 1024 * 1024;

export function parseClientLogoPayload(body) {
  if (body?.removeLogo === true) {
    return { clear: true };
  }

  let b64 = typeof body?.logoBase64 === "string" ? body.logoBase64.trim() : "";
  if (!b64) return null;
  if (b64.includes(",")) b64 = b64.split(",").pop();
  if (!b64) return null;

  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    throw new Error("Logo inválido.");
  }
  if (buf.length > MAX_LOGO_BYTES) {
    throw new Error("Logo demasiado grande (máx. 1 MB).");
  }
  if (buf.length < 64) {
    throw new Error("Logo demasiado chico o corrupto.");
  }

  let mimeType = typeof body?.logoMimeType === "string" ? body.logoMimeType.split(";")[0].trim() : "";
  if (!mimeType || !mimeType.startsWith("image/")) {
    mimeType = "image/png";
  }

  return { mimeType, data: buf };
}
