import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import { decodeAddress, keccakAsHex } from '@polkadot/util-crypto';

// Type declaration for window.injectedWeb3
declare global {
  interface Window {
    injectedWeb3?: Record<string, unknown>;
  }
}

// Configuration constant for wallet mode
export const WALLET_MODE: 'substrate' | 'evm' | 'both' = 'substrate';

// RPC endpoint from environment variable with default fallback
// Note: For localhost, use ws:// (unencrypted). For production, use wss:// (secure).
const QF_RPC_URL = import.meta.env.VITE_QF_RPC_URL || 'ws://localhost:9944';

// Connection timeout in milliseconds
const API_CONNECTION_TIMEOUT = 10000; // 10 seconds

// TypeScript interface for wallet connection
export interface WalletConnection {
  type: 'substrate' | 'evm';
  address: string;          // SS58 for substrate, 0x for evm
  evmAddress: string;       // derived EVM address (for substrate) or native (for evm)
  name: string;             // wallet name e.g. "Talisman", "MetaMask"
  disconnect: () => void;
}

// Singleton instance for ApiPromise
let apiInstance: ApiPromise | null = null;

// Store for disconnect callbacks and provider
let providerInstance: WsProvider | null = null;

/**
 * Get or create the ApiPromise singleton instance
 * Used for: balance queries, transaction signing (writes)
 * @throws Error if connection fails or times out
 */
