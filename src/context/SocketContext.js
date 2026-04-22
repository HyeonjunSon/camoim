import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { SERVER_HOST } from '../lib/config';
import { getToken } from '../lib/storage';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // 이벤트 리스너 저장소 — 여러 화면에서 같은 이벤트 구독 가능
  const listenersRef = useRef({});
  // 현재 열려 있는 채팅방 ID (채팅방 안에 있으면 해당 방의 알림 무시)
  const activeRoomRef = useRef(null);

  // 소켓 연결
  useEffect(() => {
    if (!user) {
      // 로그아웃 시 해제
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    async function connect() {
      const token = await getToken();
      if (!token) return;

      const socket = io(SERVER_HOST, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socket.on('connect', () => {
        setConnected(true);
        console.log('🔌 글로벌 소켓 연결');
      });

      socket.on('disconnect', () => {
        setConnected(false);
        console.log('🔌 글로벌 소켓 해제');
      });

      // 모든 이벤트를 등록된 리스너들에게 전달
      const eventNames = [
        'new_message',
        'messages_read',
        'chat_notification',
        'room_left',
        'send_error',
      ];
      eventNames.forEach(eventName => {
        socket.on(eventName, (data) => {
          const callbacks = listenersRef.current[eventName];
          if (callbacks) {
            Object.values(callbacks).forEach(cb => cb(data));
          }
        });
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  // 앱이 포그라운드로 돌아올 때 재연결
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, [user]);

  // 이벤트 구독 — 화면마다 고유 key로 등록
  const on = useCallback((eventName, key, callback) => {
    if (!listenersRef.current[eventName]) {
      listenersRef.current[eventName] = {};
    }
    listenersRef.current[eventName][key] = callback;
  }, []);

  // 이벤트 구독 해제
  const off = useCallback((eventName, key) => {
    if (listenersRef.current[eventName]) {
      delete listenersRef.current[eventName][key];
    }
  }, []);

  // 소켓 emit
  const emit = useCallback((eventName, data) => {
    socketRef.current?.emit(eventName, data);
  }, []);

  // 소켓 룸 join/leave
  const joinRoom = useCallback((roomId) => {
    socketRef.current?.emit('join_room', roomId);
  }, []);

  const leaveRoom = useCallback((roomId) => {
    socketRef.current?.emit('leave_room', roomId);
    if (activeRoomRef.current === roomId) activeRoomRef.current = null;
  }, []);

  const setActiveRoom = useCallback((roomId) => {
    activeRoomRef.current = roomId;
  }, []);

  const getActiveRoom = useCallback(() => {
    return activeRoomRef.current;
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef, connected, on, off, emit, joinRoom, leaveRoom, setActiveRoom, getActiveRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
}
