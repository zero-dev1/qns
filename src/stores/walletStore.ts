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

  /** 'substrate' for Talisman/SubWallet, 'evm' for MetaMask */
  providerType: 'substrate' | 'evm' | null;

  showWalletModal: boolean;
  walletError: string | null;

  /** True when connectWallet is being called from rehydration (suppress walletError) */
  _rehydrating: boolean;

  getBalanceAddress: () => string | null;
  connect: () => Promise<void>;
  connectWallet: (walletType: 'talisman' | 'subwallet') => Promise<void>;
  connectMetaMask: () => Promise<void>;
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
      providerType: null,
      showWalletModal: false,
      walletError: null,
      _rehydrating: false,

      getBalanceAddress: () => {
        const { providerType, address, ss58Address } = get();
        // EVM users (MetaMask) use their 0x address for balance
        if (providerType === 'evm') return address;
        // Substrate users use their SS58 address for balance
        return ss58Address;
      },

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
            providerType: 'substrate',
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

      connectMetaMask: async () => {
        const isRehydrating = get()._rehydrating;
        const setError = (error: string) => {
          if (!isRehydrating) set({ walletError: error });
        };

        set({ connecting: true, walletError: null });

        try {
          if (!window.ethereum) {
            setError('MetaMask not detected. Please install MetaMask.');
            set({ connecting: false });
            return;
          }

          const { ensureQFNetwork, createEvmWalletClient } = await import('../utils/evmProvider');

          // Switch/add QF Network in MetaMask
          await ensureQFNetwork();

          // Request accounts + create wallet client
          const walletClient = await createEvmWalletClient();

          const evmAddr = walletClient.account?.address as `0x${string}`;
          if (!evmAddr) throw new Error('No account returned from MetaMask');

          set({
            address: evmAddr,
            ss58Address: null, // MetaMask users have no SS58 address
            displayName: `${evmAddr.slice(0, 6)}...${evmAddr.slice(-4)}`,
            walletName: 'metamask',
            providerType: 'evm',
            accountMapped: true, // No mapping needed for EVM users
            showWalletModal: false,
          });

          // Resolve QNS name in background
          import('../utils/qns').then(({ resolveReverse }) =>
            resolveReverse(evmAddr)
              .then((name) => {
                if (name) set({ qnsName: name, displayName: name });
              })
              .catch(() => {})
          );

          // Watch for MetaMask account/chain changes
          import('../utils/evmProvider').then(({ watchMetaMaskChanges }) => {
            const cleanup = watchMetaMaskChanges(
              (accounts) => {
                if (accounts.length === 0) {
                  // User disconnected from MetaMask
                  get().disconnect();
                } else {
                  // Account switched — reconnect
                  get().disconnect();
                  get().connectMetaMask();
                }
              },
              () => {
                // Chain changed — just reconnect to re-validate
                get().disconnect();
                get().connectMetaMask();
              }
            );
            // Store cleanup function if needed (can use a module-level variable)
            (window as any).__qns_mm_cleanup = cleanup;
          });
        } catch (error: any) {
          const msg = error?.message || '';
          if (msg.includes('User rejected') || msg.includes('User denied') || error?.code === 4001) {
            setError('Connection rejected. Please try again.');
          } else if (msg.includes('MetaMask not')) {
            setError(msg);
          } else {
            setError(msg || 'Failed to connect MetaMask');
          }
          // Clean up
          const { destroyEvmClients } = await import('../utils/evmProvider');
          destroyEvmClients();
          set({
            address: null,
            ss58Address: null,
            qnsName: null,
            displayName: null,
            walletConnection: null,
            walletName: null,
            providerType: null,
            accountMapped: false,
          });
        } finally {
          set({ connecting: false });
        }
      },

      disconnect: () => {
        const { providerType } = get();
        disconnectWallet(); // existing Substrate cleanup

        // Also clean up EVM clients if MetaMask was connected
        if (providerType === 'evm') {
          (window as any).__qns_mm_cleanup?.();
          delete (window as any).__qns_mm_cleanup;
          import('../utils/evmProvider').then(({ destroyEvmClients }) => {
            destroyEvmClients();
          });
        }

        set({
          address: null,
          ss58Address: null,
          qnsName: null,
          displayName: null,
          walletConnection: null,
          walletName: null,
          providerType: null,
          accountMapped: false,
          showWalletModal: false,
          walletError: null,
        });
      },

      refreshName: async () => {
        const { address, qnsName: existingName } = get();
        if (!address) return;
        try {
          const { resolveReverse } = await import('../utils/qns');
          const name = await resolveReverse(address);
          if (name) {
            // Chain returned a name — update
            set({ qnsName: name, displayName: name });
          } else if (!existingName) {
            // No name on chain AND no optimistic name — show truncated address
            const { ss58Address } = get();
            set({
              qnsName: null,
              displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address),
            });
          }
          // If name is null but existingName is set, do nothing —
          // the optimistic name persists until disconnect or until
          // the chain eventually confirms the reverse record.
        } catch {
          // On error, preserve whatever we have — don't clear optimistic state
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
      version: 4, // bumped from 3 → 4 to add providerType field
      migrate: (persistedState, version) => {
        if (version < 4) return undefined as unknown as WalletState;
        return persistedState as WalletState;
      },
      partialize: (state) => ({
        address: state.address,
        ss58Address: state.ss58Address,
        qnsName: state.qnsName,
        displayName: state.displayName,
        walletName: state.walletName,
        accountMapped: state.accountMapped,
        providerType: state.providerType,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.address && state?.walletName) {
            useWalletStore.setState({ _rehydrating: true });

            if (state.walletName === 'metamask') {
              // Rehydrate MetaMask
              state.connectMetaMask().then(() => {
                useWalletStore.setState({ _rehydrating: false });
              }).catch(() => {
                useWalletStore.setState({ _rehydrating: false });
                state.disconnect();
              });
            } else {
              // Rehydrate Substrate wallet (existing logic)
              const walletType = state.walletName as 'talisman' | 'subwallet';
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
            }
          } else if (state?.address) {
            state.refreshName();
          }
        };
      },
    }
  )
);
