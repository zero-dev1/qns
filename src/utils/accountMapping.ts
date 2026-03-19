import { getApi } from './wallet';
import { deriveEVMAddress } from './wallet';

const STORAGE_KEY = 'qns_mapped_accounts';

// --- On-chain check ---

async function isAccountMappedOnChain(ss58Address: string): Promise<boolean> {
  try {
    const api = await getApi();
    const evmAddress = deriveEVMAddress(ss58Address);
    
    // Query pallet-revive storage: maps H160 → Option<AccountId32>
    const result = await api.query.revive.originalAccount(evmAddress) as any;
    
    return !result.isNone;
  } catch (err) {
    console.warn('[QF] Could not check on-chain mapping status:', err);
    return false;
  }
}

// --- Local cache (avoids redundant on-chain checks within same session) ---

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
    // localStorage not available, non-critical
  }
}

// --- Main function: ensure account is mapped before contract interaction ---

export async function ensureAccountMapped(ss58Address: string): Promise<void> {
  // 1. Check local cache first (fastest, avoids unnecessary RPC)
  if (isAccountMappedLocally(ss58Address)) {
    console.log('[QF] Account already mapped (cached)');
    return;
  }

  // 2. Check on-chain state (authoritative)
  const mappedOnChain = await isAccountMappedOnChain(ss58Address);
  if (mappedOnChain) {
    console.log('[QF] Account already mapped on-chain');
    markAccountMappedLocally(ss58Address);
    return;
  }

  // 3. Not mapped — submit map_account extrinsic
  console.log('[QF] Account not mapped, submitting map_account...');
  const api = await getApi();
  
  const { web3Enable, web3FromAddress } = await import('@polkadot/extension-dapp');
  await web3Enable('QNS');
  const injector = await web3FromAddress(ss58Address);
  
  const tx = api.tx.revive.mapAccount();
  
  await new Promise<void>((resolve, reject) => {
    tx.signAndSend(
      ss58Address,
      { signer: injector.signer, withSignedTransaction: false },
      ({ status, dispatchError }: any) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            // If already mapped (race condition or stale cache), treat as success
            if (decoded.name.includes('AlreadyMapped') || decoded.name.includes('AccountAlreadyMapped')) {
              console.log('[QF] Account was already mapped (race condition), continuing...');
              markAccountMappedLocally(ss58Address);
              resolve();
              return;
            }
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            const err = dispatchError.toString();
            if (err.includes('AlreadyMapped')) {
              markAccountMappedLocally(ss58Address);
              return resolve();
            }
            return reject(new Error(err));
          }
        }
        if (status.isFinalized) {
          console.log('[QF] Account mapped successfully, finalized in block:', status.asFinalized.toHex());
          markAccountMappedLocally(ss58Address);
          resolve();
        }
      }
    ).catch((err: any) => {
      // This catches RPC errors like insufficient balance
      if (err.message?.includes('AlreadyMapped')) {
        markAccountMappedLocally(ss58Address);
        return resolve();
      }
      reject(new Error(err.message || 'Account mapping failed'));
    });
  });
}
