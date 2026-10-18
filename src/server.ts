import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createOrder, getOrder, getProduct, searchProducts } from './tools/handlers.ts';
import { createVendorClient, type VendorClient } from './vendor.ts';

export const SERVER_NAME = 'shop-mcp';
export const SERVER_VERSION = '0.1.0';

export function createShopServer(vendor: VendorClient = createVendorClient()): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  server.registerTool(searchProducts.name, searchProducts.config, (args) =>
    searchProducts.handler(args, vendor),
  );
  server.registerTool(getProduct.name, getProduct.config, (args) => getProduct.handler(args, vendor));
  server.registerTool(createOrder.name, createOrder.config, (args) => createOrder.handler(args, vendor));
  server.registerTool(getOrder.name, getOrder.config, (args) => getOrder.handler(args, vendor));
  return server;
}
