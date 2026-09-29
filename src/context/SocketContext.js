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

  // Listener registry — several screens can subscribe to the same event
  const listenersRef = useRef({});
  // The chat room currently open (notifications for that room are ignored while inside it)
  const activeRoomRef = useRef(null);

  // Connect the socket
  useEffect(() => {
    if (!user) {
      // Disconnect on logout
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
      });

      socket.on('disconnect', () => {
        setConnected(false);
      });

      // Fan every event out to the registered listeners
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

  // Reconnect when the app returns to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, [user]);

  // Subscribe — each screen registers under its own key
  const on = useCallback((eventName, key, callback) => {
    if (!listenersRef.current[eventName]) {
      listenersRef.current[eventName] = {};
    }
    listenersRef.current[eventName][key] = callback;
  }, []);

  // Unsubscribe
  const off = useCallback((eventName, key) => {
    if (listenersRef.current[eventName]) {
      delete listenersRef.current[eventName][key];
    }
  }, []);

  // Socket emit
  const emit = useCallback((eventName, data) => {
    socketRef.current?.emit(eventName, data);
  }, []);

  // Join/leave a socket room
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
