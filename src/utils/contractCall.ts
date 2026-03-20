import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { Binary } from 'polkadot-api';
import { getTypedApi } from './papiClient';
import { getCurrentConnection } from './wallet';
import { ensureAccountMapped } from './accountMapping';

export async function callContract<T = any>(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args });
  const typedApi = getTypedApi();

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  if (import.meta.env.DEV) console.log(`[QF] Reading ${functionName} via PAPI ReviveApi.call...`);

  const callResult = await typedApi.apis.ReviveApi.call(
    ZERO_ADDRESS,
    Binary.fromHex(contractAddress),
    0n,
    undefined,
    undefined,
    Binary.fromHex(data)
  );

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
    connection.evmAddress,
    Binary.fromHex(contractAddress),
    value,
    undefined,
    undefined,
    Binary.fromHex(data)
  );

  const gasLimit = (dryRun as any).gas_required ?? { ref_time: 50000000000n, proof_size: 500000n };
  const storageDeposit = (dryRun as any).storage_deposit?.value ?? 0n;

  const result = await typedApi.tx.Revive.call({
    dest: contractAddress as any,
    value,
    gas_limit: gasLimit,
    storage_deposit_limit: storageDeposit,
    data: Binary.fromHex(data),
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
