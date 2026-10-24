import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockTime, dayLabel, markReadBy, unreadMark } from './chat.ts';

test('my unread dm message shows 1', () => {
  assert.equal(unreadMark({ senderId: 'me', readBy: ['me'] }, 'me', 'dm'), 1);
});

test('the mark clears once the other side has read it', () => {
  assert.equal(unreadMark({ senderId: 'me', readBy: ['me', 'you'] }, 'me', 'dm'), 0);
});

test('never on their messages or in group and school rooms', () => {
  assert.equal(unreadMark({ senderId: 'you', readBy: ['you'] }, 'me', 'dm'), 0);
  assert.equal(unreadMark({ senderId: 'me', readBy: ['me'] }, 'me', 'group'), 0);
  assert.equal(unreadMark({ senderId: 'me', readBy: ['me'] }, 'me', 'school'), 0);
});

test('a read event adds the reader once and keeps the rest', () => {
  const out = markReadBy([{ readBy: ['me'] }, { readBy: ['me', 'you'] }], 'you');
  assert.deepEqual(out, [{ readBy: ['me', 'you'] }, { readBy: ['me', 'you'] }]);
});

test('clock time reads 오전/오후 regardless of the runtime locale', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 15, h, m).toISOString();
  assert.equal(clockTime(at(16, 11)), '오후 4:11');
  assert.equal(clockTime(at(0, 5)), '오전 12:05');
  assert.equal(clockTime(at(12, 0)), '오후 12:00');
  assert.equal(clockTime('nope'), '');
});

test('day label: today, this year, an earlier year', () => {
  const now = new Date(2026, 9, 15, 9);
  assert.equal(dayLabel(new Date(2026, 9, 15, 23).toISOString(), now), '오늘');
  assert.equal(dayLabel(new Date(2026, 2, 3).toISOString(), now), '3월 3일');
  assert.equal(dayLabel(new Date(2025, 11, 31).toISOString(), now), '2025년 12월 31일');
});

test('english clock and day labels', () => {
  const now = new Date(2026, 9, 15, 9);
  assert.equal(clockTime(new Date(2026, 9, 15, 16, 11).toISOString(), 'en'), '4:11 PM');
  assert.equal(dayLabel(new Date(2026, 9, 15, 23).toISOString(), now, 'en'), 'Today');
  assert.equal(dayLabel(new Date(2026, 2, 3).toISOString(), now, 'en'), 'Mar 3');
  assert.equal(dayLabel(new Date(2025, 11, 31).toISOString(), now, 'en'), 'Dec 31, 2025');
});
