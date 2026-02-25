const BASE = "/api";

export async function apiCall(endpoint, method = "GET", body = null) {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE}/${endpoint}`;
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (body && method !== "GET") options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Error ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
