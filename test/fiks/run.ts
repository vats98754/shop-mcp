// Runs a recorded tool call in-process against a strict replay of its upstream HTTP,
// then checks the result against the vendored fiks contract.
import { type Dirent, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { vi } from 'vitest';
import { z } from 'zod';
import * as handlers from '../../src/tools/handlers.ts';
import { createVendorClient } from '../../src/vendor.ts';
import { startReplay } from './replay.ts';
import { buildProbeArgs, evaluate, findContract } from './vendored/evaluate.ts';
import contractsJson from './vendored/shop-mcp.contracts.json' with { type: 'json' };
import type { ContractFile, EvalResult, HttpExchange, JsonSchema, Recording } from './vendored/types.ts';

export const CONTRACTS = contractsJson as ContractFile;

/**
 * During a replay the process clock reads 10 years after capture. Contracts are evaluated at
 * `capturedAt`, so a tool that invents "now" instead of reporting upstream data is caught.
 */
const CLOCK_SKEW_MS = 10 * 365 * 86_400_000;

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
  probe?: { tool: string; args: Record<string, unknown>; result: CallToolResult; upstream: HttpExchange[] };
  evaluation: EvalResult;
  /** Requests the current code made that the recording does not hold. */
  unmatched: string[];
}

const EMPTY: EvalResult = { verdict: 'unverifiable', contractId: null, checked: [], violations: [] };

/**
 * Replays `rec` through the current tool code and evaluates its contract at `capturedAt`.
 * If the code makes an unrecorded request, the recording does not apply to this code:
 * that is reported through `unmatched` (even if the code then throws on the 599).
 */
export async function replayRecording(rec: Recording): Promise<Replayed> {
  const replay = await startReplay([...rec.http, ...(rec.probe?.http ?? [])]);
  try {
    const vendor = createVendorClient(replay.url);
    const contract = findContract(CONTRACTS, rec.tool);
    const post = contract?.postconditions?.[0];
    let result: CallToolResult;
    let probe: Replayed['probe'];
    let upstream: typeof replay.served;
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(rec.capturedAt) + CLOCK_SKEW_MS });
    try {
      result = await tool(rec.tool).handler(rec.args as never, vendor);
      upstream = [...replay.served];
      if (post && result.structuredContent && !result.isError) {
        const args = buildProbeArgs(post, result.structuredContent);
        const before = replay.served.length;
        const probeResult = await tool(post.probeTool).handler(args as never, vendor);
        probe = { tool: post.probeTool, args, result: probeResult, upstream: replay.served.slice(before) };
      }
    } catch (e) {
      if (replay.unmatched.length > 0) {
        return {
          result: { content: [], isError: true },
          evaluation: EMPTY,
          unmatched: [...replay.unmatched],
        };
      }
      throw e;
    } finally {
      vi.useRealTimers();
    }
    const evaluation = evaluate(contract, {
      args: rec.args,
      result,
      now: new Date(rec.capturedAt),
      declaredOutputSchema: declaredOutputSchema(rec.tool),
      probe,
      upstream,
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
