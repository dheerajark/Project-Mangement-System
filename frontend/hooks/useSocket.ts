'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useSocket(onNotificationReceived?: (notification: any) => void) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onNotificationReceived);

  // Update the ref whenever the callback changes
  useEffect(() => {
    callbackRef.current = onNotificationReceived;
  }, [onNotificationReceived]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Initialize socket connection to the '/notifications' namespace
    const socket = io(`${API_URL}/notifications`, {
      auth: {
        token,
      },
      query: {
        token,
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('notification_received', (notification) => {
      if (callbackRef.current) {
        callbackRef.current(notification);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('notification_received');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current, isConnected };
}
