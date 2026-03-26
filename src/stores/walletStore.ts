import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { truncateAddress } from '../utils/qns';
import { ensureAccountMapped, METADATA_HASH_ERROR, USER_CANCELLED, INSUFFICIENT_BALANCE_FOR_MAPPING } from '../utils/accountMapping';
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

  /** True when connectWallet is being called from rehydration (suppress walletError) */
  _rehydrating: boolean;

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
      _rehydrating: false,

      getBalanceAddress: () => get().ss58Address,

      connect: async () => {
        set({ showWalletModal: true });
      },

      connectWallet: async (walletType: 'talisman' | 'subwallet') => {
        const isRehydrating = get()._rehydrating;
        const setError = (error: string) => {
          if (!isRehydrating) {
            set({ walletError: error });
          }
        };
        
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
              setError(
                'QF Network requires CheckMetadataHash to be disabled in your wallet. ' +
                'In Talisman: Settings → Networks & Tokens → Manage Networks → find "QF Network" → ' +
                'uncheck "Verify transaction with metadata hash". Then reconnect.',
              );
              set({ accountMapped: false });
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

            if (msg === INSUFFICIENT_BALANCE_FOR_MAPPING || msg.includes('INSUFFICIENT_BALANCE')) {
              // Connect anyway but mark unmapped, show clear message
              set({
                accountMapped: false,
                showWalletModal: false,
              });
              setError(
                'Your wallet needs a small amount of QF to complete account setup. ' +
                'Bridge some QF tokens, then reconnect.'
              );
              return;
            }

            // Generic mapping error — clean up to prevent zombie state
            disconnectWallet();
            setError('Account setup incomplete — please try connecting again.');
            set({
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
            setError('No accounts found. Please create an account in your wallet extension.');
          } else if (msg.includes('extension') || msg.includes('not installed') || msg.includes('Cannot read properties')) {
            setError('Please install Talisman or SubWallet to use this dApp.');
          } else if (msg.includes('timed out')) {
            setError(msg);
          } else {
            setError(msg || 'Failed to connect wallet');
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
        set({ showWalletModal: show, walletError: null });
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
            // Mark as rehydrating to suppress walletError
            useWalletStore.setState({ _rehydrating: true });
            state.connectWallet(walletType).then(() => {
              useWalletStore.setState({ _rehydrating: false });
              if (!useWalletStore.getState().address) {
                // First attempt failed — retry after delay for slow extension injection
                useWalletStore.setState({ _rehydrating: true });
                setTimeout(() => {
                  state.connectWallet(walletType).then(() => {
                    useWalletStore.setState({ _rehydrating: false });
                  }).catch(() => {
                    useWalletStore.setState({ _rehydrating: false });
                  });
                }, 1500);
              }
            }).catch(() => {
              useWalletStore.setState({ _rehydrating: false });
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
