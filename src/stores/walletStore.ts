import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { truncateAddress } from '../utils/qns';
import {
  ensureAccountMapped,
  METADATA_HASH_ERROR,
  USER_CANCELLED,
  INSUFFICIENT_BALANCE_FOR_MAPPING,
} from '../utils/accountMapping';
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

  /** Prevents double-fire of connectMetaMask during rehydration */
  _mmConnecting: boolean;

  getBalanceAddress: () => string | null;
  connect: () => Promise<void>;
  connectWallet: (walletType: 'talisman' | 'subwallet') => Promise<void>;
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
  refreshName: () => Promise<void>;
  setShowWalletModal: (show: boolean) => void;
  clearWalletError: () => void;
}

/**
 * Resolve QNS name for an EVM address with retry.
 * Returns the name or null.
 */
async function resolveNameWithRetry(
  evmAddr: string,
  maxAttempts = 3,
  delayMs = 2000
): Promise<string | null> {
  const { resolveReverse } = await import('../utils/qns');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const name = await resolveReverse(evmAddr);
      if (name) return name;
    } catch {
      // Swallow — will retry
    }

    // Don't delay after the last attempt
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
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
      _mmConnecting: false,

      getBalanceAddress: () => {
        const { providerType, address, ss58Address } = get();
        if (providerType === 'evm') return address;
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
          const walletName =
            walletType === 'talisman' ? 'talisman' : 'subwallet-js';
          const connection = await Promise.race([
            connectSubstrateWallet(walletName),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'Wallet connection timed out after 10 seconds. Please try again.'
                    )
                  ),
                10_000
              )
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
            resolveReverse(evmAddr)
              .then((name) => {
                if (name) set({ qnsName: name, displayName: name });
              })
              .catch(() => {})
          );

          // ── Single mapping attempt ──
          try {
            await ensureAccountMapped(ss58Addr);
            set({ accountMapped: true, showWalletModal: false });
          } catch (mapErr: any) {
            const msg = mapErr?.message ?? '';

            if (
            msg === METADATA_HASH_ERROR ||
            msg.includes('METADATA_HASH_ERROR')
          ) {
            const onMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            setError(
              onMobile
                ? 'QF Network requires metadata hash verification to be disabled in SubWallet. ' +
                  'Check your wallet settings for QF Network and disable metadata hash verification, then reconnect.'
                : 'QF Network requires CheckMetadataHash to be disabled in your wallet. ' +
                  'In Talisman: Settings → Networks & Tokens → Manage Networks → find "QF Network" → ' +
                  'uncheck "Verify transaction with metadata hash". Then reconnect.'
            );
            set({ accountMapped: false });
            return;
          }

            if (msg === USER_CANCELLED || msg.includes('USER_CANCELLED')) {
              set({
                accountMapped: false,
                showWalletModal: false,
              });
              return;
            }

            if (
              msg === INSUFFICIENT_BALANCE_FOR_MAPPING ||
              msg.includes('INSUFFICIENT_BALANCE')
            ) {
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

            console.warn('[QNS] ensureAccountMapped catch-all:', mapErr);
            disconnectWallet();
            setError(
              'Account setup incomplete — please try connecting again.'
            );
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
          if (
            msg.includes('No accounts found') ||
            msg.includes('no accounts')
          ) {
            setError(
              'No accounts found. Please create an account in your wallet extension.'
            );
          } else if (
            msg.includes('extension') ||
            msg.includes('not installed') ||
            msg.includes('Cannot read properties')
          ) {
            const onMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            setError(
              onMobile
                ? 'SubWallet not detected. Please open this dApp inside SubWallet\'s built-in browser.'
                : 'Talisman not detected. Please install the Talisman browser extension to continue.'
            );
          } else if (msg.includes('timed out')) {
            setError(msg);
          } else {
            setError(msg || 'Failed to connect wallet');
          }
          disconnectWallet();
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
        // Guard against double-fire (rehydration + watchMetaMaskChanges race)
        if (get()._mmConnecting) return;
        set({ _mmConnecting: true });

        const isRehydrating = get()._rehydrating;
        const setError = (error: string) => {
          if (!isRehydrating) set({ walletError: error });
        };

        set({ connecting: true, walletError: null });

        try {
          if (!window.ethereum) {
            setError('MetaMask not detected. Please install MetaMask.');
            set({ connecting: false, _mmConnecting: false });
            return;
          }

          const {
            ensureQFNetwork,
            createEvmWalletClient,
            setReconnecting,
          } = await import('../utils/evmProvider');

          // Prevent MetaMask event handlers from firing during connection
          setReconnecting(true);

          try {
            await ensureQFNetwork();
          } catch (err: any) {
            if (err?.code === 4001) {
              setError('Please switch to QF Network to continue.');
              set({ connecting: false, _mmConnecting: false });
              setReconnecting(false);
              return;
            }
            throw err;
          }

          const walletClient = await createEvmWalletClient();

          const evmAddr = walletClient.account?.address as `0x${string}`;
          if (!evmAddr) throw new Error('No account returned from MetaMask');

          // Set connected state immediately — name resolves in background
          set({
            address: evmAddr,
            ss58Address: null,
            displayName: `${evmAddr.slice(0, 6)}...${evmAddr.slice(-4)}`,
            walletName: 'metamask',
            providerType: 'evm',
            accountMapped: true,
            showWalletModal: false,
          });

          // Re-enable event handlers now that state is stable
          setReconnecting(false);

          // Resolve QNS name with retry — critical for navbar pill
          resolveNameWithRetry(evmAddr, 3, 2000).then((name) => {
            if (name) {
              set({ qnsName: name, displayName: name });
            }
          });

          // Set up MetaMask event watchers (only once per connection)
          // Clean up previous listener first
          (window as any).__qns_mm_cleanup?.();

          const { watchMetaMaskChanges } = await import(
            '../utils/evmProvider'
          );
          const cleanup = watchMetaMaskChanges(
            // accountsChanged
            (accounts) => {
              if (accounts.length === 0) {
                // User disconnected in MetaMask
                get().disconnect();
              } else {
                const newAddr = accounts[0] as `0x${string}`;
                const currentAddr = get().address;
                if (
                  newAddr.toLowerCase() !== currentAddr?.toLowerCase()
                ) {
                  // Account actually changed — soft update, not full disconnect/reconnect
                  import('../utils/evmProvider').then(
                    async ({ createEvmWalletClient: recreate }) => {
                      try {
                        await recreate();
                        set({
                          address: newAddr,
                          displayName: `${newAddr.slice(0, 6)}...${newAddr.slice(-4)}`,
                          // Clear name — will re-resolve
                          qnsName: null,
                        });
                        // Resolve name for new account
                        resolveNameWithRetry(newAddr, 3, 2000).then(
                          (name) => {
                            if (name) {
                              set({
                                qnsName: name,
                                displayName: name,
                              });
                            }
                          }
                        );
                      } catch {
                        get().disconnect();
                      }
                    }
                  );
                }
                // Same account — no-op (spurious MetaMask event)
              }
            },
            // chainChanged
            async (chainId: string) => {
              const expectedChainId = 3426; // QF Network
              const newChainId = parseInt(chainId, 16);
              if (newChainId === expectedChainId) {
                // Switched back to QF Network — rebuild wallet client silently
                try {
                  const { createEvmWalletClient: recreate } =
                    await import('../utils/evmProvider');
                  await recreate();
                } catch {
                  // Silent — lazy recovery in evmContractCall will handle it
                }
              } else {
                // Wrong chain — don't disconnect, just show a warning.
                // The ensureQFNetwork() call before every write will prompt to switch back.
                // This prevents the destructive disconnect/reconnect cycle.
              }
            }
          );
          (window as any).__qns_mm_cleanup = cleanup;
        } catch (error: any) {
          const msg = error?.message || '';
          if (
            msg.includes('User rejected') ||
            msg.includes('User denied') ||
            error?.code === 4001
          ) {
            setError('Connection rejected. Please try again.');
          } else if (msg.includes('MetaMask not')) {
            setError(msg);
          } else {
            setError(msg || 'Failed to connect MetaMask');
          }
          const { destroyEvmClients, setReconnecting } = await import(
            '../utils/evmProvider'
          );
          setReconnecting(false);
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
          set({ connecting: false, _mmConnecting: false });
        }
      },

      disconnect: () => {
        const { providerType } = get();
        disconnectWallet();

        if (providerType === 'evm') {
          (window as any).__qns_mm_cleanup?.();
          delete (window as any).__qns_mm_cleanup;
          import('../utils/evmProvider').then(
            ({ destroyEvmClients, setReconnecting }) => {
              setReconnecting(false);
              destroyEvmClients();
            }
          );
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
          _mmConnecting: false,
        });
      },

      refreshName: async () => {
        const { address, qnsName: existingName } = get();
        if (!address) return;
        try {
          const { resolveReverse } = await import('../utils/qns');
          const name = await resolveReverse(address);
          if (name) {
            set({ qnsName: name, displayName: name });
          } else if (!existingName) {
            const { ss58Address } = get();
            set({
              qnsName: null,
              displayName: ss58Address
                ? truncateAddress(ss58Address)
                : truncateAddress(address),
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
      version: 5, // bumped from 4 → 5 for _mmConnecting field
      migrate: (persistedState, version) => {
        if (version < 5) return undefined as unknown as WalletState;
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
              // MetaMask rehydration — no PAPI warmup needed (MetaMask bypasses PAPI entirely)
              state
                .connectMetaMask()
                .then(() => {
                  useWalletStore.setState({ _rehydrating: false });
                })
                .catch(() => {
                  useWalletStore.setState({ _rehydrating: false });
                  state.disconnect();
                });
            } else {
              // Substrate wallet rehydration — must warm up PAPI first
              const walletType = state.walletName as 'talisman' | 'subwallet';
              const onMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
              const walletValidForPlatform =
                (onMobile && walletType === 'subwallet') ||
                (!onMobile && walletType === 'talisman');

              if (!walletValidForPlatform) {
                useWalletStore.setState({ _rehydrating: false });
                state.disconnect();
                return;
              }

              // Warm up PAPI before connecting — this ensures PAPI's internal
              // nonce tracker has processed at least one block before
              // ensureAccountMapped fires a transaction.
              import('../utils/papiClient').then(({ warmUpPapi }) =>
                warmUpPapi().then(() => {
                  state
                    .connectWallet(walletType)
                    .then(() => {
                      useWalletStore.setState({ _rehydrating: false });
                    })
                    .catch(() => {
                      useWalletStore.setState({ _rehydrating: false });
                      state.disconnect();
                    });
                })
              );
            }
          } else if (state?.address) {
            state.refreshName();
          }
        };
      },
    }
  )
);
