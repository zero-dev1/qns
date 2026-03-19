import { getInjectedExtensions, connectInjectedExtension } from "polkadot-api/pjs-signer";
import type { InjectedExtension, InjectedPolkadotAccount } from "polkadot-api/pjs-signer";
import { keccak256 } from "viem";
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
  const encoder = new TextEncoder();
  const hash = keccak256(encoder.encode(ss58Address));
  return "0x" + hash.slice(26);
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
  const evmAddress = deriveEVMAddress(account.address);

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
