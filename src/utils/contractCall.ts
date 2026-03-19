import { encodeFunctionData, decodeFunctionResult, type Abi } from 'viem';
import { getTypedApi } from './papiClient';
import { ensureAccountMapped } from './accountMapping';
import { getCurrentConnection } from './wallet';

const ETH_RPC_URL = import.meta.env.VITE_ETH_RPC_URL || '/eth-rpc';

export async function _fetchJsonRpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(ETH_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });
  
  const json = await response.json() as { result?: unknown; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  return json.result;
}

export async function callContract<T = unknown>(
  contractAddress: string,
  abi: Abi,
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  const calldata = encodeFunctionData({ abi, functionName, args });

  if (import.meta.env.DEV) console.log(`[QF] Reading ${functionName} via ETH RPC...`);

  const ETH_RPC_URL = import.meta.env.VITE_ETH_RPC_URL;

  if (!ETH_RPC_URL) {
    throw new Error('ETH RPC URL not configured');
  }

  const response = await fetch(ETH_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_call',
      params: [{ to: contractAddress, data: calldata }, 'latest'],
    }),
  });
  const json = await response.json() as { result?: string; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  if (!json.result) {
    throw new Error('No result from eth_call');
  }
  
  const decoded = decodeFunctionResult({ abi, functionName, data: json.result as `0x${string}` });
  if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via eth-rpc:`, decoded);
  return decoded as T;
}

export async function writeContract(
  contractAddress: string,
  abi: Abi,
  functionName: string,
  args: unknown[],
  signer: unknown,
  value: bigint = 0n
): Promise<string> {
  const signerAddress = typeof signer === 'string' ? signer : ((signer as { address?: string })?.address || '');
  
  const valueBigIntIncoming = BigInt(value?.toString() || '0');
  if (import.meta.env.DEV) console.log('[QF] writeContract ENTERED:', { 
    contractAddress, 
    functionName, 
    args, 
    signerAddress, 
    valueRaw: value?.toString(),
    valueInWei: valueBigIntIncoming.toString(),
    valueInQF: (valueBigIntIncoming / BigInt(10**18)).toString()
  });
  
  if (import.meta.env.DEV) console.log('[QF] Step 0: Ensuring account is mapped...');
  try {
    await ensureAccountMapped(signerAddress);
    if (import.meta.env.DEV) console.log('[QF] Step 0 complete: account mapping verified');
  } catch (mappingErr) {
    console.error('[QF] Step 0 FAILED: ensureAccountMapped threw:', (mappingErr as Error).message);
    if ((mappingErr as Error).message?.includes('Inability to pay') || (mappingErr as Error).message?.includes('balance too low')) {
      throw new Error('Insufficient QF balance. You need QF tokens to pay transaction fees.');
    }
    throw mappingErr;
  }
  
  if (import.meta.env.DEV) console.log('[QF] Step 0.5: Checking balance...');
  try {
    const api = getTypedApi();
    const balance = await api.query.System.Account.getValue(signerAddress);
    const free = balance?.data?.free ? BigInt(balance.data.free.toString()) : 0n;
    if (free < 1000000000000000n) {
      throw new Error('Insufficient QF balance. You need QF tokens to pay transaction fees.');
    }
    if (import.meta.env.DEV) console.log('[QF] Step 0.5 complete: sufficient balance');
  } catch (balanceErr) {
    if ((balanceErr as Error).message?.includes('Insufficient QF balance')) {
      throw balanceErr;
    }
    console.warn('[QF] Step 0.5: Could not check balance, continuing...');
  }

  if (import.meta.env.DEV) console.log('[QF] Step 1: Getting API...');
  try {
    getTypedApi();
    if (import.meta.env.DEV) console.log('[QF] Step 1 complete: API obtained');
  } catch (apiErr) {
    console.error('[QF] Step 1 FAILED: getApi threw:', (apiErr as Error).message);
    throw apiErr;
  }
  if (import.meta.env.DEV) console.log('[QF] Step 2: Encoding function data...');
  let calldata;
  try {
    calldata = encodeFunctionData({ abi, functionName, args });
    if (import.meta.env.DEV) console.log('[QF] Step 2 complete: calldata encoded');
  } catch (encodeErr) {
    console.error('[QF] Step 2 FAILED: encodeFunctionData threw:', (encodeErr as Error).message);
    throw encodeErr;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 3: Calculating gas limit...');
  let gasLimit: { refTime: bigint; proofSize: bigint };
  try {
    const api = getTypedApi();
    const blockWeights = (api.constants.System as any).BlockWeights() as {
      perClass?: {
        normal?: {
          maxExtrinsic?: {
            unwrap?: () => {
              refTime: { toBigInt: () => bigint };
              proofSize: { toBigInt: () => bigint };
            };
          };
        };
      };
    };
    const maxExtrinsic = blockWeights?.perClass?.normal?.maxExtrinsic?.unwrap?.();
    
    if (maxExtrinsic) {
      gasLimit = {
        refTime: maxExtrinsic.refTime.toBigInt() * 50n / 100n,
        proofSize: maxExtrinsic.proofSize.toBigInt() * 50n / 100n,
      };
    } else {
      throw new Error('Block weights not available');
    }
    if (import.meta.env.DEV) console.log('[QF] Step 3 complete: gasLimit set');
  } catch {
    console.warn('[QF] Failed to get block weights, using fallback gas limit');
    gasLimit = {
      refTime: 50000000000n,
      proofSize: 500000n,
    };
  }

  if (import.meta.env.DEV) console.log('[QF] Step 4: Calculating storage deposit limit...');
  let storageDepositLimit: bigint;
  try {
    const api = getTypedApi();
    const accountInfo = await api.query.System.Account.getValue(signerAddress);
    const freeBalance = accountInfo?.data?.free;
    if (freeBalance) {
      storageDepositLimit = BigInt(freeBalance.toString()) / 20n;
    } else {
      storageDepositLimit = 1000000000000000000n;
    }
    if (import.meta.env.DEV) console.log('[QF] Step 4 complete: storageDepositLimit =', storageDepositLimit.toString());
  } catch {
    console.warn('[QF] Failed to get balance for storage deposit, using default');
    storageDepositLimit = 1000000000000000000n;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 5: Creating transaction...');
  
  const valueBigInt = BigInt(value?.toString() || '0');
  
  if (import.meta.env.DEV) {
    console.log('=== VALUE DEBUG ===');
    console.log('revive.call value (raw string):', value?.toString());
    console.log('revive.call value (raw bigint):', valueBigInt.toString());
    console.log('revive.call value (QF, assuming 18 decimals):', (valueBigInt / BigInt(10**18)).toString());
    console.log('===================');
  }
  
  if (valueBigInt > 0n) {
    if (import.meta.env.DEV) console.log('[QF] IMPORTANT: Attempting to send', (Number(valueBigInt) / 1e18).toString(), 'QF as msg.value');
  }
  
  if (import.meta.env.DEV) console.log('[QF] revive.call params:', {
    dest: contractAddress,
    valueBigInt: valueBigInt.toString(),
    gasLimit: gasLimit,
    storageDepositLimit: storageDepositLimit?.toString(),
    dataLength: calldata.length,
    signerAddress
  });
  
  let tx;
  try {
    const api = getTypedApi();
    tx = (api.tx.Revive as any).call(
      contractAddress,
      valueBigInt,
      gasLimit,
      storageDepositLimit,
      calldata
    );
    if (import.meta.env.DEV) console.log('[QF] Step 5 complete: transaction created');
  } catch (txCreateErr) {
    console.error('[QF] Step 5 FAILED: api.tx.Revive.call threw:', (txCreateErr as Error).message);
    throw txCreateErr;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 6: Getting signer...');
  const connection = getCurrentConnection();
  if (!connection) {
    throw new Error('No wallet connected');
  }
  if (import.meta.env.DEV) console.log('[QF] Step 6 complete: signer obtained');

  if (import.meta.env.DEV) console.log('[QF] Step 7: Signing and submitting...');
  if (import.meta.env.DEV) console.log('[QF] Transaction object created, entering Promise...');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transaction timed out after 120 seconds. The transaction may still be processing.'));
    }, 120000);

    const signAndSubmit = (tx as any).signAndSubmit(connection.signer.polkadotSigner);

    signAndSubmit.then((result: { block?: { hash?: string } }) => {
      if (import.meta.env.DEV) console.log(`[QF] ${functionName} finalized in block ${result.block?.hash}`);
      resolve(result.block?.hash || '');
    }).catch((error: unknown) => {
      clearTimeout(timeout);
      console.error('[QF] Transaction failed:', error);
      reject(error);
    });
  });
}

export async function sendTransfer(
  toAddress: string,
  amount: bigint,
  _signerAddress: string
): Promise<string> {
  const api = getTypedApi();

  const tx = (api.tx.Balances as any).transfer_keep_alive(toAddress, amount);

  const connection = getCurrentConnection();
  if (!connection) {
    throw new Error('No wallet connected');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transfer timed out after 120 seconds. The transaction may still be processing.'));
    }, 120000);

    const signAndSubmit = (tx as any).signAndSubmit(connection.signer.polkadotSigner);

    signAndSubmit.then((result: { block?: { hash?: string } }) => {
      if (import.meta.env.DEV) console.log(`[QF] Transfer finalized in block ${result.block?.hash}`);
      resolve(result.block?.hash || '');
    }).catch((error: unknown) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
