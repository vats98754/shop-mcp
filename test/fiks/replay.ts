// Strict HTTP replay of recorded vendor exchanges. A request matches a recording when the
// method, path+query, body and the set of significant header names are the same. Each
// recording answers at most once. Anything else gets 599 UNMATCHED_REQUEST.
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { HttpExchange } from './vendored/types.ts';

export const UNMATCHED_STATUS = 599;

/** Headers every HTTP client sends on its own; they never make two requests different. */
const INCIDENTAL =
  /^(accept|accept-.*|user-agent|sec-.*|connection|keep-alive|host|content-length|transfer-encoding|date)$/;

export function significantHeaderNames(headers: Record<string, unknown> | IncomingHttpHeaders): string {
  return Object.keys(headers)
    .map((h) => h.toLowerCase())
    .filter((h) => !INCIDENTAL.test(h))
    .sort()
    .join(',');
}

export function requestKey(
  method: string,
  url: string,
  body: string | null,
  headers: Record<string, unknown>,
): string {
  return `${method} ${url} body=${body ?? ''} headers=[${significantHeaderNames(headers)}]`;
}

export interface Replay {
  url: string;
  /** Requests that matched no recording. */
  unmatched: string[];
  close(): Promise<void>;
}

export async function startReplay(exchanges: HttpExchange[]): Promise<Replay> {
  const pending = [...exchanges]
    .sort((a, b) => a.seq - b.seq)
    .map((e) => ({ e, key: requestKey(e.request.method, e.request.url, e.request.body, e.request.headers) }));
  const unmatched: string[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : null;
      const key = requestKey(req.method ?? 'GET', req.url ?? '/', body, req.headers);
      const i = pending.findIndex((p) => p.key === key);
      if (i === -1) {
        unmatched.push(key);
        res.writeHead(UNMATCHED_STATUS, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNMATCHED_REQUEST', request: key }));
        return;
      }
      const { e } = pending.splice(i, 1)[0] as { e: HttpExchange };
      res.writeHead(e.response.status, e.response.headers);
      res.end(e.response.body);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    unmatched,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
