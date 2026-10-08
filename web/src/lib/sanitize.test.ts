import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizePostHtml } from './sanitize.ts';

// Post bodies are HTML written by one user and rendered into another's page, so
// these cases are the contract that makes dangerouslySetInnerHTML safe.
// Run with: npm run test

test('strips script tags and their contents', () => {
  const out = sanitizePostHtml('<p>hi</p><script>alert(document.cookie)</script>');
  assert.equal(out, '<p>hi</p>');
});

test('strips inline event handlers', () => {
  const out = sanitizePostHtml('<img src="https://res.cloudinary.com/a.jpg" onerror="alert(1)">');
  assert.ok(!out.includes('onerror'));
  assert.ok(out.includes('https://res.cloudinary.com/a.jpg'));
});

test('drops javascript: and data: URLs on links', () => {
  assert.ok(!sanitizePostHtml('<a href="javascript:alert(1)">x</a>').includes('javascript:'));
  assert.ok(!sanitizePostHtml('<a href="data:text/html,<script>">x</a>').includes('data:'));
});

test('rejects a non-https image source', () => {
  // A data: or http: image is either an exfiltration trick or mixed content.
  assert.ok(!sanitizePostHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">').includes('data:'));
  assert.ok(!sanitizePostHtml('<img src="http://evil.test/p.gif">').includes('http://evil.test'));
});

test('removes iframe, object and embed', () => {
  const out = sanitizePostHtml('<iframe src="https://evil.test"></iframe><object></object><embed>');
  assert.ok(!/iframe|object|embed/.test(out));
});

test('keeps only text alignment from a style attribute', () => {
  const out = sanitizePostHtml(
    '<p style="text-align:center;position:fixed;background:url(https://evil.test/t.gif)">x</p>'
  );
  assert.ok(out.includes('text-align:center'));
  assert.ok(!out.includes('position'));
  assert.ok(!out.includes('evil.test'));
});

test('keeps the marks both editors can produce', () => {
  // pell emits these through execCommand; TipTap emits the same set.
  const input = '<p><strong>b</strong><em>i</em><u>u</u></p><h2>h</h2><ul><li>l</li></ul>';
  assert.equal(sanitizePostHtml(input), input);
});

test('hardens an outbound link', () => {
  const out = sanitizePostHtml('<a href="https://example.test">x</a>');
  assert.ok(out.includes('target="_blank"'));
  assert.ok(out.includes('rel="nofollow ugc noopener noreferrer"'));
});

test('an image carries no referrer and loads lazily', () => {
  const out = sanitizePostHtml('<img src="https://res.cloudinary.com/demo/a.jpg">');
  assert.ok(out.includes('referrerpolicy="no-referrer"'));
  assert.ok(out.includes('loading="lazy"'));
});

test('an empty or missing body is an empty string', () => {
  assert.equal(sanitizePostHtml(undefined), '');
  assert.equal(sanitizePostHtml(''), '');
});
