# shop-mcp

An MCP server that wraps the vendor shop HTTP API. Tools: `search_products`, `get_product`, `create_order`, `get_order`.

```bash
pnpm install
VENDOR_BASE_URL=http://localhost:4010 pnpm start          # stdio
VENDOR_BASE_URL=http://localhost:4010 pnpm start --http 3333   # Streamable HTTP
```

CI runs typecheck, lint and the full test suite (contract suite and stored traces) on every push and pull request.
