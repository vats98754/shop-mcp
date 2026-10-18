import { z } from 'zod';
import { fail, ok } from '../result.ts';
import type { VendorClient } from '../vendor.ts';

export const name = 'get_order';

export const config = {
  title: 'Get order',
  description:
    'Get an order by id (e.g. "o-5001"): status, items, total in US dollars, and when it was placed.',
  inputSchema: { order_id: z.string().describe('Order id, e.g. o-5001.') },
  outputSchema: {
    order_id: z.string(),
    status: z.string(),
    items: z.array(z.object({ product_id: z.string(), quantity: z.number().int(), unit_price: z.number() })),
    total: z.number(),
    created_at: z.string().describe('When the order was placed, ISO-8601 UTC.'),
  },
};

interface VendorOrder {
  id: string;
  status: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  total: number;
  created_at: string;
}

export async function handler(args: { order_id: string }, vendor: VendorClient) {
  const res = await vendor.get(`/orders/${encodeURIComponent(args.order_id)}`);
  if (res.status === 404) return fail(`No order with id ${args.order_id}.`);
  const o = res.body as VendorOrder;
  const createdAt = new Date(Date.parse(String(o.created_at)) || 0);
  return ok({
    order_id: o.id,
    status: o.status,
    items: o.items,
    total: o.total,
    created_at: createdAt.toISOString(),
  });
}