export async function getApi(): Promise<ApiPromise> {
  if (apiInstance) {
    // Check if still connected
    if (apiInstance.isConnected) {
      return apiInstance;
    }
    // Disconnect and reconnect if connection was lost
    await disconnectApi();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`WebSocket connection timeout after ${API_CONNECTION_TIMEOUT}ms. Please check that the QF node is running at ${QF_RPC_URL}`));
    }, API_CONNECTION_TIMEOUT);

    providerInstance = new WsProvider(QF_RPC_URL);
    
    providerInstance.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      reject(new Error(`WebSocket connection failed: ${error.message}`));
    });

    ApiPromise.create({ provider: providerInstance })
      .then((api) => {
        clearTimeout(timeoutId);
        apiInstance = api;
        
        console.log('[QF] Connected to Substrate RPC for writes/balances');
        
        // Handle disconnects
        api.on('disconnected', () => {
          console.warn('[QF] WebSocket disconnected');
        });
        
        resolve(api);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to create API instance: ${error.message}`));
      });
  });
}

/**
 * Get the signer for a given address (for transaction submission)
 */
export async function getSigner(address: string) {
  const injector = await web3FromAddress(address);
  return injector.signer;
}

/**
 * Derive EVM address from SS58 substrate address
 * Uses Keccak-256 hash of the decoded 32-byte public key, take last 20 bytes, prefix with 0x
 */
export function deriveEVMAddress(ss58Address: string): string {
  // Decode SS58 address to get the 32-byte public key
  const publicKey = decodeAddress(ss58Address);
  
  // Apply Keccak-256 hash (returns hex string with 0x prefix)
  const hash = keccakAsHex(publicKey);
  
  // Take last 20 bytes (40 hex chars) and prefix with 0x
  const evmAddress = '0x' + hash.slice(-40);
  
  return evmAddress.toLowerCase();
}

/**
 * Connect to a Substrate wallet extension (e.g., Talisman, Polkadot.js)
 * Includes retry logic for extension detection timing issues
 */
export async function connectSubstrateWallet(walletName: string): Promise<WalletConnection> {
  console.log(`[QF] Connecting to ${walletName} wallet...`);
  
  // Check for injected Web3 (for debugging)
  if (typeof window !== 'undefined') {
    console.log('[QF] window.injectedWeb3:', window.injectedWeb3 ? Object.keys(window.injectedWeb3) : 'undefined');
  }
  
  // Enable web3 extensions for the app with retry logic
  let extensions = await web3Enable('QNS');
  console.log('[QF] Initial extensions found:', extensions.length, extensions.map(e => e.name));
  
  // Retry once after a short delay if no extensions found (timing issue)
  if (extensions.length === 0) {
    console.log('[QF] No extensions found, waiting 500ms and retrying...');
    await new Promise(resolve => setTimeout(resolve, 500));
    extensions = await web3Enable('QNS');
    console.log('[QF] Retry extensions found:', extensions.length, extensions.map(e => e.name));
  }
  
  if (extensions.length === 0) {
    console.error('[QF] No Polkadot/Substrate extension found after retry');
    throw new Error('No Polkadot wallet found. Please install Talisman or SubWallet.');
  }

  // Get all accounts from extensions
  const allAccounts = await web3Accounts();
  console.log('[QF] Total accounts found:', allAccounts.length, allAccounts.map(a => ({ address: a.address.slice(0, 20) + '...', source: a.meta.source })));
  
  if (allAccounts.length === 0) {
    throw new Error('No accounts found. Please create or import an account in your wallet extension.');
  }

  // Filter for the selected wallet extension
  let filteredAccounts = allAccounts;
  if (walletName) {
    filteredAccounts = allAccounts.filter(
      (account) => account.meta.source?.toLowerCase() === walletName.toLowerCase()
    );
  }
  
  // If no accounts match the wallet name, use all accounts
  if (filteredAccounts.length === 0) {
    console.warn(`[QF] No accounts found for wallet "${walletName}", using all accounts`);
    filteredAccounts = allAccounts;
  }

  // Get the first account
  const selectedAccount = filteredAccounts[0];
  const ss58Address = selectedAccount.address;
  
  console.log(`[QF] Selected account: ${ss58Address.slice(0, 20)}... from ${selectedAccount.meta.source}`);
  
  // Initialize API connection (this will create the singleton)
  await getApi();
  
  // Derive EVM address from SS58 address
  const evmAddress = deriveEVMAddress(ss58Address);
  
  // Get the actual wallet name from the account meta
  const actualWalletName = selectedAccount.meta.source || walletName || 'Substrate Wallet';

  // Create disconnect function
  const disconnect = () => {
    // Clean up API instance if needed
    if (apiInstance) {
      // Note: We don't disconnect the API here as it's a singleton shared across connections
      // The API connection remains for other potential operations
    }
  };

  return {
    type: 'substrate',
    address: ss58Address,
    evmAddress,
    name: actualWalletName,
    disconnect
  };
}

/**
 * Connect to an EVM wallet (e.g., MetaMask)
 * This is a placeholder implementation - actual implementation should integrate with existing ethers.js logic
 */
export async function connectEVMWallet(): Promise<WalletConnection> {
  // Check if MetaMask or other Ethereum provider is available
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No Ethereum wallet found. Please install MetaMask or another compatible wallet.');
  }

  const ethereum = (window as any).ethereum;

  // Request account access
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  
  if (!accounts || accounts.length === 0) {
    throw new Error('No EVM accounts found or user rejected the request.');
  }

  const evmAddress = accounts[0].toLowerCase();
  
  // Get wallet name (MetaMask or other)
  let walletName = 'EVM Wallet';
  if (ethereum.isMetaMask) {
    walletName = 'MetaMask';
  } else if (ethereum.isTalisman) {
    walletName = 'Talisman';
  } else if (ethereum.isSubWallet) {
    walletName = 'SubWallet';
  }

  // Create disconnect function
  const disconnect = () => {
    // EVM wallets typically don't have a programmatic disconnect
    // Users disconnect by revoking access in the wallet UI
  };

  return {
    type: 'evm',
    address: evmAddress,
    evmAddress,
    name: walletName,
    disconnect
  };
}

/**
 * Disconnect and clean up the API instance
 * Use this when the app is shutting down or you want to force a reconnection
 */
export async function disconnectApi(): Promise<void> {
  if (apiInstance) {
    await apiInstance.disconnect();
    apiInstance = null;
  }
  if (providerInstance) {
    providerInstance.disconnect();
    providerInstance = null;
  }
}
