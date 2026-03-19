import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveReverse, truncateAddress } from '../utils/qns';
import { ensureAccountMapped } from '../utils/accountMapping';
import { 
  WALLET_MODE, 
  connectSubstrateWallet, 
  connectEVMWallet, 
  type WalletConnection 
} from '../utils/wallet';

interface WalletState {
  // Common fields
  address: `0x${string}` | null;      // EVM address (derived for substrate, native for evm)
  ss58Address: string | null;          // Substrate SS58 address (null for evm)
  qnsName: string | null;
  displayName: string | null;
  connecting: boolean;
  walletConnection: WalletConnection | null;
  
  // Wallet selection modal
  showWalletModal: boolean;
  
  // Error handling
  walletError: string | null;
  
  // Getters
  getBalanceAddress: () => string | null;  // Returns SS58 for substrate, null for EVM (uses address)
  
  // Actions
  connect: () => Promise<void>;
  connectWallet: (walletType: 'talisman' | 'subwallet' | 'metamask') => Promise<void>;
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
      showWalletModal: false,
      walletError: null,

      // Returns the address to use for balance queries
      // For substrate wallets: returns SS58 address (for api.query.system.account)
      // For EVM wallets: returns null (balance fetched via eth-rpc)
      getBalanceAddress: () => {
        const state = get();
        return state.ss58Address; // null for EVM wallets, SS58 for substrate
      },

      connect: async () => {
        // Show the wallet selection modal based on WALLET_MODE
        if (WALLET_MODE === 'substrate') {
          set({ showWalletModal: true });
        } else if (WALLET_MODE === 'evm') {
          // Direct MetaMask connection for EVM mode
          await get().connectWallet('metamask');
        } else {
          // 'both' mode - show modal with all options
          set({ showWalletModal: true });
        }
      },

      connectWallet: async (walletType: 'talisman' | 'subwallet' | 'metamask') => {
        set({ connecting: true, walletError: null });
        
        try {
          let connection: WalletConnection;
          
          if (walletType === 'talisman') {
            connection = await connectSubstrateWallet('talisman');
          } else if (walletType === 'subwallet') {
            connection = await connectSubstrateWallet('subwallet-js');
          } else {
            // MetaMask / EVM
            connection = await connectEVMWallet();
          }
          
          // Store the connection
          set({ walletConnection: connection });
          
          if (connection.type === 'substrate') {
            // For substrate wallets, we have both addresses
            const evmAddr = connection.evmAddress as `0x${string}`;
            const ss58Addr = connection.address;
            
            set({ 
              address: evmAddr, 
              ss58Address: ss58Addr,
              displayName: truncateAddress(ss58Addr) // Show truncated SS58 in navbar
            });
            
            // Try to resolve QNS name for the EVM address
            // This is now awaited - the modal will stay open until name resolution completes
            const name = await resolveReverse(evmAddr);
            if (name) {
              set({ qnsName: name, displayName: name });
            }
            
            // Fire and forget — don't block connection on this
            // If it fails, writeContract will retry before the first transaction
            ensureAccountMapped(ss58Addr).catch(err => {
              console.warn('[QF] Background account mapping failed, will retry before first tx:', err.message);
            });
          } else {
            // For EVM wallets
            const evmAddr = connection.address as `0x${string}`;
            set({ 
              address: evmAddr, 
              ss58Address: null,
              displayName: truncateAddress(evmAddr) 
            });
            
            // Try to resolve QNS name for the EVM address
            // This is now awaited - the modal will stay open until name resolution completes
            const name = await resolveReverse(evmAddr);
            if (name) {
              set({ qnsName: name, displayName: name });
            }
            
            // Switch to QF Network
            const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || '42');
            const chainIdHex = '0x' + chainId.toString(16);

            try {
              await window.ethereum!.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
              });
            } catch (switchError: any) {
              // Chain not found, try to add it
              if (switchError.code === 4902) {
                const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://localhost:8545';
                const explorerUrl = import.meta.env.VITE_BLOCK_EXPLORER_URL;

                const addChainParams: any = {
                  chainId: chainIdHex,
                  chainName: 'QF Network',
                  rpcUrls: [rpcUrl],
                  nativeCurrency: {
                    name: 'QF',
                    symbol: 'QF',
                    decimals: 18,
                  },
                };

                if (explorerUrl) {
                  addChainParams.blockExplorerUrls = [explorerUrl];
                }

                await window.ethereum!.request({
                  method: 'wallet_addEthereumChain',
                  params: [addChainParams],
                });
              }
            }

            // Listen for account changes (only for EVM wallets)
            window.ethereum!.on('accountsChanged', (accounts: unknown) => {
              const accts = accounts as string[];
              if (accts.length === 0) {
                set({ address: null, ss58Address: null, qnsName: null, displayName: null, walletConnection: null });
              } else {
                const newAddr = accts[0] as `0x${string}`;
                set({ address: newAddr, ss58Address: null, displayName: truncateAddress(newAddr), qnsName: null, walletConnection: null });
                resolveReverse(newAddr).then((name) => {
                  if (name) set({ qnsName: name, displayName: name });
                });
              }
            });

            // Reload on chain change to reset all state
            window.ethereum!.on('chainChanged', () => {
              window.location.reload();
            });
          }
          
          // Only close modal on successful connection (not on error)
          // This ensures the full flow completes before UI updates
          set({ showWalletModal: false });
        } catch (error: any) {
          console.error('Wallet connection failed:', error);
          set({ 
            walletError: error.message || 'Failed to connect wallet',
            // Keep modal open to show error - do NOT set showWalletModal: false here
          });
        } finally {
          set({ connecting: false });
        }
      },

      disconnect: () => {
        const { walletConnection } = get();
        
        // Call the disconnect function on the wallet connection if it exists
        if (walletConnection) {
          walletConnection.disconnect();
        }
        
        // Clear all state
        set({ 
          address: null, 
          ss58Address: null,
          qnsName: null, 
          displayName: null, 
          walletConnection: null,
          showWalletModal: false
        });
        
        // If it was a substrate connection, we may want to clean up the API
        // But we keep it alive for potential reconnections
      },

      refreshName: async () => {
        const { address } = get();
        if (!address) return;
        const name = await resolveReverse(address);
        if (name) {
          set({ qnsName: name, displayName: name });
        } else {
          const { ss58Address } = get();
          // Show SS58 if available, otherwise show truncated EVM address
          set({ 
            qnsName: null, 
            displayName: ss58Address ? truncateAddress(ss58Address) : truncateAddress(address) 
          });
        }
      },
      
      setShowWalletModal: (show: boolean) => {
        set({ showWalletModal: show });
        if (!show) {
          set({ walletError: null }); // Clear error when closing modal
        }
      },
      
      clearWalletError: () => {
        set({ walletError: null });
      },
    }),
    {
      name: 'qns-wallet-storage',
      version: 2, // Bump version for substrate support
      migrate: (persistedState, version) => {
        // Clear persisted state on version change to force fresh fetch
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
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.address) {
            state.refreshName();
          }
        };
      },
    }
  )
);
