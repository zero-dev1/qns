import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { Binary } from 'polkadot-api';
import { getTypedApi } from './papiClient';
import { getCurrentConnection } from './wallet';
import { ensureAccountMapped } from './accountMapping';

// For read-only calls, we need a mapped origin. The deployer is always mapped.
const DEPLOYER_SS58 = "5FbmtGERRp4MhuwojmA2XGWghZ7XSNBLCUKQCrTVRz8bVGrU";

export async function callContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();


  const callResult = await typedApi.apis.ReviveApi.call(
    DEPLOYER_SS58,                     // origin: SS58 string (PAPI decodes to AccountId32)
    Binary.fromHex(contractAddress),   // dest: H160
    0n,                                // value
    undefined,                         // gas_limit (None = runtime decides)
    undefined,                         // storage_deposit_limit (None)
    Binary.fromHex(data)               // input_data
  );


  // Extract return data from the result
  // The result shape is: { gas_consumed, gas_required, storage_deposit, result: { success: bool, value?: { flags, data } }, debug_message }
  // On success: result.success === true, data is in result.value.data
  // On failure: result.success === false
  
  const inner = callResult.result;
  
  // PAPI may represent this as a tagged union or as a plain object
  // Try multiple accessor patterns defensively
  let returnBytes: Uint8Array | string | null = null;

  // Pattern 1: PAPI codec result with .success boolean
  if (inner && typeof inner === 'object' && 'success' in inner) {
    if (inner.success && inner.value?.data) {
      const data = inner.value.data;
      if (data instanceof Uint8Array) {
        returnBytes = data;
      } else if (data && typeof (data as any).asBytes === 'function') {
        returnBytes = (data as any).asBytes();
      } else if (data && typeof (data as any).asHex === 'function') {
        returnBytes = (data as any).asHex();
      } else {
        returnBytes = data as any;
      }
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


  const decoded = decodeFunctionResult({ abi, functionName, data: hex });
  return decoded as T;
}

export async function writeContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  _signer: any,
  value: bigint = 0n
): Promise<string> {
  // Step 1: Check wallet connection
  const connection = getCurrentConnection();
  if (!connection) {
    throw new Error('Wallet not connected. Please disconnect and reconnect your wallet.');
  }

  // Before the dry-run, ensure the account is mapped
  try {
    await ensureAccountMapped(connection.address);
  } catch (mapErr) {
    throw new Error('Account mapping failed. Please disconnect and reconnect your wallet.');
  }

  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  // Step 3: Dry-run to estimate gas
  let dryRun;
  try {
    dryRun = await typedApi.apis.ReviveApi.call(
      connection.address,
      Binary.fromHex(contractAddress),
      value,
      undefined,
      undefined,
      Binary.fromHex(data)
    );
  } catch (dryRunErr: any) {
    throw new Error(`Dry-run failed for ${functionName}: ${dryRunErr.message}`);
  }

  // Note: dry-run may report failure for payable functions because msg.value 
  // simulation can be unreliable. We still use gas_required from the dry-run
  // but don't block on success/failure — let the real transaction decide.

  const gasLimit = (dryRun as any).gas_required ?? { ref_time: 50000000000n, proof_size: 5000000n };
  const storageDeposit = (dryRun as any).storage_deposit?.value ?? 0n;

  // Step 4: Sign and submit
  try {
    const result = await typedApi.tx.Revive.call({
      dest: Binary.fromHex(contractAddress),
      value,
      gas_limit: gasLimit,
      storage_deposit_limit: storageDeposit,
      data: Binary.fromHex(data),
    }).signAndSubmit(connection.signer.polkadotSigner);

    return result.block.hash;
  } catch (signErr: any) {
    // User rejected in wallet extension
    if (signErr.message?.includes('Cancelled') || signErr.message?.includes('Rejected')) {
      throw new Error('Transaction rejected by user');
    }
    throw new Error(`Transaction failed: ${signErr.message}`);
  }
}

export async function sendTransfer(
  toAddress: string,
  amount: bigint,
  _signerAddress: string
): Promise<string> {
  const connection = getCurrentConnection();
  if (!connection) throw new Error('Wallet not connected');

  const typedApi = getTypedApi();

  const result = await typedApi.tx.Balances.transfer_keep_alive({
    dest: { type: 'Id', value: toAddress } as any,
    value: amount,
  }).signAndSubmit(connection.signer.polkadotSigner);

  return result.block.hash;
}
