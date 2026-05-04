export async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`);
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error('Invalid JSON');
  }
}
