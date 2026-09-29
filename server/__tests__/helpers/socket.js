// Waiting helpers for the socket.io client
const { io: ioClient } = require('socket.io-client');

// Connect with a token and wait until the connection is established
function connectClient(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

// Wait for one occurrence of an event (fails on timeout)
function waitFor(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the '${event}' event did not arrive within ${timeoutMs}ms.`)),
      timeoutMs
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Used to assert that an event does NOT arrive within a given window
function expectNoEvent(socket, event, windowMs = 500) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => reject(new Error(`received the '${event}' event, which should never fire: ${JSON.stringify(payload)}`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);
  });
}

module.exports = { connectClient, waitFor, expectNoEvent };
