import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveReverse, truncateAddress } from '../utils/qns';

interface WalletState {
  address: `0x${string}` | null;
  qnsName: string | null;
  displayName: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshName: () => Promise<void>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      qnsName: null,
      displayName: null,
      connecting: false,

      connect: async () => {
        if (!window.ethereum) {
          alert('Please install a Web3 wallet');
          return;
        }
        set({ connecting: true });
        try {
          const accounts = (await window.ethereum.request({
            method: 'eth_requestAccounts',
          })) as string[];
          if (accounts.length > 0) {
            const addr = accounts[0] as `0x${string}`;
            set({ address: addr, displayName: truncateAddress(addr) });
            const name = await resolveReverse(addr);
            if (name) {
              set({ qnsName: name, displayName: name });
            }
          }
        } catch {
          // user rejected
        } finally {
          set({ connecting: false });
        }
      },

      disconnect: () => {
        set({ address: null, qnsName: null, displayName: null });
      },

      refreshName: async () => {
        const { address } = get();
        if (!address) return;
        const name = await resolveReverse(address);
        if (name) {
          set({ qnsName: name, displayName: name });
        } else {
          set({ qnsName: null, displayName: truncateAddress(address) });
        }
      },
    }),
    {
      name: 'qns-wallet-storage',
      version: 1, // Bump version to clear old data with .qf suffix
      migrate: (persistedState, version) => {
        // Clear persisted state on version change to force fresh fetch
        if (version !== 1) {
          return undefined as unknown as WalletState;
        }
        return persistedState as WalletState;
      },
      partialize: (state) => ({
        address: state.address,
        qnsName: state.qnsName,
        displayName: state.displayName,
      }),
    }
  )
);
