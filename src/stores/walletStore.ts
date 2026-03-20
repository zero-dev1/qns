import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { truncateAddress } from '../utils/qns';
import { ensureAccountMapped } from '../utils/accountMapping';
import { 
  connectSubstrateWallet,
  disconnectWallet,
  type WalletConnection 
} from '../utils/wallet';

interface WalletState {
  address: `0x${string}` | null;
  ss58Address: string | null;
  qnsName: string | null;
  displayName: string | null;
  connecting: boolean;
  walletConnection: WalletConnection | null;
  walletName: string | null;
  
  showWalletModal: boolean;
  
  walletError: string | null;
  
  getBalanceAddress: () => string | null;
  
  connect: () => Promise<void>;
  connectWallet: (walletType: 'talisman' | 'subwallet') => Promise<void>;
  disconnect: () => void;
  refreshName: () => Promise<void>;
  setShowWalletModal: (show: boolean) => void;
  clearWalletError: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      ss58Address: null,
      qnsName: null,
      displayName: null,
      connecting: false,
      walletConnection: null,
      walletName: null,
      showWalletModal: false,
      walletError: null,

      getBalanceAddress: () => {
        const state = get();
        return state.ss58Address;
      },

      connect: async () => {
        set({ showWalletModal: true });
      },

      connectWallet: async (walletType: 'talisman' | 'subwallet') => {
        set({ connecting: true, walletError: null });
        
        try {
          const walletName = walletType === 'talisman' ? 'talisman' : 'subwallet-js';
          const connection = await Promise.race([
            connectSubstrateWallet(walletName),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Wallet connection timed out after 10 seconds. Please try again.')), 10000)
            ),
          ]);
          
          set({ walletConnection: connection });
          
          const evmAddr = connection.evmAddress as `0x${string}`;
          const ss58Addr = connection.address;
          
          set({ 
            address: evmAddr, 
            ss58Address: ss58Addr,
            displayName: truncateAddress(ss58Addr),
            walletName: walletType  // Add this
          });
          
          try {
            const { resolveReverse } = await import('../utils/qns');
            const name = await resolveReverse(evmAddr);
            if (name) {
              set({ qnsName: name, displayName: name });
            }
          } catch {
            // Name resolution failed, display truncated address
          }
          
          let mapped = false;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await ensureAccountMapped(ss58Addr);
    mapped = true;
    break;
  } catch {
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
  }
}
if (!mapped) {
  set({ walletError: 'Account mapping failed. Please try reconnecting.' });
  return;
}

set({ showWalletModal: false });
        } catch (error: any) {
          const msg = error.message || '';
          if (msg.includes('No accounts found') || msg.includes('no accounts')) {
            set({ walletError: 'No accounts found. Please create an account in your wallet extension.' });
          } else if (msg.includes('extension') || msg.includes('not installed') || msg.includes('Cannot read properties')) {
            set({ walletError: 'Please install Talisman or SubWallet to use this dApp.' });
          } else {
            set({ walletError: error.message || 'Failed to connect wallet' });
          }
        } finally {
          set({ connecting: false });
        }
      },

      disconnect: () => {
        disconnectWallet();
        set({ 
          address: null, 
          ss58Address: null,
          qnsName: null, 
          displayName: null, 
          walletConnection: null,
          walletName: null,  // Add this
          showWalletModal: false
        });
      },

      refreshName: async () => {
        const { address } = get();
        if (!address) return;
        try {
          const { resolveReverse } = await import('../utils/qns');
          const name = await resolveReverse(address);
          if (name) {
            set({ qnsName: name, displayName: name });
          } else {
            const { ss58Address } = get();
            set({ 
              qnsName: null, 
              displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address) 
            });
          }
        } catch {
          const { ss58Address } = get();
          set({ 
            qnsName: null, 
            displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address) 
          });
        }
      },
      
      setShowWalletModal: (show: boolean) => {
        set({ showWalletModal: show });
        if (!show) {
          set({ walletError: null });
        }
      },
      
      clearWalletError: () => {
        set({ walletError: null });
      },
    }),
    {
      name: 'qns-wallet-storage',
      version: 2,
      migrate: (persistedState, version) => {
        if (version !== 2) {
          return undefined as unknown as WalletState;
        }
        return persistedState as WalletState;
      },
      partialize: (state) => ({
        address: state.address,
        ss58Address: state.ss58Address,
        qnsName: state.qnsName,
        displayName: state.displayName,
        walletName: state.walletName,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.address && state?.walletName) {
            // Reconnect wallet extension silently
            state.connectWallet(state.walletName as 'talisman' | 'subwallet').catch(() => {
              // If reconnection fails, clear persisted state
              state.disconnect();
            });
          } else if (state?.address) {
            state.refreshName();
          }
        };
      },
    }
  )
);
