# Performance

Four numbers — cold start, chat round trip, home feed load, bundle size — measured,
improved, and measured again under identical conditions.

- [Results](#results)
- [The finding that drove everything: 70 ms per database round trip](#the-finding-70-ms-per-database-round-trip)
- [What changed](#what-changed)
- [Cold start](#cold-start)
- [Methodology](#methodology)
- [Reproducing](#reproducing)

---

## Results

### Server latency — p50 / p95, 40 samples each

Measured with [`server-bench.js`](server-bench.js): the real Express app and Socket.io server
against MongoDB behind a TCP proxy that injects **70 ms per round trip** — the value measured
in production (see below).

| | Before | After | Δ p50 |
|---|---|---|---|
| **Home feed** — 5 APIs in parallel, wall clock | 393 / 462 ms | **156 / 159 ms** | **−60%** |
| **Chat, DM** — send → peer receives | 299 / 303 ms | **152 / 154 ms** | **−49%** |
| Chat, group — send → peer receives | 226 / 227 ms | 151 / 154 ms | −33% |
| `GET /posts/hot-by-board` | 304 / 378 ms | 85 / 88 ms | −72% |
| `GET /posts/home-sections` | 303 / 329 ms | 79 / 81 ms | −74% |
| `GET /boards` | 150 / 158 ms | 76 / 77 ms | −49% |
| `GET /notices` | 151 / 159 ms | 77 / 79 ms | −49% |
| `GET /notifications/unread-count` | 150 / 154 ms | 151 / 153 ms | — |

Raw data: [`results/server-bench-before.json`](results/server-bench-before.json),
[`results/server-bench-after.json`](results/server-bench-after.json).

### Home feed payload

| | Before | After | |
|---|---|---|---|
| `hot-by-board` | 46.6 KB | **4.7 KB** | −90% |
| All 5 home requests | 61.6 KB | **19.7 KB** | −68% |

### Bundle — iOS, `expo export --dump-sourcemap` for both

| | Before | After | |
|---|---|---|---|
| JavaScript (Hermes bytecode) | 4.08 MiB | 3.77 MiB | −7.7% |
| Fonts | 11.41 MiB | 7.89 MiB | **−30.8%** |
| JS + all assets | 15.66 MiB | **11.83 MiB** | **−24.5%** |

Android is within 0.3% of iOS on every row. Raw data: [`results/bundle.json`](results/bundle.json).

### Cold start

Estimated **~480 ms** of network wait removed from the critical path; the real number comes
from production telemetry that ships with this change. See [Cold start](#cold-start) —
it's the one metric here that isn't a direct before/after measurement, and the section says
exactly why.

---

## The finding: 70 ms per database round trip

The first production measurement ([`feed-api.js`](feed-api.js), read-only `GET`s from a
client in Toronto) looked unremarkable in isolation:

```
GET /health  (no database)      94 ms    ← network baseline
GET /boards                    166 ms
GET /notices                   274 ms
GET /posts/hot-by-board        306 ms    ← response body was an empty array
GET /posts/home-sections       313 ms
```

Two things didn't fit. `hot-by-board` spent **~210 ms on the server to return nothing**. And
`/boards` — a single `find` on a 13-document collection — cost ~72 ms over the network
baseline.

Subtracting the baseline from each endpoint and dividing by the number of *sequential*
database calls in its handler gives the same answer every time:

| Endpoint | Server time | Sequential DB calls | Per call |
|---|---|---|---|
| `/boards` | ~72 ms | 1 | ~72 ms |
| `/notices` | ~179 ms | 2 (`find` → `populate`) | ~90 ms |
| `/home-sections` | ~218 ms | 3 (boards → posts → `populate`) | ~73 ms |
| `/hot-by-board` | ~212 ms | 1 + 13 parallel (pool of 10 → 2 waves) | ~70 ms |

**Every MongoDB round trip costs ~70 ms.** An application server and its database in the same
region should see 1–3 ms. This is the signature of Railway and MongoDB Atlas sitting in
different regions — and it means the dominant cost of every endpoint is not the query, it's
**how many queries run one after another**.

That reframed the whole exercise. Query tuning was irrelevant. The work was counting
sequential round trips on each hot path and removing them.

---

## What changed

### Server — fewer sequential round trips

| Path | Before | After | How |
|---|---|---|---|
| `hot-by-board` | 4 | 2 → 1 warm | 13 per-board `aggregate`s → one `$group`/`$slice` pipeline; board list cached |
| `home-sections` | 4 | 2 → 1 warm | `find` + `populate` → `aggregate` + `$lookup`; board list cached |
| `/boards` | 2 | 1 | board list cached |
| `/notices` | 2 | 1 | `populate` → `$lookup` |
| Chat `send_message` (DM) | 4 | 2 | room lookup ∥ block list; message save ∥ room update |
| Chat `send_message` (group) | 3 | 2 | message save ∥ room update |
| Chat `read_messages` | 3 | 1 | three independent writes run concurrently |

**Caching** ([`server/utils/cache.js`](../server/utils/cache.js)). Boards change a few times a
year and the block list changes when someone taps "block"; both were re-read on nearly every
request. The cache does in-flight coalescing (the home screen fires 5 requests at once — they
share one lookup) and uses a generation counter so a read that started before an invalidation
can't write stale data back after it.

Invalidation is attached to **Mongoose model hooks** on `Board` and `Block`, not sprinkled
through route handlers. Every write path — `save`, `updateOne`, `findOneAndUpdate`,
`deleteMany`, `insertMany`, `bulkWrite` — clears the cache, so a future admin route can't
forget to. Tests assert that blocking a user hides their posts on the very next request.

**Two correctness traps**, each pinned by a test:

- `aggregate()` skips Mongoose's type casting. The old `find()`-based code passed blocked user
  IDs as strings and Mongoose cast them; the same strings in a `$match` silently match nothing,
  and **blocked users' posts reappear**. The tests were mutation-checked: removing the
  `ObjectId` conversion fails three of them.
- Running "save message" and "update room" concurrently opens a hole: if the save fails
  validation, the room preview and unread counter would already be updated for a message that
  doesn't exist. The handler now validates before issuing either write, and a 2001-character
  message returns `send_error` with nothing persisted.

**Payload** (`?top=5`). The home screen requested up to 4 hot posts from each of 13 boards —
52 posts, 47 KB — then flattened, re-sorted, and kept the top 5. The endpoint now takes `top`
and returns only those 5, selected by exactly the client's algorithm (a test asserts the
results are identical). Older app builds that don't send `top` get the old response unchanged.

### Client

**Icon fonts.** 69 files imported `{ Ionicons } from '@expo/vector-icons'`. That barrel
re-exports all 19 icon families, and Metro doesn't tree-shake, so every family's font file and
glyph map shipped — 3.5 MB of fonts for icons the app never renders. Importing
`@expo/vector-icons/Ionicons` directly removed 18 of them.

**Cold start.** See the next section.

---

## Cold start

### The critical path, before

```
JS start ─► useFonts (6 files) ─► AuthProvider mounts ─► GET /auth/me ─► Home ─► 5 APIs ─► content
            └──── serial ────┘    └───────────── serial ─────────────┘       └─ serial ─┘
```

Two independent waits were chained. `AuthProvider` only mounted after fonts finished loading,
so the session check couldn't start until then. And the home screen couldn't mount until
`/auth/me` returned.

### After

```
JS start ─┬─► useFonts ──────────────────────┐
          └─► cached user (AsyncStorage) ────┴─► Home ─► 5 APIs ─► content
              └─► GET /auth/me  (background refresh — off the critical path)
```

- Providers mount immediately; only the UI waits on fonts. Font loading and session restore
  now overlap.
- **Stale-while-revalidate session.** The last user object is cached. On launch the app
  renders from it at once and refreshes `/auth/me` in the background.

### Estimate

Composed from the measured parts: production network p50 (94 ms) plus server-side time from
the benchmark.

| Segment | Before | After |
|---|---|---|
| `/auth/me` on the critical path | 94 + 150 = ~245 ms | 0 (background) |
| Home feed | 94 + 393 = ~488 ms | 94 + 156 = ~251 ms |
| **Network wait after fonts** | **~733 ms** | **~251 ms** |

That's **~480 ms (−66%)** — but it's an estimate, not a measurement. It excludes native
startup, JS evaluation, and font loading, all of which need a real device.

### Real measurement: production telemetry

[`src/lib/perf.js`](../src/lib/perf.js) records timings from real users' phones and sends
them through the app's existing analytics pipeline — no new infrastructure:

| Event | Measures |
|---|---|
| `perf_cold_start` | JS start → first home content, with `fonts_ready` and `session_ready` breakdowns |
| `perf_feed_load` | Home feed wall clock |
| `perf_chat_rtt` | Tap send → server echo arrives. The app doesn't render optimistically, so this *is* the latency the user sees |

The baseline point is set by [`src/lib/perfStart.js`](../src/lib/perfStart.js), the first
import in `index.js` — ES modules evaluate in import order, so it runs before Expo or React.
Native startup before the JS bundle loads is outside what JS can observe and isn't counted.

```bash
cd server && railway run node scripts/perf-report.js --since <OTA date>
```

### A bug fixed on the way

The old session restore cleared the token on **any** error:

```js
} catch (e) {
  await clearToken();
}
```

Opening the app offline, on a timeout, during maintenance (503), or mid-deploy (502) logged
the user out. [`src/lib/session.js`](../src/lib/session.js) now signs out only when the server
says the token is invalid — `401`, `TOKEN_REVOKED`, `ACCOUNT_BANNED`, `ACCOUNT_SUSPENDED`,
`ACCOUNT_DELETED` — and keeps the session through everything else. Each case has a test.

---

## Methodology

**Why inject latency instead of benchmarking locally.** A local `mongod` answers in ~0.1 ms, so
cutting four round trips to two shows up as noise. The proxy
([`latency-proxy.js`](latency-proxy.js)) delays each direction by RTT/2, preserving byte order
per socket, so the benchmark runs under the conditions production actually has. The RTT is the
production-derived 70 ms, not a guess.

**Calibration check.** What has to match production is the *cost per round trip*, and it
does: the benchmark's 2-query endpoints cost ~75 ms per sequential call, against 72–90 ms
derived from production. Whole-endpoint times are **not** directly comparable, and it's worth
being precise about why. The production probe ran logged out; the benchmark runs logged in,
because the app always sends a token. A token adds one sequential round trip to three
endpoints — the block-list lookup on `hot-by-board` and `home-sections`, and a role lookup on
`/boards` — so `/boards` is 72 ms of server time in the production probe and 150 ms in the
benchmark. Same code, one more query. The dataset is seeded to production's shape
(13 boards, 600 posts, 40 users).

**Nagle's algorithm.** Early runs showed round trips costing ~2× RTT. The proxy's sockets had
Nagle enabled, so small packets waited on delayed ACKs. The MongoDB driver sets `noDelay` on its
own sockets; the proxy now does too.

**Bundle comparisons need identical flags.** Exporting without `--dump-sourcemap` produced a
6.16 MB Hermes bundle against the 4.28 MB baseline, which looked like a 44% regression. It was
the flag: with matching flags the same code is 3.95 MB. Every bundle number above uses
`--dump-sourcemap` on both sides.

**What isn't measured here.**
- Anything under real network variance. Benchmark p95s are tight because the proxy injects a
  constant delay; production p95s are wider (the network baseline alone ranges 94 → 189 ms
  p50 → p95).
- Cold start on a device. Covered by telemetry, above.

### The remaining lever: region

The same benchmark with the proxy set to 2 ms — Railway and Atlas in the same region:

| | 70 ms RTT, after | 2 ms RTT, after |
|---|---|---|
| Home feed, server side | 156 ms | **9 ms** |
| Chat DM, server side | 152 ms | **11 ms** |

At that point the database disappears from the latency budget, and what's left is the user's
own network. It's an infrastructure setting, not code.

---

## Reproducing

```bash
# Production, read-only GETs. Writes nothing.
node perf/feed-api.js --n 30 --label prod

# Server benchmark. In-memory MongoDB; never touches production.
node perf/server-bench.js --rtt 70 --n 40 --hot-top 5 --label after
node perf/server-bench.js --rtt 2  --n 40 --hot-top 5 --label same-region

# Bundle
npx expo export --platform ios --platform android --dump-sourcemap --output-dir /tmp/export
```

Results land in [`perf/results/`](results/).
