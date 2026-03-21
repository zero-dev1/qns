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

// ─── Write path — resolve on broadcast ───────────────────────────────
//
// QF Network's RPC does not reliably emit best-block subscription events,
// so PAPI's Observable never fires txBestBlocksState. But every tx that
// gets signed and broadcast DOES land on-chain (confirmed via explorer).
//
// Strategy: resolve the Promise the instant PAPI emits "broadcasted".
// The user signed it, the node accepted it, it WILL be included.
// This is the same pattern Uniswap/ENS use — "Transaction submitted".

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

  // Dry-run for gas estimation (best-effort)
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
    if (d.gas_required) {
      // Add 50% buffer to both ref_time and proof_size.
      // pallet-revive dry-runs underestimate gas on live chains
      // due to state trie changes between dry-run and inclusion.
      gasLimit = {
        ref_time: (d.gas_required.ref_time * 150n) / 100n,
        proof_size: (d.gas_required.proof_size * 150n) / 100n,
      };
    }
    if (d.storage_deposit?.value) storageDeposit = d.storage_deposit.value;
  } catch {
    // Use defaults
  }

  // Retry logic: if tx fails with BadProof or similar dispatch errors,
  // re-estimate gas and retry once automatically.
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Re-estimate gas on retry
    if (attempt > 1) {
      try {
        const retryDryRun = await typedApi.apis.ReviveApi.call(
          connection.address,
          Binary.fromHex(contractAddress),
          value,
          undefined,
          undefined,
          Binary.fromHex(data)
        );
        const rd = retryDryRun as any;
        if (rd.gas_required) {
          // Use 2x buffer on retry for maximum safety
          gasLimit = {
            ref_time: rd.gas_required.ref_time * 2n,
            proof_size: rd.gas_required.proof_size * 2n,
          };
        }
        if (rd.storage_deposit?.value) storageDeposit = rd.storage_deposit.value;
      } catch {
        // Use previous estimates
      }
    }

    const tx = typedApi.tx.Revive.call({
      dest: Binary.fromHex(contractAddress),
      value,
      gas_limit: gasLimit,
      storage_deposit_limit: storageDeposit,
      data: Binary.fromHex(data),
    });

    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Transaction signing timed out. Please try again.'));
          }
        }, 30_000);

        tx.signSubmitAndWatch(connection.signer.polkadotSigner, {
          at: 'best' as const,
        }).subscribe({
          next(ev: any) {
            if (settled) return;

            if (ev.type === 'broadcasted') {
              settled = true;
              clearTimeout(timeout);
              resolve(ev.txHash);
              return;
            }

            if (ev.type === 'txBestBlocksState' && ev.found) {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                if (!ev.ok && ev.dispatchError) {
                  const errType = ev.dispatchError?.type ?? 'Unknown';
                  reject(new Error(`Transaction reverted: ${errType}`));
                  return;
                }
                resolve(ev.txHash);
              }
              return;
            }

            if (ev.type === 'finalized') {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                if (!ev.ok && ev.dispatchError) {
                  reject(new Error(`Transaction reverted: ${ev.dispatchError?.type ?? 'Unknown'}`));
                  return;
                }
                resolve(ev.txHash);
              }
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

      return txHash;
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

      // On retriable errors (BadProof, gas-related), retry if we have attempts left
      const isRetriable = msg.includes('BadProof') || msg.includes('OutOfGas') || msg.includes('reverted');
      if (isRetriable && attempt < maxAttempts) {
        // Small delay before retry
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      throw new Error(`Transaction failed: ${msg}`);
    }
  }

  throw new Error('Transaction failed after retry');
}

// ─── Transfer path ───────────────────────────────────────────────────

export async function sendTransfer(
  toEvmAddress: string,
  amount: bigint,
  _signerAddress: string
): Promise<string> {
  const connection = getCurrentConnection();
  if (!connection) throw new Error('Wallet not connected');

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

  const typedApi = getTypedApi();

  let gasLimit = { ref_time: 1_000_000_000n, proof_size: 100_000n };
  let storageDeposit = 0n;

  try {
    const dryRun = await typedApi.apis.ReviveApi.call(
      connection.address,
      Binary.fromHex(toEvmAddress),
      amount,
      undefined,
      undefined,
      Binary.fromHex('0x')
    );
    const d = dryRun as any;
    if (d.gas_required) {
      gasLimit = {
        ref_time: (d.gas_required.ref_time * 150n) / 100n,
        proof_size: (d.gas_required.proof_size * 150n) / 100n,
      };
    }
    if (d.storage_deposit?.value) storageDeposit = d.storage_deposit.value;
  } catch {
  }

  const tx = typedApi.tx.Revive.call({
    dest: Binary.fromHex(toEvmAddress),
    value: amount,
    gas_limit: gasLimit,
    storage_deposit_limit: storageDeposit,
    data: Binary.fromHex('0x'),
  });

  try {
    const txHash = await new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Transfer signing timed out.'));
        }
      }, 30_000);

      tx.signSubmitAndWatch(connection.signer.polkadotSigner, {
        at: 'best' as const,
      }).subscribe({
        next(ev: any) {
          if (settled) return;

          if (ev.type === 'broadcasted') {
            settled = true;
            clearTimeout(timeout);
            resolve(ev.txHash);
            return;
          }

          if ((ev.type === 'txBestBlocksState' && ev.found) || ev.type === 'finalized') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              if (!ev.ok && ev.dispatchError) {
                reject(new Error(`Transfer reverted: ${ev.dispatchError?.type ?? 'Unknown'}`));
                return;
              }
              resolve(ev.txHash);
            }
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

    return txHash;
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('Cancelled') || msg.includes('Rejected')) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Transfer failed: ${msg}`);
  }
}
