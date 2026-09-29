# Testing & CI

Three layers. Further down is slower and closer to reality.

```
Client unit (jest-expo)         72 tests · ~1s    pure logic, no native
Server unit + integration       81 tests · ~15s   real Express + in-memory MongoDB + real Socket.io
Maestro E2E                      2 flows          real app on a device/emulator
```

The first two run on every push and pull request via GitHub Actions. Maestro is a pre-release
gate run locally, because it needs an installed app build.

```bash
npm test                 # client
npm run test:server      # server  (= npm --prefix server test)
npm run test:all         # both

npm run test:watch
npm run test:coverage
```

---

## 1. Client unit tests

`jest-expo` preset. These don't render screens — they cover the pure logic that can break the
whole app quietly.

| File | What it protects |
|---|---|
| [`src/lib/__tests__/api.test.js`](../src/lib/__tests__/api.test.js) | `toCamel`'s `_id → id` rewrite. If this breaks, screens across the app silently read `undefined` instead of crashing |
| [`src/lib/__tests__/time.test.js`](../src/lib/__tests__/time.test.js) | Relative-time boundaries (60s / 1h / 24h / 7d / year rollover), Korean and English, `t()` fallback |
| [`src/lib/__tests__/runtimeLang.test.js`](../src/lib/__tests__/runtimeLang.test.js) | The out-of-React i18n holder, **plus ko/en translation key parity** |
| [`src/lib/__tests__/university.test.js`](../src/lib/__tests__/university.test.js) | `"… (UBC)" → "UBC"` abbreviation extraction |
| [`src/constants/__tests__/boards.test.js`](../src/constants/__tests__/boards.test.js) | **Client ↔ server board slug synchronization** |
| [`src/lib/__tests__/session.test.js`](../src/lib/__tests__/session.test.js) | Cold-start session restore. **Only an auth failure (401, revoked, banned, suspended) signs the user out** — offline, timeout, 5xx, and maintenance keep the session. Pins the fix for the offline-logout bug ([perf/README.md](../perf/README.md#a-bug-fixed-on-the-way)) |
| [`src/lib/__tests__/perf.test.js`](../src/lib/__tests__/perf.test.js) | Production telemetry: cold start reported once, never for sessions that went through the login screen |
| [`src/lib/__tests__/storage.test.js`](../src/lib/__tests__/storage.test.js) | Cached-user storage, including a corrupted entry falling back to network restore |

The last two carry the most weight. `CLAUDE.md` contains rules of the form "update both
sides" — client and server board constants, Korean and English dictionaries. A rule a human
has to remember eventually gets broken. Turned into a test, CI enforces it instead.

The boards test imports the server's CommonJS constants module directly from the client suite
and diffs the arrays, so drifting one side fails the build.

### Native modules

[`jest.setup.js`](../jest.setup.js) mocks AsyncStorage. Add further native mocks there as new
dependencies are pulled into tested code paths.

---

## 2. Server unit + integration tests

`mongodb-memory-server` starts an **isolated real MongoDB** per run. Production Atlas is never
reachable: [`__tests__/helpers/env.js`](../server/__tests__/helpers/env.js) loads through
Jest's `setupFiles`, before anything else, and forces test-only environment variables.

### Layout

```
server/__tests__/
├── helpers/
│   ├── env.js          test-only env (JWT_SECRET etc.); loaded first via setupFiles
│   ├── db.js           in-memory MongoDB connect / clear / close
│   ├── factories.js    createUser / tokenFor / createDmRoom
│   └── socket.js       connectClient / waitFor / expectNoEvent
├── unit/
│   ├── cache.test.js
│   ├── contentPreview.test.js
│   └── metro.test.js
└── integration/
    ├── auth.test.js          real Express app via supertest
    ├── chat.socket.test.js   real Socket.io server + two real clients
    ├── home-feed.test.js     home screen APIs, caching and invalidation
    └── posts.like.test.js    like toggle, incl. concurrent requests
```

### Why `app.js` exists

`server/index.js` used to assemble the app, connect to the database, run seeds and migrations,
and call `listen()` — so importing it from a test started a server and touched a database.
It's now split:

- **[`server/app.js`](../server/app.js)** — Express assembly only. No side effects. Tests import it.
- **[`server/index.js`](../server/index.js)** — dotenv → DB connect → seeds/migrations → socket init → `listen()`

Production behaviour is unchanged; Railway still runs `index.js`. New routes mount in `app.js`.

### Rate limiting

The limiters in `routes/auth.js` `skip` when `NODE_ENV === 'test'`. Without that, a handful of
login tests trip the 10-per-15-minutes limit and the rest of the suite fails on `429`.
`NODE_ENV` is never set to `test` in production.

### Coverage

**[`auth.test.js`](../server/__tests__/integration/auth.test.js) — 21 tests**

- Registration: email verification enforced before signup, duplicate email/nickname `409`,
  password length, **`role: 'admin'` injection rejected** (an arbitrary role in the request
  body must not grant admin)
- Login: case-insensitive email, wrong password `401`, deleted account `403`, social-only
  account `SOCIAL_ONLY`, **account lockout after repeated failures (`423`)**
- `requireAuth`: missing/forged token `401`, **`TOKEN_REVOKED` once `tokenVersion` advances**,
  suspended account `403`, expired suspension auto-lifted
- `passwordHash` never appears in any response body

**[`chat.socket.test.js`](../server/__tests__/integration/chat.socket.test.js) — 22 tests** — the core flow

- Socket JWT handshake: missing and forged tokens rejected, a real login token accepted,
  **revoked (`tokenVersion`), banned, and suspended accounts rejected**
- **Login → send → receive**: peer socket receives, message persisted, `readBy` seeded with
  the sender, sender gets the same echo
- `unreadCount` incremented and `lastMessage` updated
- `chat_notification` delivered even when the recipient hasn't joined the room
- `read_messages` zeroes unread and propagates `messages_read` to the peer
- Defenses: non-participant send rejected, blank content ignored, content trimmed,
  **blocked user gets `send_error`**, pending-DM one-message limit, recipient can't pre-empt
  acceptance, sending to a nonexistent room doesn't take the server down
- Group rooms broadcast to all N participants
- **Concurrency**: 20 simultaneous sends from two users leave every `unreadCount` exact
  (pins the atomic `$inc`)
- **Validate before writing**: message save and room update now run concurrently, so a
  2001-character message must be rejected *before* either write — otherwise the room preview
  and unread count would advance for a message that was never stored

**[`home-feed.test.js`](../server/__tests__/integration/home-feed.test.js) — 13 tests**

Written alongside the [performance work](../perf/README.md) to prove the rewritten queries
return the same results as the ones they replaced.

- `hot-by-board`: board order, per-board limit, hotScore order; 48-hour window, hidden and
  school-board posts excluded; author exposed as nickname only
- **`top=5` returns exactly what the app used to compute client-side** from the full response,
  including tie-breaking
- **Blocked users' posts stay hidden in `aggregate()` pipelines.** `aggregate` skips Mongoose
  casting, so string IDs in `$match` silently match nothing. Mutation-checked: removing the
  `ObjectId` conversion fails three tests
- **Blocking and unblocking take effect on the very next request** (cache invalidated by model
  hooks); adding or editing a board likewise
- `home-sections` limits, city filter applied only to local boards and expanded to the metro
  area; `/boards` shows a verified student their own school's boards and no other school's;
  `/notices` puts pinned first

**[`cache.test.js`](../server/__tests__/unit/cache.test.js) — 7 tests**

- TTL hit and expiry, eviction past `max`, failed loads not cached
- **Concurrent lookups for one key hit the loader once** (in-flight coalescing)
- **A load that started before `clear()` doesn't write its stale result back afterwards**

**[`posts.like.test.js`](../server/__tests__/integration/posts.like.test.js) — 4 tests**

- Like / unlike toggle, notification to the author only (not for self-likes), `404` on a
  missing post
- **15 concurrent likes produce `likeCount === 15`** — the toggle is a conditional atomic
  update, not read-modify-save

Only email (Resend) and push (Expo) are mocked. Everything else runs the same code path
production does — the real Express app, the real Socket.io server, real Mongoose models
against a real database.

---

## 3. Maestro E2E

See [`.maestro/README.md`](../.maestro/README.md).

[`02-chat-roundtrip.yaml`](../.maestro/flows/02-chat-roundtrip.yaml) drives login → chat room →
send → receive in the real app. Because `ChatRoomScreen` doesn't render optimistically, a
visible bubble means app → socket → server → MongoDB → broadcast → app all succeeded — a
genuine round trip on a single device.

Flows select elements by `testID`, never by text, so they survive Korean/English switching:
`login-*`, `tab-*`, `chat-*`. Removing those IDs while editing UI breaks E2E.

---

## 4. CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — on push to `main`, on pull
requests, and manually.

| Job | Steps |
|---|---|
| `client` | `npm ci` → `npm test -- --ci --coverage` |
| `server` | `npm ci` → `npm test -- --ci --coverage`, with the `mongod` binary cached |

Re-pushing to a branch cancels the in-flight run (`concurrency`). Coverage is uploaded as an
artifact and kept for 7 days.

Maestro isn't in CI: it needs an APK/IPA, which would add 20–30 minutes to every push. It runs
locally before a release instead.

---

## Adding tests

**A server route**

```js
jest.mock('../../utils/mailer', () => ({ /* … */ }));
const request = require('supertest');
const db = require('../helpers/db');
const { createUser, tokenFor } = require('../helpers/factories');

let app;
beforeAll(async () => { await db.connect(); app = require('../../app'); });
afterEach(() => db.clear());
afterAll(() => db.close());
```

Require `app` **after** `db.connect()` — model registration order depends on it.

**A socket event** — use `waitFor` / `expectNoEvent` from
[`__tests__/helpers/socket.js`](../server/__tests__/helpers/socket.js). Create the `waitFor`
promise **before** emitting, or the event fires before anything is listening:

```js
const received = waitFor(bobSocket, 'new_message');          // first
aliceSocket.emit('send_message', { roomId, content: 'hi' }); // then
const payload = await received;
```

**Client** — prefer logic in `src/lib` and `src/constants` that doesn't touch native. If a
change pulls in a new native module, add a mock to `jest.setup.js`.

**A new screen in E2E** — select by `testID`, not by visible text.
