# Engineering notes

Four production problems, each written as: the symptom users saw, how I narrowed it down,
what was actually wrong, what I changed, and what the fix cost.

Each one opens with a **30-second version** — the short form, for when someone asks
"tell me about a hard bug."

1. [The app crashed on opening the map](#1-the-app-crashed-on-opening-the-map)
2. [All real-time chat and notifications died after a deploy](#2-all-real-time-chat-and-notifications-died-after-a-deploy)
3. [Student ID cards were publicly readable](#3-student-id-cards-were-publicly-readable)
4. [Signup emails worked locally and timed out in production](#4-signup-emails-worked-locally-and-timed-out-in-production)

---

## 1. The app crashed on opening the map

> **30-second version.** I shipped a map of ~580 Korean-owned businesses across Canada, and
> the app started hard-crashing on the map screen — a native crash, so no JavaScript error,
> no stack trace in the JS console. The crash string pointed at `NSArray insertObject:atIndex:`
> being handed `nil`. It turned out React Native's New Architecture interop layer was passing
> `nil` subviews and out-of-range indices into `react-native-maps`' Objective-C view manager
> when markers mounted and unmounted quickly — which is exactly what happens when you pan a
> map with hundreds of pins. I patched the library's `insertReactSubview` and
> `removeReactSubview` with a nil guard and an index clamp, and pinned the patch with
> `patch-package` so it reapplies on every install. The trade-off is that the fix lives
> outside the dependency: if it ever fails to apply, the crash comes straight back, so the
> patch is a build-critical artifact, not a convenience.

**Symptom.** Opening the business map terminated the app. No red box, no JS exception —
the process died. That alone is the first real piece of information: a JavaScript error
would have been caught and rendered. This was below the JS layer.

**Investigation.** The device crash log carried:

```
-[__NSArrayM insertObject:atIndex:]: object cannot be nil
```

An Objective-C exception from `NSMutableArray`, raised inside the map view's subview
bookkeeping. `react-native-maps` keeps its own `_reactSubviews` array and mirrors React's
child operations into it:

```objc
- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {
    // …dispatch on marker/overlay type…
    [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger)atIndex];
}
```

Two unchecked assumptions there: that `subview` is non-nil, and that `atIndex` is within
bounds. Both hold under the old React Native architecture. Under the New Architecture, the
interop layer that bridges legacy native components into the new renderer can violate both
during rapid mount/unmount churn. Panning a map with hundreds of markers is about the most
aggressive mount/unmount churn a screen can produce, which is why this surfaced on the map and
nowhere else. Upstream reports matched: `react-native-maps#5217`, `#5345`, `expo#34614`.

**Fix.** [`patches/react-native-maps+1.20.1.patch`](../patches/react-native-maps+1.20.1.patch) —
a nil guard on both insert and remove, and a clamp on the insertion index:

```objc
if (subview == nil) return;
…
NSUInteger safeIndex = MIN((NSUInteger)MAX(atIndex, 0), _reactSubviews.count);
[_reactSubviews insertObject:(UIView *)subview atIndex:safeIndex];
```

Dropping a nil subview is safe because there is no view to track; clamping is safe because the
array is bookkeeping for a set of children whose order the map doesn't depend on. `patch-package`
runs from `postinstall`, so the patch reapplies on every install including EAS Build.

**What it cost.**
- The fix lives outside the dependency tree. Every `react-native-maps` bump needs the patch
  re-verified, and a patch that fails to apply is a crash in production, not a build error.
  It's documented as build-critical for exactly that reason.
- It's a symptom fix. The interop layer still hands over bad arguments; I've made the callee
  tolerate them.

**What I'd do differently.** Upstream the patch instead of carrying it. And treat "app died
with no JS error" as an immediate signal to go to native crash logs rather than starting from
the JavaScript, which is where I spent the first pass.

---

## 2. All real-time chat and notifications died after a deploy

> **30-second version.** I tightened Socket.io's CORS configuration to an origin allowlist as
> a security hardening pass. After the deploy, real-time chat and live notifications stopped
> working entirely for every user — but the REST API was fine, so the app looked healthy while
> its core feature was dead. The cause was that some React Native WebSocket implementations
> send a non-empty `Origin` header that was obviously not on my allowlist, so the handshake was
> rejected before any of my code ran. The deeper mistake was conceptual: CORS is a browser
> same-origin protection, and this is a native-only app. There is no browser to protect, and an
> attacker writing their own client simply sets whatever `Origin` they like. I was paying a
> real availability cost for zero security. I reverted to allowing requests with no origin,
> treating an empty allowlist as "allow all," and left the allowlist mechanism in place behind
> an environment variable for whenever a web client exists.

**Symptom.** Messages didn't arrive. The chat list didn't update. Push kept working, because
push goes out through Expo's HTTP API, which made the failure look partial and intermittent
rather than total. REST endpoints — login, feeds, posting — were unaffected.

**Investigation.** The split is the clue: HTTP fine, WebSocket dead. That rules out the
database, authentication, and the deploy itself, and points at the one thing that is different
between the two transports. The socket handshake was failing before the JWT middleware ran, so
there were no connection logs on the server — the rejection happened in the CORS check above it.

The configuration I'd added was an ordinary origin allowlist. The assumption underneath it —
that a native client sends no `Origin` header, so "no origin ⇒ allow" plus a list for web
covers everything — is false. React Native's WebSocket implementation varies by platform and
version, and some of them send a non-empty `Origin`. Anything not on the list was refused.

**The conceptual error, which matters more than the bug.** CORS is a mechanism by which a
*browser* refuses to let page A read a response from origin B. It protects users from their
own browser's ambient credentials. A native app has no ambient cookie store to abuse and no
same-origin policy to enforce, and an attacker writing a client from scratch sets `Origin` to
whatever passes. So the allowlist could not stop a determined attacker and could — and did —
stop my own legitimate users. It was security theater that cost the product its core feature.

**Fix.** [`server/socket.js`](../server/socket.js):

```js
origin: (origin, callback) => {
  if (!origin) return callback(null, true);                    // native clients
  if (SOCKET_ORIGINS.length === 0) return callback(null, true); // no allowlist ⇒ allow all
  if (SOCKET_ORIGINS.includes(origin)) return callback(null, true);
  callback(new Error('Origin not allowed by Socket.io CORS'));
}
```

An unset `SOCKET_CORS_ORIGINS` means "native-only, allow everything". The allowlist path stays
in the code for the day a web client exists, and only activates when the variable is set.

**What actually secures this socket** is the handshake authentication that was always there
and is the real control: every connection must present a valid JWT, `send_message` verifies
the sender is in the room's `participants`, and DM rooms additionally check blocks and the
pending-request limit. Those are enforced server-side against the database on every message,
and they are not bypassable by setting a header.

**What it cost.** The allowlist is now inert by default, so a future web client needs someone
to remember to set the variable. That's written into both the code comment and `CLAUDE.md`,
along with a note that this is the first thing to suspect if chat ever silently stops.

**What I'd do differently.** Ask "what threat does this actually stop, for this client?"
before hardening. And this failure mode — a deploy that leaves HTTP healthy while WebSocket
dies — is invisible to a health check that only pings `/health`. It's the reason the socket
round trip is now covered by
[an integration test with two real clients](../server/__tests__/integration/chat.socket.test.js)
that runs on every push.

---

## 3. Student ID cards were publicly readable

> **30-second version.** University verification works by having students upload a photo of
> their student ID. Early on those files were written to the server's local disk and served by
> `express.static('/uploads')` — which meant anyone who knew or guessed a URL could read
> another person's student ID: full name, student number, photo, school. No authentication, no
> signature, and indexable. I removed the static route entirely, moved all uploads to
> Cloudinary with verification documents in their own folder separate from public post images,
> and added a retention job that destroys the file 90 days after review while keeping the audit
> record of who was verified. The rule that came out of it is that nothing in this codebase
> writes to local disk — `multer.diskStorage` is banned, and re-adding the static route is
> called out explicitly in the project's instructions file so it can't be reintroduced by
> someone who doesn't know the history.

**Symptom.** None. Nothing was broken, nothing was slow, no user complained. That's the
characteristic of this class of problem, and the reason it survived as long as it did: it was
found by reading the upload path while working on something else, not by any signal.

**What was wrong.** The chain was:

```
POST /api/verify/apply  →  multer.diskStorage  →  server/uploads/<filename>
                                                        ↓
                        app.use('/uploads', express.static(...))
                                                        ↓
                        GET /uploads/<filename>   — no auth, no signature
```

Three independent failures stacked:

1. **No access control.** `express.static` serves bytes to anyone who asks. The only thing
   between a stranger and a student ID was not knowing the filename — security by obscurity,
   over a filename scheme that wasn't designed to be unguessable.
2. **Sensitive documents in the same namespace as public images.** Post images and
   verification documents lived in one directory with one serving rule. There was no place to
   put a different policy even if I'd wanted one.
3. **Indefinite retention.** Files stayed forever. The privacy policy said documents are
   destroyed within 90 days of verification. Nothing enforced that.

On top of which, Railway's filesystem is ephemeral, so the files didn't reliably survive
deploys either — the storage was simultaneously insecure *and* unreliable.

**Fix.** Local disk storage was removed entirely, not fixed in place:

- `app.use('/uploads', express.static(...))` deleted, and `multer.diskStorage` banned
  codebase-wide. Both are recorded in [`CLAUDE.md`](../CLAUDE.md) as things that must never be
  reintroduced, because the next person to add a file upload won't know why.
- All uploads go to Cloudinary via `CloudinaryStorage`, with **folder separation by
  sensitivity**: `camoim/posts`, `camoim/avatars`, `camoim/groups`, and `camoim/verify`
  — the last holding nothing but verification documents, with generated public IDs.
- Upload validation on the verification endpoint: extension and MIME allowlist
  (jpg/png/pdf/heic), 10 MB cap.
- [`server/utils/verifyCleanup.js`](../server/utils/verifyCleanup.js) runs 30 seconds after
  boot and every 24 hours, finds requests reviewed more than 90 days ago, destroys the
  Cloudinary asset, and blanks `fileUrl` — **keeping the `VerifyRequest` record**, so the audit
  trail of who was verified and when survives the document's destruction. `pending` requests
  are never touched, since an admin may still need to review them.

**What it cost.** Cloudinary URLs for the verify folder are unauthenticated too — the
improvement is namespace separation, non-guessable public IDs, and bounded retention, not
per-request authorization. Cloudinary supports signed delivery URLs, and that's the correct
next step; what's shipped is defense in depth, not a complete fix, and I'd rather say so than
overstate it.

**What I'd do differently.** Treat "this endpoint accepts a government-or-institution ID
document" as a design checkpoint at the moment the feature is written, not a thing discovered
later while reading unrelated code. The 90-day retention was already written in the privacy
policy before any code enforced it — a policy promise with nothing behind it is its own kind
of bug.

---

## 4. Signup emails worked locally and timed out in production

> **30-second version.** Email verification codes never arrived for users, but the exact same
> code worked on my machine. The server logged `ETIMEDOUT` from Nodemailer after a long hang —
> a connection that was never refused, just never answered, which reads as a network-level
> block rather than an auth or configuration error. Railway blocks outbound SMTP ports
> (25/465/587) and doesn't document it or return a useful error. Since the port was the
> problem, no amount of SMTP configuration was going to fix it; the transport had to change.
> I moved to Resend's HTTPS API, which goes out over 443 like any other request, and set up a
> verified sending domain with SPF and DKIM through Cloudflare so the mail wouldn't land in
> spam. The trade-off is a vendor dependency in the signup path, which I accepted because the
> alternative was no email at all on this host.

**Symptom.** Signup was blocked for every new user. `POST /api/auth/send-code` hung for a long
time and then returned a 500. Locally, identical code delivered mail in about a second.

**Investigation.** "Works locally, fails in production" with **identical code and credentials**
narrows things fast — it's the environment, not the logic. The error was the useful part:

```
Error: connect ETIMEDOUT
```

Not `ECONNREFUSED`, not an authentication failure, not a TLS error. A timeout means packets
left and nothing came back: no listener refusing, no handshake failing. That's the signature of
a silently dropped connection, which in a managed-platform context means an egress policy.

Railway blocks outbound SMTP ports. It's a standard anti-abuse measure across PaaS providers —
a compromised container on a shared platform is a spam cannon — but it isn't documented
prominently and it doesn't surface as a distinguishable error. Once the constraint is named,
the space of fixes collapses: nothing about SMTP configuration can help, because the transport
itself is unavailable.

**Fix.** Swap the transport, not the settings. [`server/utils/mailer.js`](../server/utils/mailer.js)
now uses **Resend's HTTPS API** — port 443, indistinguishable from any other outbound request,
so no egress policy touches it.

Deliverability needed its own work: mail from a generic sender is spam-filtered, and
verification codes landing in spam is the same outage in a different costume. So:

- `camoimapp.com` verified as a sending domain in Resend
- SPF and DKIM records published via Cloudflare DNS
- sender fixed at `no-reply@camoimapp.com` (`MAIL_FROM`)

**What it cost.**
- A vendor dependency on a critical path. If Resend is down, nobody can sign up or reset a
  password. The mitigation today is that the failure is loud and logged, not that there's a
  fallback provider.
- Vendor-shaped code. The mailer is small and isolated behind `sendVerificationEmail` /
  `sendPasswordResetEmail`, so swapping providers means rewriting one file — but it is
  Resend's API, not a generic interface.

**What I'd do differently.** Read the host's egress and networking constraints before choosing
a transport, rather than after. This generalizes: a managed platform's *undocumented*
restrictions are part of its cost, and they show up as hangs rather than errors — which is
also why the client sets a hard 20-second timeout on every request
([`lib/api.js`](../src/lib/api.js)) instead of trusting the network to fail fast.
