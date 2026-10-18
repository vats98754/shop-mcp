// The one assertion every fiks recording test makes: replaying a recorded call through the
// current code satisfies its contract.
//
// A recording "applies" when the current code makes only upstream requests it holds. When a
// fix legitimately changes the upstream requests (sends a new header, fetches the next page),
// the recording no longer applies; fiks then re-records the same call against the same
// upstream into `<name>.rerecorded.json`, and that recording must apply and pass.
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { type Replayed, replayRecording } from './run.ts';
import type { Recording } from './vendored/types.ts';

export const rerecordedPath = (file: string) => file.replace(/\.json$/, '.rerecorded.json');
export const isRerecording = (file: string) => file.endsWith('.rerecorded.json');
export const loadRecording = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Recording;

export interface HoldsOptions {
  /** Assert only these contract properties (repro tests, stored traces). Default: all. */
  propertyIds?: string[];
  /** Known-good fixture: when it applies, the output must equal the recorded output. */
  golden?: boolean;
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
    r = await replayRecording(loadRecording(alt));
    used = alt;
    expect(r.unmatched, `UNMATCHED_REQUEST in ${used}`).toEqual([]);
  } else if (opts.golden && rec.result?.structuredContent) {
    expect(r.result.structuredContent, `golden output changed (${file})`).toEqual(
      rec.result.structuredContent,
    );
  }
  const only = opts.propertyIds;
  const label = only?.length ? only.join(', ') : 'contract';
  const violations = r.evaluation.violations
    .filter((v) => !only?.length || only.includes(v.propertyId))
    .map((v) => `${v.propertyId}: ${v.message}`);
  expect(violations, `${label} violated (${used})`).toEqual([]);
  return r;
}
