/** Normaliza a YYYY-MM-DD (sin depender de timezone UTC). */
export function toIsoDateString(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDateString(parsed);
  }
  return "";
}

export function parseLocalIsoDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateEs(isoDate) {
  const iso = toIsoDateString(isoDate);
  if (!iso) return "—";
  const dt = parseLocalIsoDate(iso);
  if (!dt) return iso;
  return dt.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function daysUntilIso(isoDate) {
  const end = parseLocalIsoDate(toIsoDateString(isoDate));
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (24 * 60 * 60 * 1000));
}

export function todayIso() {
  return toIsoDateString(new Date());
}
