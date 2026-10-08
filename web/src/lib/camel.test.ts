import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCamel } from './camel.ts';

// Mirrors the app's own toCamel tests: every client reads `.id`, never `._id`.
test('_id becomes id at every depth', () => {
  assert.deepEqual(toCamel({ _id: 'a', author: { _id: 'b' } }), { id: 'a', author: { id: 'b' } });
});

test('snake_case keys become camelCase', () => {
  assert.deepEqual(toCamel({ like_count: 1, trade_status: 'sold' }), {
    likeCount: 1,
    tradeStatus: 'sold',
  });
});

test('arrays are walked', () => {
  assert.deepEqual(toCamel([{ _id: '1' }, { _id: '2' }]), [{ id: '1' }, { id: '2' }]);
});

test('values are left alone', () => {
  // role is stored snake_case on the server and must stay that way.
  assert.deepEqual(toCamel({ role: 'working_holiday' }), { role: 'working_holiday' });
});

test('null and primitives pass through', () => {
  assert.equal(toCamel(null), null);
  assert.equal(toCamel(3), 3);
  assert.deepEqual(toCamel({ a: null }), { a: null });
});
