import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { createShopServer, SERVER_NAME } from '../src/index.ts';
import { createVendorClient } from '../src/vendor.ts';

test('server lists the four tools with output schemas', async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createShopServer(createVendorClient('http://127.0.0.1:9'));
  await server.connect(a);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(b);
  const { tools } = await client.listTools();
  expect(SERVER_NAME).toBe('shop-mcp');
  expect(tools.map((t) => t.name).sort()).toEqual([
    'create_order',
    'get_order',
    'get_product',
    'search_products',
  ]);
  for (const t of tools) expect(t.outputSchema, t.name).toBeDefined();
  await client.close();
});
