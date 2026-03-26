import { create } from 'zustand';
import { watchConnectionStatus } from '../utils/papiClient';

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isConnected: false,
  isConnecting: true,

  setConnected: (connected: boolean) => set({ isConnected: connected, isConnecting: false }),
  setConnecting: (connecting: boolean) => set({ isConnecting: connecting }),
}));

// Initialize connection watching
let unsubscribe: (() => void) | null = null;

export function initializeConnectionWatcher() {
  if (unsubscribe) return; // Already initialized

  unsubscribe = watchConnectionStatus((connected) => {
    useConnectionStore.getState().setConnected(connected);
  });
}

export function cleanupConnectionWatcher() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
