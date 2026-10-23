import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../cloudflare-preview/index.html', import.meta.url), 'utf8');
test('Mortal preview has expected brand and icon', () => {
  assert.match(html, /<title>Mortal /);
  assert.match(html, /data:image\/png;base64,/);
  assert.doesNotMatch(html, /<div class="brand-name">AVA/);
});
test('Mortal preview contains demo initialization and persistence', () => {
  assert.match(html, /mortal_demo_v1/);
  assert.match(html, /localStorage/);
  assert.match(html, /initialize\(\)/);
});
