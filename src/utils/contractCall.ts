import { ethers } from 'ethers';
import { getApi } from './wallet';
import { ensureAccountMapped } from './accountMapping';

const ETH_RPC_URL = import.meta.env.VITE_ETH_RPC_URL || '/eth-rpc';

/** Kept for potential future use — not called by callContract */
export async function _fetchJsonRpc(method: string, params: any[]): Promise<any> {
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
  
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  return json.result;
}

export async function callContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const iface = new ethers.Interface(abi);
  const calldata = iface.encodeFunctionData(functionName, args);

  if (import.meta.env.DEV) console.log(`[QF] Reading ${functionName} via Substrate dry-run...`);

  const ETH_RPC_URL = import.meta.env.VITE_ETH_RPC_URL;

  if (ETH_RPC_URL) {
    try {
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
      const json = await response.json();
      if (!json.error && json.result) {
        const decoded = iface.decodeFunctionResult(functionName, json.result);
        let result;
        if (decoded.length === 0) result = undefined;
        else if (decoded.length === 1) {
          const val = decoded[0];
          result = (val && typeof val === 'object' && typeof val.toArray === 'function') ? val.toArray() : val;
        } else result = Array.from(decoded);
        if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via eth-rpc:`, result);
        return result as T;
      }
      if (import.meta.env.DEV) console.log(`[QF] eth-rpc failed for ${functionName}, falling back to Substrate dry-run`);
    } catch {
      if (import.meta.env.DEV) console.log(`[QF] eth-rpc unreachable, falling back to Substrate dry-run`);
    }
  }

  const { getApi } = await import('./wallet');
  const api = await getApi();

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const value = 0;
  const gasLimit = { refTime: 50000000000n, proofSize: 500000n };
  const storageDepositLimit = null;

  let resultHex: string;

  if (api.call.reviveApi && api.call.reviveApi.call) {
    try {
      const callResult = await (api.call.reviveApi.call as any)(
        ZERO_ADDRESS,
        contractAddress,
        value,
        gasLimit.refTime,
        gasLimit.proofSize,
        storageDepositLimit,
        calldata
      );
      const output = (callResult as any)?.result?.Ok?.data || (callResult as any)?.result?.data || (callResult as any)?.data || callResult;
      if (output) {
        resultHex = typeof output === 'string' ? output : output.toHex ? output.toHex() : '0x' + Buffer.from(output).toString('hex');
      } else {
        throw new Error('Empty result from reviveApi.call');
      }
      if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via reviveApi.call`);
    } catch (e: any) {
      if (import.meta.env.DEV) console.log('[QF] reviveApi.call failed:', e.message);
      throw e;
    }
  } else if (api.call.reviveApi && api.call.reviveApi.ethCall) {
    try {
      const ethCallResult = await (api.call.reviveApi.ethCall as any)(
        ZERO_ADDRESS,
        contractAddress,
        calldata,
        value,
        gasLimit.refTime,
        gasLimit.proofSize,
      );
      const output = ethCallResult?.Ok || ethCallResult?.data || ethCallResult;
      resultHex = typeof output === 'string' ? output : output.toHex ? output.toHex() : '0x';
      if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via reviveApi.ethCall`);
    } catch (e: any) {
      if (import.meta.env.DEV) console.log('[QF] reviveApi.ethCall failed:', e.message);
      throw e;
    }
  } else {
    try {
      const encoded = api.createType('(H160, H160, U256, u64, u64, Option<U256>, Bytes)', [
        ZERO_ADDRESS,
        contractAddress,
        value,
        gasLimit.refTime,
        gasLimit.proofSize,
        storageDepositLimit,
        calldata
      ]);
      const raw = await api.rpc.state.call('ReviveApi_call', encoded.toHex());
      resultHex = raw.toHex();
      if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via state.call`);
    } catch (e: any) {
      if (import.meta.env.DEV) console.log('[QF] state.call failed:', e.message);
      throw new Error(`All read methods failed for ${functionName}: ${e.message}`);
    }
  }

  const decoded = iface.decodeFunctionResult(functionName, resultHex);
  let result;
  if (decoded.length === 0) result = undefined;
  else if (decoded.length === 1) {
    const val = decoded[0];
    result = (val && typeof val === 'object' && typeof val.toArray === 'function') ? val.toArray() : val;
  } else result = Array.from(decoded);

  if (import.meta.env.DEV) console.log(`[QF] Read ${functionName} via Substrate:`, result);
  return result as T;
}

