# CaMoim Web

The browser client for CaMoim, sharing the Railway API, MongoDB Atlas database and
Cloudinary media of the Expo app in the repository root.

```
[browser] ──httpOnly cookie──▶ [Next.js on Vercel] ──Bearer JWT──▶ [Railway API]
                                                                        │
                                                        MongoDB Atlas · Cloudinary
```

## Why a BFF

The browser never talks to the Railway API directly. It calls this app, which
holds the JWT in an httpOnly cookie and attaches it as a `Bearer` header server
side. Three things follow:

- An XSS hole in the post renderer cannot read a 30-day token. Post bodies come
  from the app's rich-text editor, so that renderer is the one place HTML from
  another user is executed, which makes this the risk worth designing around.
- The cookie is same-site, so there is no `SameSite=None` and no CSRF token
  exchange. Writes are gated on an `Origin`/`Host` match instead.
- The API needs no CORS or cookie-auth changes. `middleware/auth.js` keeps
  reading `Authorization: Bearer` exactly as the app sends it.

The one place a token is handled is `src/app/api/auth/login/route.ts` (and
`register`). `src/app/api/bff/[...path]/route.ts` refuses every endpoint that
mints a JWT, so one can never be returned into page JavaScript.

## Layout

| Path | What it holds |
|---|---|
| `src/middleware.ts` | Auth gating, before anything renders |
| `src/app/page.tsx` | Home — three columns, server-rendered |
| `src/app/boards/` | Board index and one board's feed |
| `src/app/posts/[id]/` | Post detail, and its editor |
| `src/app/write/` | New post |
| `src/app/search/` | Posts, groups and members in one list |
| `src/app/(auth)/` | Login and signup |
| `src/app/api/auth/*` | The only routes that see a JWT |
| `src/app/api/bff/[...path]` | Authenticated passthrough for client components |
| `src/app/api/upload/image` | Multipart passthrough to Cloudinary |
| `src/app/api/rate` | CAD→KRW, cached 10 minutes |
| `src/lib/sanitize.ts` | The allowlist every post body passes through |
| `src/lib/api.ts` | Server-side calls to Railway |
| `src/lib/boards.ts` | Board tones, cities, trade-board slugs |
| `src/lib/legal.ts` | Re-exports the app's `src/constants/legal.js` |

## Rendering other people's HTML

Post bodies are written by users through the app's pell editor, which makes the
post renderer the only place in the product where one user's markup lands in
another's page. Nothing reaches `dangerouslySetInnerHTML` without passing
`sanitizePostHtml`, whose allowlist is drawn from what the two editors can
actually emit; `src/lib/sanitize.test.ts` pins the behaviour.

The web editor's toolbar is deliberately the same set pell offers — image, bold,
italic, underline, H2, align — and `codeBlock`, `blockquote` and
`horizontalRule` are switched off in `PostEditor.tsx`. A mark TipTap can produce
but pell cannot would render as unstyled text on a phone.

## Three things that bite

- **Auth redirects belong in middleware.** A `redirect()` inside a page runs
  during the render; once the shell has started streaming, the status code is
  already sent. The visitor gets a 200 that redirects late, or not at all.
- **`loading.tsx` creates that same streaming boundary.** With one in place a
  missing post answered 200 instead of 404, because `notFound()` ran after the
  flush. There are none in this app for that reason.
- **`GET /api/posts/:id` increments `viewCount`.** Every link to a post detail
  therefore carries `prefetch={false}`; without it, hovering a feed row inflates
  the count.

## Shared with the app

Four things must not drift. Three are mirrored with a comment naming the
original; one is imported outright:

- `src/lib/boards.ts` ← `src/constants/colors.js`, `src/constants/boards.js`,
  `src/constants/cities.js`
- `src/lib/stays.ts` ← `src/constants/stays.js`
- `src/lib/camel.ts` ← the `toCamel` in `src/lib/api.js` (`_id` → `id`; always
  read `.id`, never `._id`)
- `src/lib/legal.ts` **imports** `../../../src/constants/legal.js`, so the terms
  shown here are the same text the app shows. That is why `turbopack.root` in
  `next.config.ts` points at the repo root rather than `web/`.

## Web-only colour tokens

Two app values fail WCAG AA on a white page and are replaced in
`src/app/globals.css`. The app side is untouched.

| App | Contrast | Web token |
|---|---|---|
| `primary` `#7F77DD` with white text | 3.6:1 | `--color-brand-strong` `#6B63D0` (4.6:1) |
| `textSecondary` `#888888` on white | 3.5:1 | `--color-muted` `#6E6E73` (4.8:1) |

`#7F77DD` is still used for the logo tile and board dots, where nothing sits on
top of it.

## Running it

```bash
cp .env.example .env.local   # CAMOIM_API_URL points at Railway by default
npm install
npm run dev                  # http://localhost:3000
npm run typecheck
npm test                     # Node's own runner, native TypeScript — needs Node 23.6+
npm run build
```

Pointing `CAMOIM_API_URL` at `http://localhost:4000/api` runs against a local
backend (`cd ../server && node index.js`).

## Known gap in the API's search

`GET /api/search` matches every post, school boards and group posts included —
it is not scoped to what the viewer may read. `visiblePosts()` in
`src/app/search/page.tsx` filters those out on the server before rendering. The
app has the same exposure, so the real fix belongs upstream.

## Not built yet

Chat, notifications, the map, stay listings, groups, the school community, the
intro board, blocking and reporting, my page, and the admin pages. Links to them
resolve to the 404 page until each lands.
