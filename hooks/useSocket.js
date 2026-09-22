'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io({
        transports: ['websocket', 'polling'],
      });
    }

    socketRef.current = socketInstance;

    const onConnect = () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  return { socket: socketRef.current, isConnected, emit, on, off };
}
