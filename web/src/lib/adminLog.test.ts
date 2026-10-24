import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminActionLabel, summarizeMeta } from './adminLog.ts';

test('action labels, with settings and unknown actions falling back', () => {
  assert.equal(adminActionLabel('post.hide'), '글 숨김');
  assert.equal(adminActionLabel('setting.maintenance'), '설정 변경 (maintenance)');
  assert.equal(adminActionLabel('brand.new'), 'brand.new');
});

test('meta summary flattens one level and skips empties', () => {
  assert.equal(summarizeMeta({ count: 3, target: { city: 'Toronto', role: '' } }), 'count: 3 · target: city=Toronto');
  assert.equal(summarizeMeta({ reason: '' }), '');
  assert.equal(summarizeMeta(undefined), '');
  assert.ok(summarizeMeta({ x: 'y'.repeat(300) }).endsWith('…'));
});
