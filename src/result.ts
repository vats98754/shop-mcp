import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function ok<T extends Record<string, unknown>>(data: T): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
