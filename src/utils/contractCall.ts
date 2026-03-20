import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { Binary } from 'polkadot-api';
import { getTypedApi } from './papiClient';
import { getCurrentConnection } from './wallet';
import { ensureAccountMapped } from './accountMapping';

// Dummy origin for read-only ReviveApi.call
// Any 20-byte H160 + twelve 0xEE bytes is auto-recognized as eth-derived (no mapping needed)
const READ_ORIGIN_HEX = "0x0101010101010101010101010101010101010101eeeeeeeeeeeeeeeeeeeeeeee";

async function doCall(
  typedApi: ReturnType<typeof getTypedApi>,
  contractAddress: string,
  data: string,
  origin: string = READ_ORIGIN_HEX
) {
  return typedApi.apis.ReviveApi.call(
    origin,                          // origin: eth-derived AccountId (raw hex)
    Binary.fromHex(contractAddress), // dest: H160 as FixedSizeBinary<20>
    0n,                             // value: bigint
    undefined,                      // gas_limit: undefined = let runtime decide  
    undefined,                      // storage_deposit_limit
    Binary.fromHex(data)            // input_data: Binary (will be encoded as Vec<u8>)
  );
}

export async function callContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  if (import.meta.env.DEV) console.log(`[QF] Reading ${functionName} via PAPI ReviveApi.call...`);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let callResult;
    try {
      callResult = await doCall(typedApi, contractAddress, data);
    } catch (networkErr: any) {
      console.error("[QF] doCall NETWORK error:", networkErr.message);
      throw networkErr;
    }

    console.log("[QF] RAW callResult:", JSON.stringify(callResult, (_, v) => {
      if (typeof v === "bigint") return "BIGINT:" + v.toString();
      if (v instanceof Uint8Array) return "BYTES:" + Array.from(v).map(b => b.toString(16).padStart(2, '0')).join('');
      return v;
    }, 2));

    try {
      const output = callResult.result?.success
        ? callResult.result.value.data
        : null;

      if (!output) {
        const altOutput = (callResult as any)?.result?.Ok?.data
          || (callResult as any)?.result?.value?.data
          || (callResult as any)?.data;
        if (!altOutput) {
          throw new Error(`Contract read failed for ${functionName}`);
        }
        return decodeResult(abi, functionName, altOutput);
      }

      return decodeResult(abi, functionName, output);
    } catch (err: any) {
      // This is a parsing error, retry
      lastError = err;
      if (attempt < 3) {
        if (import.meta.env.DEV) console.log(`[QF] ${functionName} attempt ${attempt} failed, retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(`Contract read failed for ${functionName} after 3 attempts: ${lastError?.message || 'Unknown error'}`);
}

function decodeResult<T>(abi: any[], functionName: string, output: any): T {
  const hex = output instanceof Uint8Array
    ? Binary.fromBytes(output).asHex()
    : typeof output === 'string'
      ? output
      : output?.asHex?.() ?? '0x';

  return decodeFunctionResult({ abi, functionName, data: hex as `0x${string}` }) as T;
}

export async function writeContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  _signer: any,
  value: bigint = 0n
): Promise<string> {
  const connection = getCurrentConnection();
  if (!connection) throw new Error('Wallet not connected');

  await ensureAccountMapped(connection.address);

  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  if (import.meta.env.DEV) {
    console.log(`[QF] Writing ${functionName} via PAPI tx.Revive.call...`);
    console.log(`[QF] Value: ${value.toString()} (${Number(value) / 1e18} QF)`);
  }

  const dryRun = await typedApi.apis.ReviveApi.call(
    connection.address,              // SS58 address of connected wallet
    Binary.fromHex(contractAddress), // H160 as FixedSizeBinary<20>
    value,
    undefined,
    undefined,
    Binary.fromHex(data)
  );

  const gasLimit = (dryRun as any).gas_required ?? { ref_time: 50000000000n, proof_size: 500000n };
  const storageDeposit = (dryRun as any).storage_deposit?.value ?? 0n;

  const result = await typedApi.tx.Revive.call({
    dest: Binary.fromHex(contractAddress), // H160 as FixedSizeBinary<20>
    value,
    gas_limit: gasLimit,
    storage_deposit_limit: storageDeposit,
    data: Binary.fromHex(data),      // Binary from hex calldata
  }).signAndSubmit(connection.signer.polkadotSigner);

  if (import.meta.env.DEV) console.log(`[QF] ${functionName} submitted, block: ${result.block.hash}`);

  return result.block.hash;
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
