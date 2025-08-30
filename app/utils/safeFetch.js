// utils/safeFetch.js
export async function safeJson(res) {
  const ct = res.headers.get('content-type') ?? '';
  const noContent = res.status === 204 || res.headers.get('content-length') === '0';
  if (noContent) return null;

  if (!ct.includes('application/json')) {
    // Intenta leer texto para darte un error más útil
    const txt = await res.text();
    throw new Error(`Respuesta no-JSON (status ${res.status}): ${txt.slice(0, 200)}`);
  }
  return await res.json();
}

export async function api(input, init) {
  const res = await fetch(input, init);
  if (!res.ok) {
    // Intenta extraer mensaje de error del backend
    let serverMsg = '';
    try { serverMsg = JSON.stringify(await res.json()); } catch {
      try { serverMsg = await res.text(); } catch {}
    }
    throw new Error(`Error ${res.status} ${res.statusText}: ${serverMsg}`);
  }
  return safeJson(res);
}