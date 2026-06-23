import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { useSocketStore } from '../store/socket.store';
import { mqttService } from '../services/mqtt.service';

export const useSocket = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setConnected = useSocketStore((state) => state.setConnected);
  const setSocket = useSocketStore((state) => state.setSocket);

  useEffect(() => {
    if (!accessToken) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    
    // Connect to Socket.io server with authentication token
    const socketInstance = io(socketUrl, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected (id: ${socketInstance.id})`);
      setConnected(true);
      mqttService.connect();
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error(`[Socket] Connection error: ${err.message}`);
      setConnected(false);
    });

    setSocket(socketInstance);

    // Send periodic heartbeats to keep presence alive (before 30s Redis TTL expires)
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('heartbeat');
      }
    }, 25000);

    return () => {
      clearInterval(heartbeatInterval);
      mqttService.disconnect();
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('connect_error');
      socketInstance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken, setConnected, setSocket]);
};
