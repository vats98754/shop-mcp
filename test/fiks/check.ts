// The one assertion every fiks recording test makes: replaying a recorded call through the
// current code satisfies its contract.
//
// A recording "applies" when the current code makes only upstream requests it holds. When a
// fix legitimately changes the upstream requests (sends a new header, fetches the next page),
// the recording no longer applies; fiks then re-records the same call against the same
// upstream (same version, behavior and frozen clock) into `<name>.rerecorded.json`, and that
// recording must apply and pass instead.
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { type Replayed, replayRecording } from './run.ts';
import type { Recording } from './vendored/types.ts';

export const rerecordedPath = (file: string) => file.replace(/\.json$/, '.rerecorded.json');
export const isRerecording = (file: string) => file.endsWith('.rerecorded.json');
export const loadRecording = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Recording;

export interface HoldsOptions {
  /** Contract properties not to assert (faults outside this recording's scope). */
  ignore?: string[];
  /** Contract properties that must actually be evaluated (a trace's target). */
  mustCheck?: string[];
  /**
   * Known-good fixture: the output must equal the recorded output. A re-recording is
   * compared against the original fixture's output, so re-recording never hides a change.
   */
  golden?: boolean;
}

/** For a stored trace: the properties its fix must repair. */
export function targetOf(rec: Recording): string[] {
  return rec.target ?? (rec.violated ?? []).map((v) => v.propertyId);
}

/** For a stored trace: properties it violated that are not its target (fixed elsewhere). */
export function outOfScope(rec: Recording): string[] {
  const violated = (rec.violated ?? []).map((v) => v.propertyId);
  const target = rec.target ?? violated;
  return violated.filter((p) => !target.includes(p));
}

export async function expectRecordingHolds(file: string, opts: HoldsOptions = {}): Promise<Replayed> {
  const rec = loadRecording(file);
  let r = await replayRecording(rec);
  let used = file;
  if (r.unmatched.length > 0) {
    const alt = rerecordedPath(file);
    if (!existsSync(alt)) {
      expect.fail(
        `UNMATCHED_REQUEST: the current code makes upstream requests ${file} never recorded ` +
          `(${r.unmatched.join('; ')}). If this is intended, re-record it with \`fiks rerecord\`.`,
      );
    }
    const altRec = loadRecording(alt);
    // A re-recording stands in for the original only if it is the same call against the same
    // upstream: same tool, arguments, upstream profile (version, behavior, clock) and version.
    const same = (x: Recording) =>
      JSON.stringify([x.tool, x.args, x.upstream ?? null, x.vendorVersionHeader ?? null]);
    expect(same(altRec), `re-recording does not match the original call and upstream (${alt})`).toBe(
      same(rec),
    );
    r = await replayRecording(altRec);
    used = alt;
    expect(r.unmatched, `UNMATCHED_REQUEST in ${used}`).toEqual([]);
  }
  if (opts.golden && rec.result) {
    const golden = rec.result;
    const label = `golden output changed (${used} vs ${file})`;
    expect(Boolean(r.result.isError), label).toBe(Boolean(golden.isError));
    if (golden.isError) expect(r.result.content, label).toEqual(golden.content);
    else expect(r.result.structuredContent, label).toEqual(golden.structuredContent);
  }
  // Refusing is not repairing: a call that returned data must still return data.
  if (rec.result && !rec.result.isError) {
    const text = (r.result.content as { text?: string }[] | undefined)?.map((c) => c.text).join(' ');
    expect(Boolean(r.result.isError), `tool now returns an error instead of data (${used}): ${text}`).toBe(
      false,
    );
  }
  const unchecked = (opts.mustCheck ?? []).filter((p) => !r.evaluation.checked.includes(p));
  expect(unchecked, `target properties were not evaluated (${used})`).toEqual([]);
  const ignore = opts.ignore ?? [];
  const violations = r.evaluation.violations
    .filter((v) => !ignore.includes(v.propertyId))
    .map((v) => `${v.propertyId}: ${v.message}`);
  const label = violations.length ? violations.map((v) => v.split(':')[0]).join(', ') : 'contract';
  expect(violations, `${label} violated (${used})`).toEqual([]);
  return r;
}