export async function writeContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  signer: any,
  value: bigint = 0n
): Promise<string> {
  const signerAddress = typeof signer === 'string' ? signer : (signer?.address || signer);
  
  // DEBUG: Log incoming value parameter
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
  
  // Ensure account is mapped before any contract interaction
  if (import.meta.env.DEV) console.log('[QF] Step 0: Ensuring account is mapped...');
  try {
    await ensureAccountMapped(signerAddress);
    if (import.meta.env.DEV) console.log('[QF] Step 0 complete: account mapping verified');
  } catch (mappingErr: any) {
    console.error('[QF] Step 0 FAILED: ensureAccountMapped threw:', mappingErr?.message);
    if (mappingErr.message?.includes('Inability to pay') || mappingErr.message?.includes('balance too low')) {
      throw new Error('Insufficient QF balance. You need QF tokens to pay transaction fees.');
    }
    throw mappingErr;
  }
  
  // Check balance before proceeding
  if (import.meta.env.DEV) console.log('[QF] Step 0.5: Checking balance...');
  try {
    const api = await getApi();
    const balance = await api.query.system.account(signerAddress) as any;
    const free = balance?.data?.free?.toBigInt() || 0n;
    if (free < 1000000000000000n) { // ~0.001 QF minimum for fees
      throw new Error('Insufficient QF balance. You need QF tokens to pay transaction fees.');
    }
    if (import.meta.env.DEV) console.log('[QF] Step 0.5 complete: sufficient balance');
  } catch (balanceErr: any) {
    if (balanceErr.message?.includes('Insufficient QF balance')) {
      throw balanceErr;
    }
    console.warn('[QF] Step 0.5: Could not check balance, continuing...');
  }

  if (import.meta.env.DEV) console.log('[QF] Step 1: Getting API...');
  let api;
  try {
    api = await getApi();
    if (import.meta.env.DEV) console.log('[QF] Step 1 complete: API obtained');
  } catch (apiErr: any) {
    console.error('[QF] Step 1 FAILED: getApi threw:', apiErr?.message);
    throw apiErr;
  }
  if (import.meta.env.DEV) console.log('[QF] Step 2: Encoding function data...');
  let iface, calldata;
  try {
    iface = new ethers.Interface(abi);
    calldata = iface.encodeFunctionData(functionName, args);
    if (import.meta.env.DEV) console.log('[QF] Step 2 complete: calldata encoded');
  } catch (encodeErr: any) {
    console.error('[QF] Step 2 FAILED: encodeFunctionData threw:', encodeErr?.message);
    throw encodeErr;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 3: Calculating gas limit...');
  let gasLimit;
  try {
    const blockWeights = (api.consts.system as any).blockWeights;
    const maxExtrinsic = blockWeights?.perClass?.normal?.maxExtrinsic?.unwrap?.();
    
    if (maxExtrinsic) {
      gasLimit = api.registry.createType('Weight', {
        refTime: maxExtrinsic.refTime.toBigInt() * 50n / 100n,
        proofSize: maxExtrinsic.proofSize.toBigInt() * 50n / 100n,
      });
    } else {
      throw new Error('Block weights not available');
    }
    if (import.meta.env.DEV) console.log('[QF] Step 3 complete: gasLimit set');
  } catch (e) {
    console.warn('[QF] Failed to get block weights, using fallback gas limit');
    gasLimit = api.registry.createType('Weight', {
      refTime: 50000000000n,
      proofSize: 500000n,
    });
  }

  if (import.meta.env.DEV) console.log('[QF] Step 4: Calculating storage deposit limit...');
  let storageDepositLimit: bigint;
  try {
    const accountInfo = await api.query.system.account(signerAddress) as any;
    const freeBalance = accountInfo?.data?.free;
    if (freeBalance) {
      storageDepositLimit = freeBalance.toBigInt() / 20n;
    } else {
      storageDepositLimit = 1000000000000000000n;
    }
    if (import.meta.env.DEV) console.log('[QF] Step 4 complete: storageDepositLimit =', storageDepositLimit.toString());
  } catch (e) {
    console.warn('[QF] Failed to get balance for storage deposit, using default');
    storageDepositLimit = 1000000000000000000n;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 5: Creating transaction...');
  
  // DEBUG: Check chain decimals - crucial for unit conversion
  const chainDecimals = api.registry.chainDecimals?.[0] || 18;
  if (import.meta.env.DEV) {
    console.log('[QF] Chain decimals (Substrate):', chainDecimals);
    console.log('[QF] api.registry.chainDecimals:', api.registry.chainDecimals);
  }
  
  // Ensure value is a proper bigint
  const valueBigInt = BigInt(value?.toString() || '0');
  
  // DEBUG: Log value in multiple formats
  if (import.meta.env.DEV) {
    console.log('=== VALUE DEBUG ===');
    console.log('revive.call value (raw string):', value?.toString());
    console.log('revive.call value (raw bigint):', valueBigInt.toString());
    console.log('revive.call value (QF, assuming 18 decimals):', (valueBigInt / BigInt(10**18)).toString());
    console.log('revive.call value (Planck, if chain decimals =', chainDecimals, '):', (valueBigInt / BigInt(10**chainDecimals)).toString());
    console.log('===================');
  }
  
  if (valueBigInt > 0n) {
    if (import.meta.env.DEV) console.log('[QF] IMPORTANT: Attempting to send', (Number(valueBigInt) / 1e18).toString(), 'QF as msg.value');
  }
  
  if (import.meta.env.DEV) console.log('[QF] revive.call params:', {
    dest: contractAddress,
    valueBigInt: valueBigInt.toString(),
    gasLimit: gasLimit.toJSON(),
    storageDepositLimit: storageDepositLimit?.toString(),
    dataLength: calldata.length,
    signerAddress
  });
  
  let tx;
  try {
    tx = api.tx.revive.call(
      contractAddress,
      valueBigInt,
      gasLimit,
      storageDepositLimit,
      calldata
    );
    if (import.meta.env.DEV) console.log('[QF] Step 5 complete: transaction created');
  } catch (txCreateErr: any) {
    console.error('[QF] Step 5 FAILED: api.tx.revive.call threw:', txCreateErr?.message);
    throw txCreateErr;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 6: Loading web3FromAddress...');
  let injector;
  try {
    const { web3Enable, web3FromAddress } = await import('@polkadot/extension-dapp');
    if (import.meta.env.DEV) console.log('[QF] web3Enable and web3FromAddress imported, calling web3Enable...');
    await web3Enable('QNS');
    if (import.meta.env.DEV) console.log('[QF] web3Enable complete, calling web3FromAddress with:', signerAddress);
    injector = await web3FromAddress(signerAddress);
    if (import.meta.env.DEV) console.log('[QF] Step 6 complete: injector obtained');
  } catch (web3Err: any) {
    console.error('[QF] Step 6 FAILED: web3FromAddress threw:', web3Err?.message);
    throw web3Err;
  }

  if (import.meta.env.DEV) console.log('[QF] Step 7: Starting signAndSend...');
  if (import.meta.env.DEV) console.log('[QF] Transaction object created, entering Promise...');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transaction timed out after 120 seconds. The transaction may still be processing.'));
    }, 120000);

    if (import.meta.env.DEV) console.log('[QF] Inside Promise, calling tx.signAndSend...');
    tx.signAndSend(
      signerAddress,
      { signer: injector.signer, withSignedTransaction: false },
      ({ status, dispatchError }: any) => {
        if (import.meta.env.DEV) console.log('[QF] signAndSend callback fired, status:', status?.type, status?.hash?.toHex?.());
        if (dispatchError) {
          clearTimeout(timeout);
          console.error('[QF] dispatchError:', dispatchError);
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          return;
        }
        if (status.isFinalized) {
          clearTimeout(timeout);
          if (import.meta.env.DEV) console.log(`[QF] ${functionName} finalized in block ${status.asFinalized.toHex()}`);
          resolve(status.asFinalized.toHex());
        }
      }
    ).catch((error: any) => {
      clearTimeout(timeout);
      console.error('[QF] signAndSend().catch() fired:', error?.message);
      reject(new Error(`Transaction failed: ${error.message}`));
    });
  });
}

export async function sendTransfer(
  toAddress: string,
  amount: bigint,
  signerAddress: string
): Promise<string> {
  const api = await getApi();

  const tx = api.tx.balances.transferKeepAlive(toAddress, amount);

  const { web3FromAddress } = await import('@polkadot/extension-dapp');
  const injector = await web3FromAddress(signerAddress);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transfer timed out after 120 seconds. The transaction may still be processing.'));
    }, 120000);

    tx.signAndSend(
      signerAddress,
      { signer: injector.signer, withSignedTransaction: false },
      ({ status, dispatchError }: any) => {
        if (dispatchError) {
          clearTimeout(timeout);
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          return;
        }
        if (status.isFinalized) {
          clearTimeout(timeout);
          if (import.meta.env.DEV) console.log(`[QF] Transfer finalized in block ${status.asFinalized.toHex()}`);
          resolve(status.asFinalized.toHex());
        }
      }
    ).catch((error: any) => {
      clearTimeout(timeout);
      reject(new Error(`Transfer failed: ${error.message}`));
    });
  });
}
