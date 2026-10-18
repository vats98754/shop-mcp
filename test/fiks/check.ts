// The one assertion every fiks recording test makes: replaying a recorded call through the
// current code satisfies its contract.
//
// A recording "applies" when the current code makes exactly the upstream requests it holds.
// When a fix legitimately changes the upstream requests (sends a new header, fetches the next
// page), the recording no longer applies; fiks then re-records the same call against the same
// upstream version into `<name>.rerecorded.json`, and that recording must apply and pass.
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'vitest';
import { type Replayed, replayRecording } from './run.ts';
import type { Recording } from './vendored/types.ts';

export const rerecordedPath = (file: string) => file.replace(/\.json$/, '.rerecorded.json');
export const isRerecording = (file: string) => file.endsWith('.rerecorded.json');

const load = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Recording;

/**
 * Asserts the recording at `file` holds. With `propertyId`, only that contract property is
 * asserted (repro tests); otherwise every property of the contract must hold.
 */
export async function expectRecordingHolds(file: string, propertyId?: string): Promise<Replayed> {
  let r = await replayRecording(load(file));
  let used = file;
  if (r.unmatched.length > 0) {
    const alt = rerecordedPath(file);
    if (!existsSync(alt)) {
      expect.fail(
        `UNMATCHED_REQUEST: the current code makes upstream requests ${file} never recorded ` +
          `(${r.unmatched.join('; ')}). If this is intended, re-record it with \`fiks rerecord\`.`,
      );
    }
    r = await replayRecording(load(alt));
    used = alt;
    expect(r.unmatched, `UNMATCHED_REQUEST in ${used}`).toEqual([]);
  }
  const violations = r.evaluation.violations
    .filter((v) => !propertyId || v.propertyId === propertyId)
    .map((v) => `${v.propertyId}: ${v.message}`);
  expect(violations, `${propertyId ?? 'contract'} violated (${used})`).toEqual([]);
  return r;
}
