import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, ok } from '../result.ts';
import type { VendorClient } from '../vendor.ts';

export const name = 'create_order';

export const config = {
  title: 'Create order',
  description:
    'Place an order for one or more products. Returns the order id and total in US dollars. Each call places a new order; do not retry blindly.',
  inputSchema: {
    items: z
      .array(z.object({ product_id: z.string(), quantity: z.number().int().min(1) }))
      .min(1)
      .describe('Products and quantities to order.'),
  },
  outputSchema: {
    order_id: z.string(),
    status: z.string(),
    total: z.number().describe('Order total in US dollars.'),
  },
};

interface VendorOrder {
  id: string;
  status: string;
  total: number;
}

export async function handler(
  args: { items: { product_id: string; quantity: number }[] },
  vendor: VendorClient,
) {
  // Since 2026-10-01 the vendor only persists orders placed with an Idempotency-Key.
  const res = await vendor.post('/orders', { items: args.items }, { 'Idempotency-Key': randomUUID() });
  if (res.status !== 200) {
    const msg = (res.body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    return fail(`Order rejected: ${msg}`);
  }
  const o = res.body as VendorOrder;
  return ok({ order_id: o.id, status: o.status, total: o.total });
}
