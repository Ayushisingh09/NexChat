import { create } from 'zustand';
import { Socket } from 'socket.io-client';

interface SocketState {
  isConnected: boolean;
  socket: Socket | null;
  setConnected: (connected: boolean) => void;
  setSocket: (socket: Socket | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  isConnected: false,
  socket: null,
  setConnected: (connected) => set({ isConnected: connected }),
  setSocket: (socket) => set({ socket }),
}));
