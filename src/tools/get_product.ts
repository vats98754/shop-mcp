import { z } from 'zod';
import { fail, ok } from '../result.ts';
import type { VendorClient } from '../vendor.ts';

export const name = 'get_product';

export const config = {
  title: 'Get product',
  description: 'Get one product by id (e.g. "p-1001"), including its price in US dollars and stock.',
  inputSchema: { id: z.string().describe('Product id, e.g. p-1001.') },
  outputSchema: {
    id: z.string(),
    name: z.string(),
    category: z.string(),
    price: z.number().nullable().describe('Unit price in US dollars, or null if unpriced.'),
    currency: z.string(),
    in_stock: z.boolean(),
  },
};

interface VendorProduct {
  id: string;
  name: string;
  category: string;
  price?: number | null;
  /** Replaces `price` from vendor-api-version 2026-10-01 (same unit: dollars). */
  unit_amount?: number | null;
  currency: string;
  stock: number;
}

export async function handler(args: { id: string }, vendor: VendorClient) {
  const res = await vendor.get(`/products/${encodeURIComponent(args.id)}`);
  if (res.status === 404) return fail(`No product with id ${args.id}.`);
  const p = res.body as VendorProduct;
  return ok({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price ?? p.unit_amount ?? null,
    currency: p.currency,
    in_stock: p.stock > 0,
  });
}
