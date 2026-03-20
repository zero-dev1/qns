import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { Binary } from 'polkadot-api';
import { getTypedApi } from './papiClient';
import { getCurrentConnection } from './wallet';
import { ensureAccountMapped } from './accountMapping';
import { firstValueFrom, filter, map } from 'rxjs';

// For read-only calls, we need a mapped origin. The deployer is always mapped.
const DEPLOYER_SS58 = "5FbmtGERRp4MhuwojmA2XGWghZ7XSNBLCUKQCrTVRz8bVGrU";

// ── Helpers ──────────────────────────────────────────────────────────

/** Shared TxOptions for every signSubmitAndWatch / signAndSubmit call */
function baseTxOptions() {
  return {
    at: "best" as const,
    mortality: { mortal: true, period: 64 } as const,
  };
}

/**
 * Subscribe to an observable-based tx, resolve as soon as the tx
 * is **found in a best block** (not finalization). Falls back to
 * finalized if best-block event never fires.
 *
 * Rejects on:
 *  - user cancellation / wallet rejection
 *  - InvalidTxError
 *  - timeout (default 120 s)
 *  - dispatch error (extrinsic reverted on-chain)
 */
function resolveOnInclusion(
  observable: ReturnType<ReturnType<typeof getTypedApi>['tx']['Revive']['call']>['signSubmitAndWatch'] extends (s: any, o?: any) => infer R ? R : never
): Promise<{ txHash: string; blockHash: string; blockNumber: number }> {
  // We want the first event where the tx is found in a best block OR finalized
  return firstValueFrom(
    (observable as any).pipe(
      filter((ev: any) => {
        // txBestBlocksState with found:true  →  included in best block
        if (ev.type === 'txBestBlocksState' && ev.found) return true;
        // finalized  →  included and finalized
        if (ev.type === 'finalized') return true;
        return false;
      }),
      map((ev: any) => {
        // Check for dispatch error (extrinsic reverted)
        if (!ev.ok && ev.dispatchError) {
          const errType = ev.dispatchError?.type ?? '';
          const errValue = ev.dispatchError?.value;
          let detail = errType;
          if (errValue && typeof errValue === 'object' && 'type' in errValue) {
            detail = `${errType}::${errValue.type}`;
          }
          throw new Error(`Transaction reverted on-chain: ${detail}`);
        }
        return {
          txHash: ev.txHash as string,
          blockHash: ev.block.hash as string,
          blockNumber: ev.block.number as number,
        };
      }),
    ),
    { defaultValue: undefined }
  ).then(val => {
    if (!val) throw new Error('Transaction was not included within the timeout');
    return val as { txHash: string; blockHash: string; blockNumber: number };
  });
}

// ── Read path (unchanged logic, cleaned up) ──────────────────────────

export async function callContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  const callResult = await typedApi.apis.ReviveApi.call(
    DEPLOYER_SS58,
    Binary.fromHex(contractAddress),
    0n,
    undefined,
    undefined,
    Binary.fromHex(data)
  );

  const inner = callResult.result;
  let returnBytes: Uint8Array | string | null = null;

  // Pattern 1: PAPI codec result with .success boolean
  if (inner && typeof inner === 'object' && 'success' in inner) {
    if (inner.success && inner.value?.data) {
      const d = inner.value.data;
      if (d instanceof Uint8Array) returnBytes = d;
      else if (d && typeof (d as any).asBytes === 'function') returnBytes = (d as any).asBytes();
      else if (d && typeof (d as any).asHex === 'function') returnBytes = (d as any).asHex();
      else returnBytes = d as any;
    } else if (!inner.success) {
      throw new Error(`Contract call reverted for ${functionName}: ${JSON.stringify(inner)}`);
    }
  }

  // Pattern 2: Rust-style Ok/Err enum
  if (!returnBytes && inner && typeof inner === 'object') {
    if ('Ok' in inner && (inner as any).Ok?.data) {
      returnBytes = (inner as any).Ok.data;
    } else if ('Err' in inner) {
      throw new Error(`Contract call error for ${functionName}: ${JSON.stringify((inner as any).Err)}`);
    }
  }

  // Pattern 3: Direct .data on result
  if (!returnBytes && (callResult as any)?.data) {
    returnBytes = (callResult as any).data;
  }

  if (!returnBytes) {
    throw new Error(`No return data from ${functionName}. Raw: ${JSON.stringify(callResult).slice(0, 300)}`);
  }

  // Convert to hex string for viem decoding
  let hex: `0x${string}`;
  if (returnBytes instanceof Uint8Array) {
    hex = Binary.fromBytes(returnBytes).asHex() as `0x${string}`;
  } else if (typeof returnBytes === 'string') {
    hex = (returnBytes.startsWith('0x') ? returnBytes : '0x' + returnBytes) as `0x${string}`;
  } else if (returnBytes && typeof (returnBytes as any).asHex === 'function') {
    hex = (returnBytes as any).asHex() as `0x${string}`;
  } else if (returnBytes && typeof (returnBytes as any).toHex === 'function') {
    hex = (returnBytes as any).toHex() as `0x${string}`;
  } else {
    throw new Error(`Cannot convert return data to hex for ${functionName}`);
  }

  return decodeFunctionResult({ abi, functionName, data: hex }) as T;
}

