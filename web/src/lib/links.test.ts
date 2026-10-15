import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the mistake that shipped a broken home banner: /notices/[id] was linked
 * from day one and the route was never built, so tapping the notice 404'd. A
 * dead internal link is invisible in a typecheck and in a build — only a click
 * finds it — so it is checked here instead.
 *
 * Run from web/, which is where `npm test` runs.
 */
const APP = path.join('src', 'app');
const SEARCH_ROOTS = [APP, path.join('src', 'components')];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Route groups — `(site)`, `(auth)` — shape layouts but never the URL. */
function routeOf(pageFile: string): string {
  const rel = path.relative(APP, path.dirname(pageFile));
  const segs = rel
    .split(path.sep)
    .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
  return '/' + segs.join('/');
}

function toRegExp(route: string): RegExp {
  const parts = route
    .split('/')
    .filter(Boolean)
    .map((seg) =>
      seg.startsWith('[...') ? '.+' : seg.startsWith('[') ? '[^/]+' : escape(seg)
    );
  return new RegExp(parts.length ? `^/${parts.join('/')}$` : '^/$');
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const routes = walk(APP)
  .filter((f) => path.basename(f) === 'page.tsx')
  .map(routeOf);

const patterns = routes.map(toRegExp);

/**
 * Only `href=` is read, not every path-shaped string. A broader scan also picks
 * up the paths handed to apiFetch, which carry no `/api` prefix of their own and
 * are not navigations.
 */
const HREF = /href=(?:"(\/[^"]*)"|\{`(\/[^`]*)`\}|\{'(\/[^']*)'\})/g;

function internalHrefs(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const root of SEARCH_ROOTS) {
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(HREF)) {
        const raw = m[1] ?? m[2] ?? m[3];
        if (!raw) continue;
        // A `${…}` stands for one segment; a query or hash does not route.
        const normalised =
          raw.replace(/\$\{[^}]*\}/g, 'x').split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
        if (!found.has(normalised)) found.set(normalised, new Set());
        found.get(normalised)!.add(file);
      }
    }
  }
  return found;
}

test('the app directory yields the routes we expect', () => {
  // A sanity check on the walker itself: if this breaks, the assertions below
  // would pass by finding nothing to check.
  assert.ok(routes.length > 20, `found only ${routes.length} routes`);
  for (const expected of ['/', '/boards/[slug]', '/posts/[id]', '/notices/[id]', '/chat/[roomId]']) {
    assert.ok(routes.includes(expected), `missing route ${expected}`);
  }
});

test('every internal href points at a route that exists', () => {
  const found = internalHrefs();
  assert.ok(found.size > 15, `found only ${found.size} hrefs`);

  const dead: string[] = [];
  for (const [href, files] of found) {
    if (patterns.some((p) => p.test(href))) continue;
    dead.push(`${href}  (in ${[...files].join(', ')})`);
  }
  assert.deepEqual(dead, [], `dead internal links:\n${dead.join('\n')}`);
});

test('every route can be reached from somewhere', () => {
  // Reachability needs the wider net: the header nav holds its hrefs in an
  // array, the map builds its row href into a variable, and the map's submit
  // button picks one with a ternary — none of which `href=` sees.
  const literals = new Set<string>();
  const LITERAL = /["'`](\/[^"'`\s]*)["'`]/g;
  for (const root of SEARCH_ROOTS) {
    for (const file of walk(root)) {
      for (const m of readFileSync(file, 'utf8').matchAll(LITERAL)) {
        const raw = m[1];
        if (/^\/(api|_next|uploads)(\/|$)/.test(raw) || raw.startsWith('//')) continue;
        literals.add(
          raw.replace(/\$\{[^}]*\}/g, 'x').split('?')[0].split('#')[0].replace(/\/$/, '') || '/'
        );
      }
    }
  }

  const unreachable = routes.filter(
    (route, i) => ![...literals].some((l) => patterns[i].test(l))
  );
  assert.deepEqual(unreachable, [], `routes with no link into them: ${unreachable.join(', ')}`);
});
