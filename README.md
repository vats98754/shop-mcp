# shop-mcp

An MCP server that wraps the vendor shop HTTP API.

| Tool | Vendor call |
|---|---|
| `search_products` | `GET /products?q=` |
| `get_product` | `GET /products/{id}` |
| `create_order` | `POST /orders` |
| `get_order` | `GET /orders/{id}` |

Every tool declares an `outputSchema` and returns `structuredContent`.

```bash
pnpm install
VENDOR_BASE_URL=http://127.0.0.1:4010 pnpm start               # stdio
VENDOR_BASE_URL=http://127.0.0.1:4010 pnpm start --http 3333   # Streamable HTTP at /mcp
```

## Tests

CI runs `pnpm typecheck`, `pnpm lint` and `pnpm test` on every push and pull request.

- `test/fiks/contracts.test.ts` replays every recorded fixture in `test/fixtures/**` through the current code and checks the fiks outcome contract.
- `test/fiks/traces.test.ts` does the same for every captured failure trace in `test/traces/`. A fixed trace must stay fixed.
- `test/repro/` holds reproduction tests generated from traces.
- `test/fiks/vendored/` is generated from the fiks contracts package. Do not edit it.

Replays are strict. A request with a different method, path, body or set of significant headers counts as unrecorded. When a change legitimately alters the upstream requests, the old recording no longer applies. In that case a `<name>.rerecorded.json` of the same call, made against the same upstream version, must exist and pass.