// ── Write path ───────────────────────────────────────────────────────

export async function writeContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  _signer: any,
  value: bigint = 0n
): Promise<string> {
  // 1. Check wallet connection
  const connection = getCurrentConnection();
  if (!connection) {
    throw new Error('Wallet not connected. Please disconnect and reconnect your wallet.');
  }

  // 2. Ensure account is mapped
  try {
    await ensureAccountMapped(connection.address);
  } catch (mapErr: any) {
    if (mapErr.message === 'METADATA_HASH_ERROR') {
      throw new Error(
        'CheckMetadataHash error: please disable this setting for QF Network in your wallet (Talisman → Settings → Networks & Tokens → QF Network → uncheck "Verify transaction with metadata hash").'
      );
    }
    throw new Error('Account mapping failed. Please disconnect and reconnect your wallet.');
  }

  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  // 3. Dry-run for gas estimation
  //    For payable functions the dry-run may revert because the simulation
  //    doesn't actually transfer value. We still extract gas_required and
  //    use it; if we can't, fall back to generous defaults.
  let gasLimit = { ref_time: 100_000_000_000n, proof_size: 5_000_000n };
  let storageDeposit = 0n;

  try {
    const dryRun = await typedApi.apis.ReviveApi.call(
      connection.address,
      Binary.fromHex(contractAddress),
      value,
      undefined,
      undefined,
      Binary.fromHex(data)
    );
    const dryAny = dryRun as any;

    // Extract gas_required if present (even if dry-run "failed" for payable)
    if (dryAny.gas_required) {
      gasLimit = dryAny.gas_required;
    }
    if (dryAny.storage_deposit?.value) {
      storageDeposit = dryAny.storage_deposit.value;
    }
  } catch {
    // Dry-run RPC failed entirely → use defaults above
  }

  // 4. Build, sign, submit, and watch
  const tx = typedApi.tx.Revive.call({
    dest: Binary.fromHex(contractAddress),
    value,
    gas_limit: gasLimit,
    storage_deposit_limit: storageDeposit,
    data: Binary.fromHex(data),
  });

  try {
    const observable = tx.signSubmitAndWatch(
      connection.signer.polkadotSigner,
      baseTxOptions()
    );

    const result = await resolveOnInclusion(observable);
    return result.blockHash;
  } catch (err: any) {
    const msg = err?.message ?? '';

    // User rejected in wallet extension
    if (msg.includes('Cancelled') || msg.includes('Rejected') || msg.includes('cancelled') || msg.includes('rejected')) {
      throw new Error('Transaction rejected by user');
    }

    // CheckMetadataHash / CannotLookup
    if (msg.includes('CannotLookup')) {
      throw new Error(
        'CheckMetadataHash error: please disable this setting for QF Network in your wallet (Talisman → Settings → Networks & Tokens → QF Network → uncheck "Verify transaction with metadata hash").'
      );
    }

    // InvalidTxError – pass through with useful context
    if (err?.error) {
      throw new Error(`Transaction invalid: ${JSON.stringify(err.error)}`);
    }

    throw new Error(`Transaction failed: ${msg}`);
  }
}

// ── Transfer path ────────────────────────────────────────────────────

export async function sendTransfer(
  toAddress: string,
  amount: bigint,
  _signerAddress: string
): Promise<string> {
  const connection = getCurrentConnection();
  if (!connection) throw new Error('Wallet not connected');

  const typedApi = getTypedApi();

  const tx = typedApi.tx.Balances.transfer_keep_alive({
    dest: { type: 'Id', value: toAddress } as any,
    value: amount,
  });

  try {
    const observable = tx.signSubmitAndWatch(
      connection.signer.polkadotSigner,
      baseTxOptions()
    );

    const result = await resolveOnInclusion(observable);
    return result.blockHash;
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('Cancelled') || msg.includes('Rejected')) {
      throw new Error('Transaction rejected by user');
    }
    if (msg.includes('CannotLookup')) {
      throw new Error(
        'CheckMetadataHash error: please disable this setting for QF Network in your wallet.'
      );
    }
    throw new Error(`Transfer failed: ${msg}`);
  }
}
