// socket.io 클라이언트용 대기 헬퍼
const { io: ioClient } = require('socket.io-client');

// 토큰으로 연결하고 connect 완료까지 기다린다
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

// 특정 이벤트 1회를 기다린다 (타임아웃 시 실패)
function waitFor(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`'${event}' 이벤트가 ${timeoutMs}ms 안에 오지 않았습니다.`)),
      timeoutMs
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// 지정 시간 동안 이벤트가 오지 않아야 함을 검증할 때 사용
function expectNoEvent(socket, event, windowMs = 500) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => reject(new Error(`오면 안 되는 '${event}' 이벤트 수신: ${JSON.stringify(payload)}`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);
  });
}

module.exports = { connectClient, waitFor, expectNoEvent };
