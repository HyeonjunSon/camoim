import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardTone, cityLabel, isLocalBoard, isTradeBoard, tradeLabel } from './boards.ts';

test('a board tone comes from the app palette', () => {
  // lightBoardColors in src/constants/colors.js
  assert.equal(boardTone('market').dot, '#F97316');
  assert.equal(boardTone('free').dot, '#6366F1');
});

test('a school board borrows the university tone', () => {
  assert.equal(boardTone('uoft-free').dot, boardTone('university').dot);
  assert.equal(boardTone('ubc-anonymous').dot, boardTone('university').dot);
});

test('an unknown or missing slug falls back rather than throwing', () => {
  assert.equal(boardTone('nope').dot, '#9CA3AF');
  assert.equal(boardTone(undefined).dot, '#9CA3AF');
});

test('trade boards match the server list', () => {
  // server/constants/boards.js TRADE_BOARD_SLUGS
  for (const slug of ['market', 'giveaway', 'car', 'roomrent']) {
    assert.ok(isTradeBoard(slug), slug);
  }
  // realestate and jobs are deliberately excluded
  assert.ok(!isTradeBoard('realestate'));
  assert.ok(!isTradeBoard('jobs'));
  assert.ok(!isTradeBoard(undefined));
});

test('local boards match the server list', () => {
  assert.ok(isLocalBoard('meetup'));
  assert.ok(isLocalBoard('realestate'));
  assert.ok(!isLocalBoard('free'));
});

test('trade labels read per board, as the app does', () => {
  assert.equal(tradeLabel('market', 'selling'), '판매중');
  assert.equal(tradeLabel('market', 'sold'), '거래완료');
  assert.equal(tradeLabel('roomrent', 'selling'), '입주가능');
  assert.equal(tradeLabel('roomrent', 'sold'), '입주완료');
  assert.equal(tradeLabel('giveaway', 'sold'), '나눔완료');
});

test('a city label is display only and falls back to the stored key', () => {
  assert.equal(cityLabel('Toronto'), '토론토');
  // Metro folding can surface a city the label map does not list.
  assert.equal(cityLabel('Kitchener'), 'Kitchener');
  assert.equal(cityLabel(undefined), '');
});

test('prefix keys match the app and server lists', async () => {
  const { BOARD_PREFIXES } = await import('./boards.ts');
  // @ts-expect-error -- plain CommonJS from the server, no type declarations
  const server = (await import('../../../server/constants/boards.js')).default.BOARD_PREFIXES;
  const keysOf = (m: Record<string, { key: string; want?: boolean }[]>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map((p) => `${p.key}${p.want ? '*' : ''}`)]));
  assert.deepEqual(keysOf(BOARD_PREFIXES), keysOf(server));
});

test('prefix label and trade badge', async () => {
  const { prefixLabel, tradeBadge } = await import('./boards.ts');
  assert.equal(prefixLabel('market', 'buy'), '삽니다');
  assert.equal(prefixLabel('car', 'hiring'), '');
  assert.equal(tradeBadge('market', 'selling', 'buy'), null);
  assert.equal(tradeBadge('market', 'sold', 'buy'), 'sold');
  assert.equal(tradeBadge('market', 'selling', 'sell'), 'selling');
  assert.equal(tradeBadge('free', 'selling', ''), null);
});

test('board groups place every board once, unknown ones under 기타', async () => {
  const { groupBoards } = await import('./boards.ts');
  const out = groupBoards([{ slug: 'jobs' }, { slug: 'free' }, { slug: 'brand-new' }, { slug: 'market' }]);
  assert.deepEqual(
    out.map((s) => [s.title, s.boards.map((b) => b.slug)]),
    [['소통', ['free']], ['사고팔고', ['market']], ['집·일자리', ['jobs']], ['기타', ['brand-new']]]
  );
});
