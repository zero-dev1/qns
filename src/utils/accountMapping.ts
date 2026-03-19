import { deriveEVMAddress } from './wallet';
import { getTypedApi } from './papiClient';
import { Binary } from 'polkadot-api';

const STORAGE_KEY = 'qns_mapped_accounts';

async function isAccountMappedOnChain(ss58Address: string): Promise<boolean> {
  try {
    const api = getTypedApi();
    const evmAddress = deriveEVMAddress(ss58Address);
    const evmBinary = Binary.fromHex(evmAddress);
    
    const result = await api.query.Revive.OriginalAccount.getValue(evmBinary);
    
    return result !== null;
  } catch (err) {
    console.warn('[QF] Could not check on-chain mapping status:', err);
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
  if (isAccountMappedLocally(ss58Address)) {
    console.log('[QF] Account already mapped (cached)');
    return;
  }

  const mappedOnChain = await isAccountMappedOnChain(ss58Address);
  if (mappedOnChain) {
    console.log('[QF] Account already mapped on-chain');
    markAccountMappedLocally(ss58Address);
    return;
  }

  console.log('[QF] Account not mapped, submitting map_account...');
  const api = getTypedApi();
  const { getCurrentConnection } = await import('./wallet');
  const connection = getCurrentConnection();
  
  if (!connection) {
    throw new Error('No wallet connected');
  }

  try {
    const result = await api.tx.Revive.map_account().signAndSubmit(connection.signer.polkadotSigner);
    
    if (!result.ok) {
      const error = result.dispatchError;
      if (error) {
        const errorStr = typeof error === 'object' && 'type' in error ? `${(error as { type: string }).type}` : String(error);
        if (errorStr.includes('AlreadyMapped') || errorStr.includes('AccountAlreadyMapped')) {
          console.log('[QF] Account was already mapped (race condition), continuing...');
          markAccountMappedLocally(ss58Address);
          return;
        }
        throw new Error(errorStr);
      }
    }
    
    console.log('[QF] Account mapped successfully');
    markAccountMappedLocally(ss58Address);
  } catch (err) {
    if ((err as Error).message?.includes('AlreadyMapped') || (err as Error).message?.includes('AccountAlreadyMapped')) {
      console.log('[QF] Account was already mapped (race condition), continuing...');
      markAccountMappedLocally(ss58Address);
      return;
    }
    throw err;
  }
}
