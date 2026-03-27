import { getEvmPublicClient, getOrCreateEvmWalletClient, ensureQFNetwork } from './evmProvider';
import { qfNetwork } from '../config/evmChain';
import type { TxResult } from './contractCall';

/**
 * Read from a contract via the ETH RPC endpoint (for MetaMask users).
 */
export async function evmCallContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const client = getEvmPublicClient();
  const result = await client.readContract({
    address: contractAddress as `0x${string}`,
    abi,
    functionName,
    args,
  });
  return result as T;
}

/**
 * Write to a contract via MetaMask signing.
 * Uses lazy wallet client recovery — self-heals if the singleton was killed
 * by a disconnect/reconnect race.
 */
export async function evmWriteContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  value: bigint = 0n,
  verifyOnChain?: () => Promise<boolean>
): Promise<TxResult> {
  // Lazy recovery — reconstructs wallet client if it was killed
  const walletClient = await getOrCreateEvmWalletClient();
  if (!walletClient) {
    throw new Error('MetaMask not connected. Please reconnect your wallet.');
  }

  // Ensure we're on QF Network before writing
  try {
    await ensureQFNetwork();
  } catch (err: any) {
    if (err?.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error('Please switch MetaMask to QF Network and try again.');
  }

  try {
    const txHash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi,
      functionName,
      args,
      value,
      chain: qfNetwork,
    });

    const confirmation = new Promise<{ confirmed: boolean; error?: string }>(
      async (resolve) => {
        try {
          const publicClient = getEvmPublicClient();
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: 30_000,
          });

          if (receipt.status === 'success') {
            resolve({ confirmed: true });
          } else {
            resolve({ confirmed: false, error: 'Transaction reverted' });
          }
        } catch (err: any) {
          if (verifyOnChain) {
            try {
              const onChain = await verifyOnChain();
              resolve({
                confirmed: onChain,
                error: onChain ? undefined : 'not_confirmed',
              });
            } catch {
              resolve({ confirmed: false, error: 'verification_failed' });
            }
          } else {
            resolve({ confirmed: false, error: 'not_confirmed' });
          }
        }
      }
    );

    return { txHash, confirmation };
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (
      msg.includes('User denied') ||
      msg.includes('User rejected') ||
      msg.includes('ACTION_REJECTED') ||
      err.code === 4001
    ) {
      throw new Error('Transaction rejected by user');
    }
    // Chain mismatch errors from viem
    if (msg.includes('chain') && (msg.includes('mismatch') || msg.includes('switch'))) {
      throw new Error('Please switch MetaMask to QF Network and try again.');
    }
    throw new Error(`Transaction failed: ${msg}`);
  }
}

/**
 * Send a native QF transfer via MetaMask.
 * Uses lazy wallet client recovery.
 */
export async function evmSendTransfer(
  toAddress: string,
  amount: bigint,
  verifyOnChain?: () => Promise<boolean>
): Promise<TxResult> {
  const walletClient = await getOrCreateEvmWalletClient();
  if (!walletClient) {
    throw new Error('MetaMask not connected. Please reconnect your wallet.');
  }

  try {
    await ensureQFNetwork();
  } catch (err: any) {
    if (err?.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error('Please switch MetaMask to QF Network and try again.');
  }

  try {
    const txHash = await walletClient.sendTransaction({
      to: toAddress as `0x${string}`,
      value: amount,
      chain: qfNetwork,
    });

    const confirmation = new Promise<{ confirmed: boolean; error?: string }>(
      async (resolve) => {
        try {
          const publicClient = getEvmPublicClient();
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: 30_000,
          });
          if (receipt.status === 'success') {
            resolve({ confirmed: true });
          } else {
            resolve({ confirmed: false, error: 'Transfer reverted' });
          }
        } catch {
          if (verifyOnChain) {
            try {
              const onChain = await verifyOnChain();
              resolve({
                confirmed: onChain,
                error: onChain ? undefined : 'not_confirmed',
              });
            } catch {
              resolve({ confirmed: false, error: 'verification_failed' });
            }
          } else {
            resolve({ confirmed: false, error: 'not_confirmed' });
          }
        }
      }
    );

    return { txHash, confirmation };
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (
      msg.includes('User denied') ||
      msg.includes('User rejected') ||
      err.code === 4001
    ) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Transfer failed: ${msg}`);
  }
}

/**
 * Get native QF balance for an EVM address via ETH RPC.
 */
export async function evmGetBalance(address: string): Promise<bigint> {
  try {
    const client = getEvmPublicClient();
    return await client.getBalance({ address: address as `0x${string}` });
  } catch {
    return 0n;
  }
}
