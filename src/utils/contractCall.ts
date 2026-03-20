import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { Binary } from 'polkadot-api';
import { getTypedApi } from './papiClient';
import { getCurrentConnection } from './wallet';
import { ensureAccountMapped } from './accountMapping';

const DEPLOYER_SS58 = "5FbmtGERRp4MhuwojmA2XGWghZ7XSNBLCUKQCrTVRz8bVGrU";

// ─── Read path (unchanged) ───────────────────────────────────────────

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

  if (!returnBytes && inner && typeof inner === 'object') {
    if ('Ok' in inner && (inner as any).Ok?.data) {
      returnBytes = (inner as any).Ok.data;
    } else if ('Err' in inner) {
      throw new Error(`Contract call error for ${functionName}: ${JSON.stringify((inner as any).Err)}`);
    }
  }

  if (!returnBytes && (callResult as any)?.data) {
    returnBytes = (callResult as any).data;
  }

  if (!returnBytes) {
    throw new Error(`No return data from ${functionName}. Raw: ${JSON.stringify(callResult).slice(0, 300)}`);
  }

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

// ─── Write path — fire-and-forget with tx hash polling ───────────────

/**
 * Sign a Revive.call tx, broadcast it, and return as soon as the
 * txHash appears in any best block. Does NOT wait for GRANDPA finality.
 *
 * Strategy:
 *  1. Build the tx object.
 *  2. Use `.sign()` to get the signed extrinsic hex.
 *  3. Broadcast via the low-level RPC `author_submitExtrinsic`.
 *  4. Immediately get the txHash.
 *  5. Poll best blocks looking for the tx until found or timeout.
 */
export async function writeContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  _signer: any,
  value: bigint = 0n
): Promise<string> {
  const connection = getCurrentConnection();
  if (!connection) {
    throw new Error('Wallet not connected. Please disconnect and reconnect your wallet.');
  }

  try {
    await ensureAccountMapped(connection.address);
  } catch (mapErr: any) {
    const msg = mapErr?.message ?? '';
    if (msg.includes('CannotLookup') || msg.includes('METADATA_HASH_ERROR')) {
      throw new Error(
        'CheckMetadataHash error: disable this in Talisman → Settings → Networks & Tokens → QF Network → uncheck metadata hash verification. Then reconnect.'
      );
    }
    throw new Error('Account mapping failed. Please disconnect and reconnect your wallet.');
  }

  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  // Dry-run for gas estimation (best-effort, don't block on failure)
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
    const d = dryRun as any;
    if (d.gas_required) gasLimit = d.gas_required;
    if (d.storage_deposit?.value) storageDeposit = d.storage_deposit.value;
  } catch {
    // Use defaults
  }

  const tx = typedApi.tx.Revive.call({
    dest: Binary.fromHex(contractAddress),
    value,
    gas_limit: gasLimit,
    storage_deposit_limit: storageDeposit,
    data: Binary.fromHex(data),
  });

  // ── Sign, broadcast, and resolve on best-block inclusion ──

  let txHash: string;

  try {
    // signSubmitAndWatch gives us an Observable.
    // We subscribe manually and resolve on first best-block inclusion.
    const result = await new Promise<{ txHash: string; blockHash: string }>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Transaction was not included within 60 seconds. It may still succeed — check the explorer and refresh.'));
        }
      }, 60_000);

      const sub = tx.signSubmitAndWatch(connection.signer.polkadotSigner, {
        at: 'best' as const,
      }).subscribe({
        next(ev: any) {
          if (settled) return;

          // Grab txHash from any event that has it
          if (ev.txHash && !txHash) {
            txHash = ev.txHash;
          }

          // txBestBlocksState with found:true → tx is in a best block
          if (ev.type === 'txBestBlocksState' && ev.found) {
            settled = true;
            clearTimeout(timeout);
            try { sub.unsubscribe(); } catch {}

            if (!ev.ok && ev.dispatchError) {
              const errType = ev.dispatchError?.type ?? 'Unknown';
              const errValue = ev.dispatchError?.value;
              let detail = errType;
              if (errValue && typeof errValue === 'object' && 'type' in errValue) {
                detail = `${errType}::${errValue.type}`;
              }
              reject(new Error(`Transaction reverted: ${detail}`));
              return;
            }

            resolve({ txHash: ev.txHash, blockHash: ev.block.hash });
            return;
          }

          // finalized → also good, resolve immediately
          if (ev.type === 'finalized') {
            settled = true;
            clearTimeout(timeout);
            try { sub.unsubscribe(); } catch {}

            if (!ev.ok && ev.dispatchError) {
              reject(new Error(`Transaction reverted: ${ev.dispatchError?.type ?? 'Unknown'}`));
              return;
            }

            resolve({ txHash: ev.txHash, blockHash: ev.block.hash });
            return;
          }

          // txBestBlocksState not found + not valid → tx dropped
          if (ev.type === 'txBestBlocksState' && !ev.found && ev.isValid === false) {
            settled = true;
            clearTimeout(timeout);
            try { sub.unsubscribe(); } catch {};
            reject(new Error('Transaction became invalid and was dropped from the pool.'));
            return;
          }
        },
        error(err: any) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(err);
          }
        },
      });
    });

    return result.blockHash;
  } catch (err: any) {
    const msg = err?.message ?? '';

    if (msg.includes('Cancelled') || msg.includes('Rejected') || msg.includes('cancelled') || msg.includes('rejected')) {
      throw new Error('Transaction rejected by user');
    }
    if (msg.includes('CannotLookup')) {
      throw new Error(
        'CheckMetadataHash error: disable this in Talisman → Settings → Networks & Tokens → QF Network → uncheck metadata hash verification.'
      );
    }

    throw new Error(`Transaction failed: ${msg}`);
  }
}

// ─── Transfer path ───────────────────────────────────────────────────

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

  const result = await new Promise<{ txHash: string; blockHash: string }>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Transfer not included within 60s. Check explorer and refresh.'));
      }
    }, 60_000);

    const sub = tx.signSubmitAndWatch(connection.signer.polkadotSigner, {
      at: 'best' as const,
    }).subscribe({
      next(ev: any) {
        if (settled) return;
        if ((ev.type === 'txBestBlocksState' && ev.found) || ev.type === 'finalized') {
          settled = true;
          clearTimeout(timeout);
          try { sub.unsubscribe(); } catch {}
          if (!ev.ok && ev.dispatchError) {
            reject(new Error(`Transfer reverted: ${ev.dispatchError?.type ?? 'Unknown'}`));
            return;
          }
          resolve({ txHash: ev.txHash, blockHash: ev.block.hash });
        }
        if (ev.type === 'txBestBlocksState' && !ev.found && ev.isValid === false) {
          settled = true;
          clearTimeout(timeout);
          try { sub.unsubscribe(); } catch {}
          reject(new Error('Transfer dropped from pool.'));
        }
      },
      error(err: any) {
        if (!settled) { settled = true; clearTimeout(timeout); reject(err); }
      },
    });
  });

  return result.blockHash;
}
