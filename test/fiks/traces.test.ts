// Stored traces: real violations fiks captured. Once a trace is fixed, it must stay fixed.
import { relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { expectRecordingHolds, isRerecording } from './check.ts';
import { recordingFiles } from './run.ts';

const root = new URL('../..', import.meta.url).pathname;
const traces = recordingFiles(new URL('../traces', import.meta.url).pathname).filter(
  (f) => !isRerecording(f),
);

describe('fiks stored traces', () => {
  test('trace store is readable', () => {
    expect(Array.isArray(traces)).toBe(true);
  });
  for (const file of traces) {
    test(relative(root, file), async () => {
      await expectRecordingHolds(file);
    });
  }
});
