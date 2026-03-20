import { getInjectedExtensions, connectInjectedExtension } from "polkadot-api/pjs-signer";
import type { InjectedExtension, InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import { keccak256 } from "viem";
import { getSs58AddressInfo } from "polkadot-api";
import { getTypedApi as getApi } from "./papiClient";

export { getApi };

export const WALLET_MODE: "substrate" | "evm" | "both" = "substrate";

export interface WalletConnection {
  address: string;
  evmAddress: string;
  name?: string;
  walletName: string;
  signer: InjectedPolkadotAccount;
  extension: InjectedExtension;
}

export function deriveEVMAddress(ss58Address: string): string {
  const info = getSs58AddressInfo(ss58Address);
  if (!info.isValid) throw new Error('Invalid SS58 address');
  // Convert the 32-byte public key to a hex string
  const pubKeyHex = '0x' + Array.from(info.publicKey).map(b => b.toString(16).padStart(2, '0')).join('');
  // Keccak-256 hash of the raw public key bytes, take last 20 bytes
  const hash = keccak256(pubKeyHex as `0x${string}`);
  return '0x' + hash.slice(-40);
}



export async function getOnChainEvmAddress(ss58Address: string): Promise<string> {
  const typedApi = getApi();
  // ReviveApi.address maps AccountId32 → H160
  const result = await typedApi.apis.ReviveApi.address(ss58Address);
  // result is a Binary (FixedSizeBinary<20>)
  const hex = result instanceof Uint8Array 
    ? '0x' + Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('')
    : typeof result === 'string' 
      ? result 
      : result?.asHex?.() ?? '';
  return hex.toLowerCase();
}

let currentConnection: WalletConnection | null = null;

export function getAvailableWallets(): string[] {
  return getInjectedExtensions();
}

export async function connectSubstrateWallet(
  walletName: string
): Promise<WalletConnection> {
  const extension = await connectInjectedExtension(walletName);
  const accounts = extension.getAccounts();

  if (accounts.length === 0) {
    extension.disconnect();
    throw new Error(`No accounts found in ${walletName}. Please create or import an account.`);
  }

  const account = accounts[0];
  
  // Use correct SS58 → EVM derivation (last 20 bytes of public key)
  let evmAddress: string;
  try {
    evmAddress = deriveEVMAddress(account.address);
  } catch (error) {
    try {
      evmAddress = await getOnChainEvmAddress(account.address);
    } catch {
      throw new Error('Could not derive EVM address for account. Please ensure your account is properly set up.');
    }
  }

  currentConnection = {
    address: account.address,
    evmAddress,
    name: account.name ?? undefined,
    walletName,
    signer: account,
    extension,
  };

  return currentConnection;
}

export function getCurrentConnection(): WalletConnection | null {
  return currentConnection;
}

export function disconnectWallet(): void {
  if (currentConnection?.extension) {
    currentConnection.extension.disconnect();
  }
  currentConnection = null;
}
