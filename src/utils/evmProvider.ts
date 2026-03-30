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
let walletClient: WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc' }> | null = null;

/**
 * Flag to prevent re-entrant MetaMask event handling.
 * When true, watchMetaMaskChanges callbacks become no-ops.
 */
let reconnecting = false;
export function isReconnecting(): boolean {
  return reconnecting;
}
export function setReconnecting(value: boolean): void {
  reconnecting = value;
}

/**
 * Get a read-only public client for QF Network via ETH RPC.
 * Lazily created and cached.
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
 * Called during initial MetaMask connection.
 */
export async function createEvmWalletClient(): Promise<
  WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc' }>
> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  const [address] = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];

  walletClient = createWalletClient({
    account: address as `0x${string}`,
    chain: qfNetwork,
    transport: custom(window.ethereum),
  });

  return walletClient;
}

/**
 * Get the current wallet client, or lazily reconstruct it if MetaMask
 * is still injected and authorized. This is the critical fix — every
 * write path calls this instead of the old getter, so a killed singleton
 * from disconnect/reconnect races is self-healing.
 *
 * Returns null only if MetaMask is genuinely unavailable.
 */
export async function getOrCreateEvmWalletClient(): Promise<
  WalletClient<Transport, Chain, { address: `0x${string}`; type: 'json-rpc' }> | null
> {
  if (walletClient) return walletClient;

  // Attempt lazy recovery — MetaMask stays authorized across page life
  if (!window.ethereum) return null;

  try {
    // eth_accounts doesn't prompt — returns [] if not authorized
    const accounts = (await window.ethereum.request({
      method: 'eth_accounts',
    })) as string[];

    if (!accounts || accounts.length === 0) return null;

    walletClient = createWalletClient({
      account: accounts[0] as `0x${string}`,
      chain: qfNetwork,
      transport: custom(window.ethereum),
    });

    return walletClient;
  } catch {
    return null;
  }
}

/**
 * Synchronous getter — only returns the cached client, no recovery.
 * Use for non-critical reads where you don't want to await.
 */
export function getEvmWalletClient(): WalletClient<
  Transport,
  Chain,
  { address: `0x${string}`; type: 'json-rpc' }
> | null {
  return walletClient;
}

/**
 * Verify MetaMask is currently on the QF Network chain.
 * Returns true if on correct chain, false otherwise.
 */
export async function isOnQFNetwork(): Promise<boolean> {
  if (!window.ethereum) return false;
  try {
    const chainId = (await window.ethereum.request({
      method: 'eth_chainId',
    })) as string;
    return parseInt(chainId, 16) === qfNetwork.id;
  } catch {
    return false;
  }
}

/**
 * Ensure MetaMask is on the QF Network chain. If not, request switch/add.
 * Handles: chain not added (4902), switch unsupported, already on correct chain.
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
      // Switch failed for another reason (method unsupported, etc.)
      // Check if we're already on QF Network — if so, proceed silently
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      if (parseInt(currentChainId, 16) === qfNetwork.id) {
        return; // Already on correct chain — safe to proceed
      }
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
 *
 * IMPORTANT: Callbacks are guarded by the `reconnecting` flag to prevent
 * re-entrant disconnect/reconnect cycles from spurious MetaMask events.
 */
export function watchMetaMaskChanges(
  onAccountChange: (accounts: string[]) => void,
  onChainChange: (chainId: string) => void
): () => void {
  if (!window.ethereum) return () => {};

  const handleAccounts = (...args: unknown[]) => {
    if (reconnecting) return;
    onAccountChange(args[0] as string[]);
  };
  const handleChain = (...args: unknown[]) => {
    if (reconnecting) return;
    onChainChange(args[0] as string);
  };

  window.ethereum.on('accountsChanged', handleAccounts);
  window.ethereum.on('chainChanged', handleChain);

  return () => {
    window.ethereum?.removeListener('accountsChanged', handleAccounts);
    window.ethereum?.removeListener('chainChanged', handleChain);
  };
}
