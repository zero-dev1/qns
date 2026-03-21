import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { truncateAddress } from '../utils/qns';
import { ensureAccountMapped, METADATA_HASH_ERROR, USER_CANCELLED } from '../utils/accountMapping';
import {
  connectSubstrateWallet,
  disconnectWallet,
  type WalletConnection,
} from '../utils/wallet';

interface WalletState {
  address: `0x${string}` | null;
  ss58Address: string | null;
  qnsName: string | null;
  displayName: string | null;
  connecting: boolean;
  walletConnection: WalletConnection | null;
  walletName: string | null;

  /** True when the account's SS58→EVM mapping is confirmed on chain */
  accountMapped: boolean;

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
      accountMapped: false,
      showWalletModal: false,
      walletError: null,

      getBalanceAddress: () => get().ss58Address,

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
              setTimeout(() => reject(new Error('Wallet connection timed out after 10 seconds. Please try again.')), 10_000)
            ),
          ]);

          set({ walletConnection: connection });

          const evmAddr = connection.evmAddress as `0x${string}`;
          const ss58Addr = connection.address;

          set({
            address: evmAddr,
            ss58Address: ss58Addr,
            displayName: truncateAddress(ss58Addr),
            walletName: walletType,
          });

          // Resolve QNS name in background (don't block connection)
          import('../utils/qns').then(({ resolveReverse }) =>
            resolveReverse(evmAddr).then(name => {
              if (name) set({ qnsName: name, displayName: name });
            }).catch(() => {})
          );

          // ── Single mapping attempt ──
          try {
            await ensureAccountMapped(ss58Addr);
            set({ accountMapped: true, showWalletModal: false });
          } catch (mapErr: any) {
            const msg = mapErr?.message ?? '';

            if (msg === METADATA_HASH_ERROR || msg.includes('METADATA_HASH_ERROR')) {
              // Talisman has CheckMetadataHash enabled for QF
              set({
                walletError:
                  'QF Network requires CheckMetadataHash to be disabled in your wallet. ' +
                  'In Talisman: Settings → Networks & Tokens → Manage Networks → find "QF Network" → ' +
                  'uncheck "Verify transaction with metadata hash". Then reconnect.',
                accountMapped: false,
              });
              // Don't close modal – let user see the error
              return;
            }

            if (msg === USER_CANCELLED || msg.includes('USER_CANCELLED')) {
              // User chose not to map. Connect anyway, but mark unmapped.
              set({
                accountMapped: false,
                showWalletModal: false,
              });
              // They can still browse; writes will fail with a clear message.
              return;
            }

            // Generic mapping error — clean up to prevent zombie state
            disconnectWallet();
            set({
              walletError: 'Account setup incomplete — please try connecting again.',
              accountMapped: false,
              address: null,
              ss58Address: null,
              qnsName: null,
              displayName: null,
              walletConnection: null,
              walletName: null,
            });
            return;
          }
        } catch (error: any) {
          const msg = error.message || '';
          if (msg.includes('No accounts found') || msg.includes('no accounts')) {
            set({ walletError: 'No accounts found. Please create an account in your wallet extension.' });
          } else if (msg.includes('extension') || msg.includes('not installed') || msg.includes('Cannot read properties')) {
            set({ walletError: 'Please install Talisman or SubWallet to use this dApp.' });
          } else if (msg.includes('timed out')) {
            set({ walletError: msg });
          } else {
            set({ walletError: msg || 'Failed to connect wallet' });
          }
          // ── NEW: prevent zombie state ──
          // Clear identity so navbar reflects reality
          disconnectWallet(); // clears currentConnection in wallet.ts
          set({
            address: null,
            ss58Address: null,
            qnsName: null,
            displayName: null,
            walletConnection: null,
            walletName: null,
            accountMapped: false,
          });
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
          walletName: null,
          accountMapped: false,
          showWalletModal: false,
          walletError: null,
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
              displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address),
            });
          }
        } catch {
          const { ss58Address } = get();
          set({
            qnsName: null,
            displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address),
          });
        }
      },

      setShowWalletModal: (show: boolean) => {
        set({ showWalletModal: show });
        if (!show) set({ walletError: null });
      },

      clearWalletError: () => {
        set({ walletError: null });
      },
    }),
    {
      name: 'qns-wallet-storage',
      version: 3, // bumped from 2 → 3 to avoid stale hydration
      migrate: (persistedState, version) => {
        if (version < 3) return undefined as unknown as WalletState;
        return persistedState as WalletState;
      },
      partialize: (state) => ({
        address: state.address,
        ss58Address: state.ss58Address,
        qnsName: state.qnsName,
        displayName: state.displayName,
        walletName: state.walletName,
        accountMapped: state.accountMapped,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.address && state?.walletName) {
            const walletType = state.walletName as 'talisman' | 'subwallet';
            // Attempt immediate reconnect; if it fails (extension not injected yet),
            // retry once after a short delay for in-app browsers (SubWallet).
            state.connectWallet(walletType).then(() => {
              // Check if connection actually succeeded (address will be null if it failed)
              if (!state.address) {
                // First attempt cleared state — retry after delay
                setTimeout(() => {
                  state.connectWallet(walletType).catch(() => {});
                }, 1500);
              }
            }).catch(() => {
              // connectWallet doesn't throw (catches internally), but just in case
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
