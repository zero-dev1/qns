import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem';
import { qfNetwork } from '../config/evmChain';

let publicClient: PublicClient | null = null;
let walletClient: WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc'; }> | null = null;

/**
 * Get a read-only public client for QF Network via ETH RPC.
 * This is used for balance checks and contract reads for EVM users.
 */
export function getEvmPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: qfNetwork,
      transport: http(),
    });
  }
  return publicClient;
}

/**
 * Create a wallet client from the injected MetaMask provider.
 * Called after MetaMask connection is established.
 */
export async function createEvmWalletClient(): Promise<WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc'; }>> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const [address] = await window.ethereum.request({
    method: 'eth_requestAccounts',
  }) as string[];

  walletClient = createWalletClient({
    account: address as `0x${string}`,
    chain: qfNetwork,
    transport: custom(window.ethereum),
  });

  return walletClient;
}

/**
 * Get the current wallet client (null if not connected via MetaMask).
 */
export function getEvmWalletClient(): WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc'; }> | null {
  return walletClient;
}

/**
 * Ensure MetaMask is on the QF Network chain. If not, request switch/add.
 */
export async function ensureQFNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not installed');

  const chainIdHex = `0x${qfNetwork.id.toString(16)}`;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: qfNetwork.name,
            nativeCurrency: qfNetwork.nativeCurrency,
            rpcUrls: [qfNetwork.rpcUrls.default.http[0]],
            blockExplorerUrls: [qfNetwork.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Disconnect / cleanup EVM wallet state.
 */
export function destroyEvmClients(): void {
  publicClient = null;
  walletClient = null;
}

/**
 * Set up listeners for MetaMask account and chain changes.
 * Returns a cleanup function.
 */
export function watchMetaMaskChanges(
  onAccountChange: (accounts: string[]) => void,
  onChainChange: (chainId: string) => void,
): () => void {
  if (!window.ethereum) return () => {};

  const handleAccounts = (...args: unknown[]) => {
    onAccountChange(args[0] as string[]);
  };
  const handleChain = (...args: unknown[]) => {
    onChainChange(args[0] as string);
  };

  window.ethereum.on('accountsChanged', handleAccounts);
  window.ethereum.on('chainChanged', handleChain);

  return () => {
    window.ethereum?.removeListener('accountsChanged', handleAccounts);
    window.ethereum?.removeListener('chainChanged', handleChain);
  };
}
