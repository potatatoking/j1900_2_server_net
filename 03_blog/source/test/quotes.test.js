import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('daily quote collection has 60 complete entries', async () => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const source = await fs.readFile(path.join(root, 'public/quotes.js'), 'utf8');
  const quotes = vm.runInNewContext(`${source}\ndailyQuotes`);
  assert.equal(quotes.length, 60);
  assert.ok(quotes.every(entry => entry.length === 3 && entry.every(Boolean)));
  assert.equal(new Set(quotes.map(entry => entry[0])).size, 60);
});
