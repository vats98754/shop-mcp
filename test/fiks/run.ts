// Runs a recorded tool call in-process against a strict replay of its upstream HTTP,
// then checks the result against the vendored fiks contract.
import { type Dirent, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as handlers from '../../src/tools/handlers.ts';
import { createVendorClient } from '../../src/vendor.ts';
import { startReplay } from './replay.ts';
import { buildProbeArgs, evaluate, findContract } from './vendored/evaluate.ts';
import contractsJson from './vendored/shop-mcp.contracts.json' with { type: 'json' };
import type { ContractFile, EvalResult, JsonSchema, Recording } from './vendored/types.ts';

export const CONTRACTS = contractsJson as ContractFile;

interface ToolModule {
  name: string;
  config: { outputSchema: z.ZodRawShape };
  handler(args: never, vendor: ReturnType<typeof createVendorClient>): Promise<CallToolResult>;
}

const TOOLS = new Map<string, ToolModule>(
  Object.values(handlers as unknown as Record<string, ToolModule>).map((m) => [m.name, m]),
);

export function tool(name: string): ToolModule {
  const t = TOOLS.get(name);
  if (!t) throw new Error(`unknown tool ${name}`);
  return t;
}

export function declaredOutputSchema(name: string): JsonSchema {
  return z.toJSONSchema(z.object(tool(name).config.outputSchema)) as JsonSchema;
}

export interface Replayed {
  result: CallToolResult;
  probe?: { tool: string; args: Record<string, unknown>; result: CallToolResult };
  evaluation: EvalResult;
  unmatched: string[];
}

/** Replays `rec` through the current tool code and evaluates its contract at `capturedAt`. */
export async function replayRecording(rec: Recording): Promise<Replayed> {
  const replay = await startReplay([...rec.http, ...(rec.probe?.http ?? [])]);
  try {
    const vendor = createVendorClient(replay.url);
    const result = await tool(rec.tool).handler(rec.args as never, vendor);
    const contract = findContract(CONTRACTS, rec.tool);
    let probe: Replayed['probe'];
    const post = contract?.postconditions?.[0];
    if (post && result.structuredContent && !result.isError) {
      const args = buildProbeArgs(post, result.structuredContent);
      probe = {
        tool: post.probeTool,
        args,
        result: await tool(post.probeTool).handler(args as never, vendor),
      };
    }
    const evaluation = evaluate(contract, {
      args: rec.args,
      result,
      now: new Date(rec.capturedAt),
      declaredOutputSchema: declaredOutputSchema(rec.tool),
      probe,
    });
    return { result, probe, evaluation, unmatched: [...replay.unmatched] };
  } finally {
    await replay.close();
  }
}

/** Every `*.json` file under `dir`, recursively, sorted. Missing dir -> []. */
export function recordingFiles(dir: string): string[] {
  let entries: Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...recordingFiles(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}
