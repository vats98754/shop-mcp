export interface VendorResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

export interface VendorClient {
  get(path: string): Promise<VendorResponse>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<VendorResponse>;
}

export function createVendorClient(
  baseUrl = process.env.VENDOR_BASE_URL ?? 'http://127.0.0.1:4010',
): VendorClient {
  const base = baseUrl.replace(/\/$/, '');
  async function send(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, headers: res.headers, body: parsed };
  }
  return {
    get: (path) => send('GET', path),
    post: (path, body, headers) => send('POST', path, body, headers),
  };
}
