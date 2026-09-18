# Technical decisions

Each entry: the decision, the alternatives I actually considered, why I chose what I chose,
and what it has cost me since. Written after the fact, from the state of the code — not
aspirational.

| # | Decision |
|---|---|
| 1 | [Expo managed workflow, not bare React Native](#1-expo-managed-workflow-not-bare-react-native) |
| 2 | [MongoDB, not PostgreSQL](#2-mongodb-not-postgresql) |
| 3 | [Socket.io, not raw WebSocket](#3-socketio-not-raw-websocket) |
| 4 | [Railway, not AWS](#4-railway-not-aws) |
| 5 | [Cloudinary, not S3 + a resize pipeline](#5-cloudinary-not-s3--a-resize-pipeline) |
| 6 | [JWT with `tokenVersion`, not sessions or refresh tokens](#6-jwt-with-tokenversion-not-sessions-or-refresh-tokens) |
| 7 | [Chat unread state outside the notification system](#7-chat-unread-state-outside-the-notification-system) |
| 8 | [No optimistic rendering in chat](#8-no-optimistic-rendering-in-chat) |
| 9 | [`_id` → `id` normalization in one place](#9-_id--id-normalization-in-one-place) |
| 10 | [OTA updates vs. store builds](#10-ota-updates-vs-store-builds) |
| 11 | [Hand-rolled i18n, not i18next](#11-hand-rolled-i18n-not-i18next) |

---

### 1. Expo managed workflow, not bare React Native

**Context.** One developer, two app stores, no budget, and a user base that reports bugs in
a Korean-language community thread and expects them gone that week.

**Decision.** Expo managed workflow with EAS Build and EAS Update.

**Why.** Two things carried it. EAS Build owns signing, provisioning profiles, and keystores —
the single highest-friction part of shipping to iOS solo. And EAS Update means a JavaScript
fix reaches every user on their next app launch, with no review queue and no cost. Given that
the overwhelming majority of my bugs are JS, that collapses the fix-to-user latency from
roughly a week to minutes.

**What it costs.**
- Native fixes have to go through `patch-package`, which reapplies on every `npm install` and
  must be re-verified on every dependency bump. The `react-native-maps` crash fix
  ([note #1](ENGINEERING-NOTES.md#1-the-app-crashed-on-opening-the-map)) lives there, and if
  that patch silently fails to apply, the app crashes on the map screen in production.
- Expo SDK upgrades are effectively atomic: the whole dependency set moves together.
- `AbortSignal.timeout()` doesn't exist on Hermes, so `lib/api.js` implements request timeouts
  with `AbortController` + `setTimeout` by hand. Small, but representative — the managed
  runtime is a smaller JS environment than Node or a browser.

**Would I choose it again?** Yes, unchanged. For a solo shipper the OTA path alone justifies it.

---

### 2. MongoDB, not PostgreSQL

**Context.** Early on, the shape of the domain changed weekly. A "board" became a national
board, then also a per-university board, then also a per-group board. A "chat room" became a
DM, then also a group chat, then also a school-wide lounge.

**Decision.** MongoDB via Mongoose, with discriminator-ish `kind` fields rather than separate
tables.

**Why.** `ChatRoom` is one collection with `kind: 'dm' | 'group' | 'school'` and a few
kind-specific optional fields. In Postgres this is either three tables with three query paths,
or one table with a lot of nullable columns and a check constraint. In Mongo it's one schema
and one set of handlers, and adding the school lounge later meant adding a field and one
branch — not a migration.

`Post` is the same story: `boardId` *or* `groupId`, with everything downstream (comments,
likes, bookmarks, reports, moderation) reused unchanged for group posts.

**What it costs.**
- **No transactions across collections.** Deleting a board cascades to posts and then
  comments as sequential writes. A crash halfway leaves orphans. Read paths tolerate them;
  nothing cleans them up.
- **Referential integrity is application code.** `University.leaderUserId` can point at a user
  who has since unverified or transferred, so it's re-validated lazily on read and cleared
  when stale. That's a workaround for a foreign key.
- **Denormalized join keys.** `User.university` is a display string, not an ObjectId, because
  it predates the `University` collection. Renaming a university is a four-collection
  migration script.

**Would I choose it again?** For the first six months, yes — the schema really did churn that
much. Knowing the shape it settled into, Postgres would now be the better fit, and the
denormalized university key is the clearest evidence of that.

---

### 3. Socket.io, not raw WebSocket

**Decision.** Socket.io on both ends.

**Why.** Three features I'd otherwise have written myself: **rooms** (`io.to(roomId).emit`
is the entire broadcast implementation for all three chat kinds), **automatic reconnection
with backoff** (mobile networks drop constantly — backgrounding the app, walking into an
elevator, switching from WiFi to LTE), and **per-user channels** (every socket auto-joins
`user_<id>`, which is how notifications reach a user who isn't in the room).

Authentication is a handshake middleware that verifies the same JWT the REST API issues and
applies the same `tokenVersion` and account-status checks, so there's exactly one auth
mechanism in the system — and a token revoked for REST is revoked for the socket too.

**What it costs.**
- A protocol layer on top of WebSocket, with its own framing and heartbeats.
- **Horizontal scaling needs `@socket.io/redis-adapter`.** Room membership is in-process
  today, so a second container would silently split the chat. This is a known, bounded step,
  not an unknown.
- The CORS configuration is not what it appears to be on a native-only app, which cost me the
  entire chat feature for a stretch — see
  [note #2](ENGINEERING-NOTES.md#2-all-real-time-chat-and-notifications-died-after-a-deploy).

---

### 4. Railway, not AWS

**Decision.** Railway, root directory `server/`, auto-deploy from `main`.

**Why.** Push-to-deploy with zero infrastructure work. No VPC, no task definitions, no load
balancer, no Terraform. For a side project whose backend is one stateless Node process, the
entire value of ECS or Lambda + RDS is scaling and control I don't yet need, and the entire
cost is hours I'd rather spend on features.

**What it costs.**
- **Opaque runtime restrictions.** Outbound SMTP ports are blocked with no documentation and
  no error — connections just hang until `ETIMEDOUT`. That cost a day and a mail provider
  migration ([note #4](ENGINEERING-NOTES.md#4-signup-emails-worked-locally-and-timed-out-in-production)).
- **No stable outbound IPs** on the current plan, so MongoDB Atlas network access is
  `0.0.0.0/0`. Security rests on credentials and TLS rather than network policy. This is the
  decision I'm least comfortable with.
- Vendor-specific deploy config, though little enough to port.

**When this flips.** The moment I need more than one instance — which is also the moment I
need the Redis adapter for Socket.io — the calculus changes, because at that point I'm doing
infrastructure work anyway.

---

### 5. Cloudinary, not S3 + a resize pipeline

**Decision.** Cloudinary for all user-uploaded media, via `multer-storage-cloudinary`.

**Why.** S3 gives you durable bytes. It does not give you a thumbnail. Feed images, avatars,
and group covers all need different sizes of the same upload, and the alternative is a Lambda
resize pipeline plus CloudFront — real infrastructure to maintain for a feature Cloudinary
provides as a URL parameter.

**What it costs.**
- Vendor lock-in on the URL format. Migrating off means rewriting stored URLs.
- A second bill on a free-tier ceiling.
- Deletion needs `public_id` parsing back out of the stored URL
  ([`verifyCleanup.extractPublicId`](../server/utils/verifyCleanup.js)), which is a brittle
  regex against a URL shape I don't control.

**The rule this created.** Nothing is ever written to local disk. Railway's filesystem is
ephemeral, so disk writes are lost on every deploy — and, more seriously, serving them
statically leaked private documents
([note #3](ENGINEERING-NOTES.md#3-student-id-cards-were-publicly-readable)). `multer.diskStorage`
is banned in this codebase.

---

### 6. JWT with `tokenVersion`, not sessions or refresh tokens

**Decision.** A single 30-day JWT carrying `{ id, email, nickname, v }`, where `v` is the
user's `tokenVersion`.

**Why.** The problem with stateless JWTs is that you can't revoke them; the problem with
refresh tokens is that they're a second credential, a rotation story, and a race condition on
a flaky mobile network. `tokenVersion` splits the difference: the token stays stateless in
structure, but every authenticated request compares its `v` against the user's current
`tokenVersion`. A password change or reset increments the counter, and every token ever issued
for that account stops working — returned to the client as `TOKEN_REVOKED`, which the app
treats as "log out".

The same check carries account status, so a ban or suspension takes effect on the next
request rather than in 30 days.

**What it costs.** A `User` lookup on every authenticated request. That's a single indexed
`findById` with a four-field projection, and it's the price of revocation without session
storage. The lookup is wrapped in its own try/catch that falls through on failure, so a
transient database blip degrades to "token accepted" rather than logging everyone out — a
deliberate availability-over-strictness choice on a path where the alternative is a total
outage.

---

### 7. Chat unread state outside the notification system

**Decision.** Chat messages create no `Notification` records. Unread lives in
`ChatRoom.unreadCount`, a `Map<userId, count>`.

**Why.** The first implementation created a notification per message, and the app icon badge
counted both notifications and chat unreads — so every message counted twice. The fix could
have been "subtract chat notifications from the badge", but that's a correction layered on a
wrong model.

Messaging apps don't put chat in the notification inbox, and the reason is structural: a
notification is a discrete event you acknowledge once, while a conversation is a stream with
a read position. Modelling a stream as a pile of events means writing one document per
message purely to delete them all when the user opens the room.

**What it costs.** Two code paths for "unread" instead of one, and a filter on
`GET /api/notifications` plus an exclusion in `calculateUnreadBadge` to keep legacy
`chat` / `group_chat` records from old data out of the count. Those filters are permanent
tombstones for a design I got wrong first.

**The exception.** A DM *request* — the first message from a stranger — does create a
notification, because a user who never opens the chat tab would otherwise never learn about
it.

---

### 8. No optimistic rendering in chat

**Decision.** `sendMessage()` clears the input and emits. The bubble is rendered only when
the server echoes `new_message` back.

**Why.** The naive argument for optimistic rendering is perceived latency. The argument
against, here, is that the send path has real failure modes that aren't network errors: the
recipient may have blocked you, the DM may be pending with its one-message limit already
spent, you may no longer be a participant. Each returns `send_error` rather than
`new_message`. Optimistic rendering means showing a message and then removing it — worse than
a brief delay, because the user has to work out whether it sent.

**The dividend.** A single-device E2E test that types a message and asserts it appears on
screen is transitively asserting that the socket connected and authenticated, the server
persisted the message, and the broadcast came back. That's a genuine round-trip test without
a second device or a second emulator. It's the core of
[`.maestro/flows/02-chat-roundtrip.yaml`](../.maestro/flows/02-chat-roundtrip.yaml).

**What it costs.** One network round trip of perceived latency on every message. Acceptable
here; it would not be for a high-frequency chat product.

---

### 9. `_id` → `id` normalization in one place

**Decision.** `lib/api.js`'s `request()` runs every response through `toCamel`, which
recursively rewrites `_id` → `id` and `snake_case` → `camelCase`.

**Why.** Mongo's `_id` leaks everywhere — top-level documents, `.lean()` results, populated
subdocuments, arrays of them. Normalizing at each call site means every screen gets it right
independently, forever. Normalizing once at the boundary means the client has exactly one
convention: **always `obj.id`**.

**What it costs.** A recursive walk of every response body — negligible at these payload
sizes — and a rule that's invisible until it's broken. Writing `obj._id` in a screen produces
`undefined`, not an error: no crash, no warning, just a key that's silently wrong and a list
that silently fails to navigate.

That's exactly the failure mode that should be a test rather than a documentation line, so
[`src/lib/__tests__/api.test.js`](../src/lib/__tests__/api.test.js) pins the conversion,
including nested objects, arrays, and the non-obvious case that `_A` is *not* rewritten
because the regex only matches lowercase.

---

### 10. OTA updates vs. store builds

**Decision.** JavaScript changes ship via `eas update --branch production`. Only native
changes go through `eas build` and store review. `runtimeVersion` follows `app.json`'s
`version`.

**Why.** Store review is days; OTA is minutes and free. The risk is shipping JavaScript that
a given native binary can't run — a new native module, a changed permission, an SDK bump.
Tying `runtimeVersion` to the app version makes that boundary explicit: bumping the version
is a visible declaration that OTA compatibility with shipped builds is broken, and Expo then
refuses to deliver the update to older binaries rather than crashing them.

| Can go over OTA | Needs a new build |
|---|---|
| Screens, components, business logic | New native modules |
| i18n strings, styles, layout | `app.json` native config (bundle ID, permissions, plugins) |
| API calls, new screens in existing navigators | Expo SDK upgrades |
| Bundled assets via `require` | `runtimeVersion` (= `version`) bumps |

**What it costs.** Two release paths to keep straight, and a discipline: if you're unsure
whether a change is native, it's native. Getting that wrong ships a broken update to everyone
at once with no review gate to catch it.

**The safety net.** Forced update. `systemGuard` compares the client's `x-app-version` header
against `SystemSetting.forceUpdate.minVersion` and returns `426 UPDATE_REQUIRED`, so a bug
that OTA can't reach can still be walled off server-side.

---

### 11. Hand-rolled i18n, not i18next

**Decision.** A single `TRANSLATIONS` object keyed by locale, a `t()` from `LangContext`, and
a module-level `rt()` holder for code that runs outside React.

**Why.** Two languages, no pluralization rules to speak of in Korean, no lazy namespace
loading needed for a 1,700-line dictionary that's already in the bundle. i18next would add a
dependency and an initialization lifecycle to solve problems this app doesn't have.

The one genuinely tricky part is that `lib/api.js` needs translated error strings but isn't a
React component and can't call a hook. `lib/runtimeLang.js` is a 20-line module holding the
current language, kept in sync by `LangContext`, exposing `rt(key)` — which returns the key
itself on a miss, so a missing translation renders as `common.timeoutError` rather than
crashing.

**What it costs.** No tooling to catch a key that exists in Korean but not English. So that's
a test: [`runtimeLang.test.js`](../src/lib/__tests__/runtimeLang.test.js) flattens both
dictionaries and asserts the key sets are identical. CI fails on a missing translation, which
is what the library would have given me.
