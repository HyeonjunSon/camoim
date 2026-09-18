# Maestro E2E flows

These drive the real app on a device or emulator. Jest covers logic; Maestro covers the path
a person actually takes through the UI.

## Install

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version
```

## Prerequisites

- **A development or production build must be installed on the device/emulator.** Expo Go
  won't work — it runs under a different bundle ID than `com.hyeonjun122.cahanin`.
  ```bash
  eas build --platform android --profile development   # or ios
  ```
- The test account needs **at least one existing chat room** — `02-chat-roundtrip` opens the
  first one in the list.
- Verified on a physical iPhone and on an Android emulator.

## Running

```bash
# everything
maestro test .maestro/flows \
  -e MAESTRO_EMAIL=test@example.com \
  -e MAESTRO_PASSWORD=your-password

# one flow
maestro test .maestro/flows/02-chat-roundtrip.yaml \
  -e MAESTRO_EMAIL=... -e MAESTRO_PASSWORD=...

# inspect the view hierarchy when a selector won't match
maestro studio
```

## Flows

| File | What it verifies |
|---|---|
| `01-login.yaml` | Email login → reaches the tab navigator |
| `02-chat-roundtrip.yaml` | Login → chat room → send a message → **see it arrive** |

### Why flow 02 proves receipt, not just send

`ChatRoomScreen.sendMessage()` does not render optimistically. A bubble is drawn only when the
server echoes `new_message` back over the socket:

```
app → WebSocket → server send_message handler → MongoDB write → io.to(room).emit → app
```

So the assertion "the text I typed is now visible in the thread" is itself proof that the whole
round trip succeeded. One device is enough to test it.

## Selector convention

Flows locate elements by `testID`, never by visible text, so they don't break when the app
switches between Korean and English.

| testID | Defined in |
|---|---|
| `login-email`, `login-password`, `login-submit` | [`src/screens/auth/LoginScreen.js`](../src/screens/auth/LoginScreen.js) |
| `tab-home`, `tab-board`, `tab-map`, `tab-chat`, `tab-mypage` | [`src/navigation/RootNavigator.js`](../src/navigation/RootNavigator.js) |
| `chat-room-card` | [`src/screens/chat/ChatListScreen.js`](../src/screens/chat/ChatListScreen.js) |
| `chat-messages`, `chat-input`, `chat-send` | [`src/screens/chat/ChatRoomScreen.js`](../src/screens/chat/ChatRoomScreen.js) |

Removing these IDs while editing UI breaks the E2E suite.

## CI

Maestro needs an installed app build (APK/IPA), so it isn't part of the default GitHub Actions
workflow — that would add 20–30 minutes to every push. CI runs Jest only (seconds); Maestro is
a pre-release gate run locally.
