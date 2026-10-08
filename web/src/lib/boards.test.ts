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
