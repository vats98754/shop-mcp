#!/usr/bin/env node
// shop-mcp entrypoint. stdio by default; `--http <port>` serves Streamable HTTP at /mcp.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createShopServer } from './server.ts';

const httpFlag = process.argv.indexOf('--http');

if (httpFlag === -1) {
  await createShopServer().connect(new StdioServerTransport());
} else {
  const port = Number(process.argv[httpFlag + 1] ?? 0);
  const http = createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end();
      return;
    }
    // Stateless: a fresh server and transport per request.
    const server = createShopServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  http.listen(port, '127.0.0.1', () => {
    console.error(
      `[shop-mcp] Streamable HTTP on http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`,
    );
  });
}
