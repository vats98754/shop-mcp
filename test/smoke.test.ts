import { expect, test } from 'vitest';
import { SERVER_NAME } from '../src/index.ts';

test('server module loads', () => {
  expect(SERVER_NAME).toBe('shop-mcp');
});
