import { z } from 'zod';
import { ok } from '../result.ts';
import type { VendorClient } from '../vendor.ts';

export const name = 'search_products';

export const config = {
  title: 'Search products',
  description: 'Search the catalog by name or category (e.g. "laptop", "cable"). Prices are in US dollars.',
  inputSchema: {
    query: z
      .string()
      .describe(
        'One phrase found in the product name (case-insensitive), or an exact category: laptop, monitor, cable, dock, keyboard. A multi-word query must appear in the name in that order.',
      ),
  },
  outputSchema: {
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        price: z.number().describe('Unit price in US dollars.'),
        currency: z.string(),
      }),
    ),
    count: z.number().int().describe('Number of items returned.'),
    total: z.number().int().describe('Number of products matching the query.'),
  },
};

interface VendorProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
}

export async function handler(args: { query: string }, vendor: VendorClient) {
  const res = await vendor.get(`/products?q=${encodeURIComponent(args.query)}`);
  const body = res.body as { items: VendorProduct[]; total: number };
  const items = body.items.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    currency: p.currency,
  }));
  return ok({ items, count: items.length, total: body.total });
}
