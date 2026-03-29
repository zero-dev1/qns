import { deriveEVMAddress } from './wallet';
import { getTypedApi, getFreshBlockHash } from './papiClient';
import { Binary } from 'polkadot-api';

const STORAGE_KEY = 'qns_mapped_accounts-v2';

// Sentinel error messages used by walletStore to branch UX
export const METADATA_HASH_ERROR = 'METADATA_HASH_ERROR';
export const USER_CANCELLED = 'USER_CANCELLED';
export const INSUFFICIENT_BALANCE_FOR_MAPPING = 'INSUFFICIENT_BALANCE_FOR_MAPPING';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function isAccountMappedOnChain(ss58Address: string): Promise<boolean> {
  try {
    const api = getTypedApi();
    const evmAddress = deriveEVMAddress(ss58Address);
    const evmBinary = Binary.fromBytes(hexToBytes(evmAddress));
    const result: any = await api.query.Revive.OriginalAccount.getValue(evmBinary);
    // A null/undefined result or a result that is all zeros means unmapped
    if (result === null || result === undefined) return false;
    // If the value is a Uint8Array of all zeros → unmapped
    if (result instanceof Uint8Array) {
      return result.some((b: number) => b !== 0);
    }
    // If it's a string, check for zero address
    if (typeof result === 'string') {
      return result !== '' && !/^0x0+$/.test(result);
    }
    return true;
  } catch {
    return false;
  }
}

function isAccountMappedLocally(ss58Address: string): boolean {
  try {
    const mapped: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return mapped.includes(ss58Address);
  } catch {
    return false;
  }
}

function markAccountMappedLocally(ss58Address: string): void {
  try {
    const mapped: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!mapped.includes(ss58Address)) {
      mapped.push(ss58Address);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    }
  } catch {
    // Ignore localStorage errors
  }
}

export async function ensureAccountMapped(ss58Address: string): Promise<void> {
  // 1. Local cache check
  if (isAccountMappedLocally(ss58Address)) return;

  // 2. On-chain check
  const mappedOnChain = await isAccountMappedOnChain(ss58Address);
  if (mappedOnChain) {
    markAccountMappedLocally(ss58Address);
    return;
  }

  // 3. Need to submit map_account tx
  const api = getTypedApi();
  const { getCurrentConnection } = await import('./wallet');
  const connection = getCurrentConnection();
  if (!connection) throw new Error('No wallet connected');

  // Fresh block hash to avoid AncientBirthBlock (QF WS subscription goes stale)
  let freshAt: string | 'finalized' = 'finalized';
  try {
    freshAt = await getFreshBlockHash();
  } catch {
    // Fall back to 'finalized'
  }

  try {
    const result = await api.tx.Revive.map_account().signAndSubmit(
      connection.signer.polkadotSigner,
      {
        at: freshAt,
      }
    );

    if (!result.ok) {
      const error = result.dispatchError;
      if (error) {
        const errorStr = typeof error === 'object' && 'type' in error
          ? String((error as any).type)
          : String(error);
        if (errorStr.includes('AlreadyMapped') || errorStr.includes('AccountAlreadyMapped')) {
          markAccountMappedLocally(ss58Address);
          return;
        }
        throw new Error(errorStr);
      }
    }

    markAccountMappedLocally(ss58Address);
  } catch (err: any) {
    const msg = err?.message ?? '';

    // Already mapped → treat as success
    if (msg.includes('AlreadyMapped') || msg.includes('AccountAlreadyMapped')) {
      markAccountMappedLocally(ss58Address);
      return;
    }

    // User cancelled the wallet popup
    if (msg.includes('Cancelled') || msg.includes('Rejected') || msg.includes('cancelled') || msg.includes('rejected')) {
      throw new Error(USER_CANCELLED);
    }

    // CannotLookup → CheckMetadataHash misconfiguration
    if (msg.includes('CannotLookup')) {
      throw new Error(METADATA_HASH_ERROR);
    }

    // Insufficient balance for mapping transaction
    if (msg.includes('InsufficientBalance') || msg.includes('Inability to pay') || 
        msg.includes('1010:') || msg.includes('insufficient')) {
      throw new Error(INSUFFICIENT_BALANCE_FOR_MAPPING);
    }

    throw err;
  }
}
