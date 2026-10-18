// Contract suite: every recorded fixture, replayed through the current code, must satisfy
// its fiks contract. Fixes must keep these green (no regressions on the v1 baseline).
import { relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { expectRecordingHolds, isRerecording } from './check.ts';
import { recordingFiles } from './run.ts';

const root = new URL('../..', import.meta.url).pathname;
const fixtures = recordingFiles(new URL('../fixtures', import.meta.url).pathname).filter(
  (f) => !isRerecording(f),
);

describe('fiks contract suite', () => {
  test('has fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });
  for (const file of fixtures) {
    test(relative(root, file), async () => {
      await expectRecordingHolds(file, { golden: true });
    });
  }
});
