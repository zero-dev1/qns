import { keccak256, encodePacked, type Hex } from 'viem';
import { getTypedApi } from './papiClient';
import { callContract, writeContract, sendTransfer, type TxResult } from './contractCall';
import {
  QNS_REGISTRAR_ADDRESS,
  QNS_RESOLVER_ADDRESS,
  QNS_REGISTRAR_ABI,
  QNS_RESOLVER_ABI,
} from '../config/contracts';

/**
 * Returns the current provider type from the wallet store.
 * Used to route calls to either PAPI (substrate) or viem (evm).
 */
async function getProviderType(): Promise<'substrate' | 'evm' | null> {
  try {
    // Dynamic import to avoid circular dependency issues at module load time
    const { useWalletStore } = await import('../stores/walletStore');
    return useWalletStore.getState().providerType;
  } catch {
    return null;
  }
}

// Cast readonly ABIs to mutable any[] for ethers.js compatibility
const REGISTRAR_ABI = QNS_REGISTRAR_ABI as unknown as any[];
const RESOLVER_ABI = QNS_RESOLVER_ABI as unknown as any[];

// Hardcoded fallback prices (in wei/QF units)
// 3-char: 1000 QF, 4-char: 300 QF, 5+: 100 QF
export const DEFAULT_PRICES = {
  price3Char: 1000n * 10n ** 18n,      // 1000 QF
  price4Char: 300n * 10n ** 18n,       // 300 QF
  price5PlusChar: 100n * 10n ** 18n,   // 100 QF
  permanentMultiplier: 15n,             // 15x for permanent
};

// Network availability state
let networkAvailable = true;
let lastNetworkError: string | null = null;

export function isNetworkAvailable(): boolean {
  return networkAvailable;
}

export function getLastNetworkError(): string | null {
  return lastNetworkError;
}

const QF_ETH_RPC = 'https://archive.mainnet.qfnode.net/eth';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// Compatibility wrapper for viem's getPublicClient
// Returns an object with readContract method that uses raw EVM calls
export function getPublicClient() {
  return {
    readContract: async ({
      address,
      abi,
      functionName,
      args,
    }: {
      address: `0x${string}`;
      abi?: readonly unknown[];
      functionName: string;
      args?: unknown[];
    }): Promise<unknown> => {
      // Use the appropriate ABI based on address
      const addrLower = address.toLowerCase();
      const registrarLower = QNS_REGISTRAR_ADDRESS.toLowerCase();
      const resolverLower = QNS_RESOLVER_ADDRESS.toLowerCase();
      
      let contractAbi: any[];
      if (addrLower === registrarLower) {
        contractAbi = REGISTRAR_ABI;
      } else if (addrLower === resolverLower) {
        contractAbi = RESOLVER_ABI;
      } else {
        contractAbi = abi as any[] || [];
      }

      const result = await callContract(
        address,
        contractAbi,
        functionName,
        args || []
      );
      return result;
    },
    getBalance: async ({ address }: { address: `0x${string}` }): Promise<bigint> => {
      return getQFBalance(address);
    },
  };
}

// Compatibility wrapper for viem's getWalletClient
// Returns an object with writeContract and sendTransaction methods
export function getWalletClient() {
  return {
    writeContract: async ({
      address,
      abi,
      functionName,
      args,
      account,
      value,
    }: {
      address: `0x${string}`;
      abi?: readonly unknown[];
      functionName: string;
      args?: unknown[];
      account: `0x${string}` | string;
      value?: bigint;
    }): Promise<TxResult> => {
      // Use the appropriate ABI based on address
      const addrLower = address.toLowerCase();
      const registrarLower = QNS_REGISTRAR_ADDRESS.toLowerCase();
      const resolverLower = QNS_RESOLVER_ADDRESS.toLowerCase();
      
      let contractAbi: any[];
      if (addrLower === registrarLower) {
        contractAbi = REGISTRAR_ABI;
      } else if (addrLower === resolverLower) {
        contractAbi = RESOLVER_ABI;
      } else {
        contractAbi = abi as any[] || [];
      }

      const result = await writeContract(
        address,
        contractAbi,
        functionName,
        args || [],
        account,
        value || 0n
      );
      return result;
    },
    sendTransaction: async ({
      to,
      value,
      account,
      verifyOnChain,
    }: {
      to: `0x${string}`;
      value: bigint;
      account: `0x${string}` | string;
      verifyOnChain?: () => Promise<boolean>;
    }): Promise<TxResult> => {
      const result = await sendTransfer(to, value, account, verifyOnChain);
      return result;
    },
  };
}

export async function getContractPrice(name: string, years: number, permanent: boolean): Promise<bigint> {
  try {
    const [price3Char, price4Char, price5PlusChar, permanentMultiplier] = await Promise.all([
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price3Char'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price4Char'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price5PlusChar'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'permanentMultiplier'),
    ]);
    
    const len = name.length;
    let base: bigint;
    
    if (len === 3) {
      base = price3Char;
    } else if (len === 4) {
      base = price4Char;
    } else {
      base = price5PlusChar;
    }

    const finalPrice = permanent ? base * permanentMultiplier : base * BigInt(years);
    return finalPrice;
  } catch (error: any) {
    // Calculate with defaults
    const len = name.length;
    let base: bigint;
    if (len === 3) base = DEFAULT_PRICES.price3Char;
    else if (len === 4) base = DEFAULT_PRICES.price4Char;
    else base = DEFAULT_PRICES.price5PlusChar;
    return permanent ? base * DEFAULT_PRICES.permanentMultiplier : base * BigInt(years);
  }
}

export async function getContractPrices(): Promise<{
  price3Char: bigint;
  price4Char: bigint;
  price5PlusChar: bigint;
  permanentMultiplier: bigint;
  fromContract: boolean;
}> {
  try {
    
    const [r3, r4, r5, rm] = await Promise.all([
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price3Char'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price4Char'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'price5PlusChar'),
      callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'permanentMultiplier'),
    ]);
    
    
    networkAvailable = true;
    lastNetworkError = null;
    
    return { 
      price3Char: r3, 
      price4Char: r4, 
      price5PlusChar: r5, 
      permanentMultiplier: rm,
      fromContract: true
    };
  } catch (error: any) {
    networkAvailable = false;
    lastNetworkError = error.message || 'Network connection failed';
    
    // Return fallback prices
    return {
      ...DEFAULT_PRICES,
      fromContract: false
    };
  }
}

export function namehash(name: string): Hex {
  if (!name) return '0x0000000000000000000000000000000000000000000000000000000000000000';
  const labels = name.split('.').reverse();
  let node: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';
  for (const label of labels) {
    const labelHash = keccak256(new TextEncoder().encode(label) as unknown as Hex);
    node = keccak256(encodePacked(['bytes32', 'bytes32'], [node, labelHash]));
  }
  return node;
}

export function labelHash(label: string): Hex {
  return keccak256(new TextEncoder().encode(label) as unknown as Hex);
}

export function validateNameLocal(name: string): { valid: boolean; error: string | null } {
  if (name.length < 3) return { valid: false, error: 'Name must be at least 3 characters' };
  if (name.length > 64) return { valid: false, error: 'Name must be 64 characters or less' };
  if (!/^[a-z0-9-]+$/.test(name)) return { valid: false, error: 'Only lowercase letters, numbers, and hyphens' };
  if (name.startsWith('-')) return { valid: false, error: 'Cannot start with a hyphen' };
  if (name.endsWith('-')) return { valid: false, error: 'Cannot end with a hyphen' };
  return { valid: true, error: null };
}

export function calculatePrice(
  nameLength: number,
  years: number,
  permanent: boolean,
  prices: { price3Char: bigint; price4Char: bigint; price5PlusChar: bigint; permanentMultiplier: bigint }
): bigint {
  let base: bigint;
  if (nameLength === 3) base = prices.price3Char;
  else if (nameLength === 4) base = prices.price4Char;
  else base = prices.price5PlusChar;

  if (permanent) return base * prices.permanentMultiplier;
  return base * BigInt(years);
}

export async function getPrice(name: string, years: number, permanent: boolean): Promise<bigint> {
  try {
    return await getContractPrice(name, years, permanent);
  } catch (error: any) {
    
    // Calculate price using defaults
    const len = name.length;
    let base: bigint;
    
    if (len === 3) base = DEFAULT_PRICES.price3Char;
    else if (len === 4) base = DEFAULT_PRICES.price4Char;
    else base = DEFAULT_PRICES.price5PlusChar;
    
    return permanent ? base * DEFAULT_PRICES.permanentMultiplier : base * BigInt(years);
  }
}

export function formatQF(wei: bigint): string {
  const qf = Number(wei) / 1e18;
  if (qf >= 1000) return qf.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return qf.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function resolveForward(name: string): Promise<string | null> {
  try {
    const node = namehash(name.endsWith('.qf') ? name : `${name}.qf`);
    const addr = await callContract<string>(QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'addr', [node]);
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return null;
    return addr;
  } catch (error: any) {
    return null;
  }
}

export async function resolveReverse(address: string): Promise<string | null> {
  try {
    const name = await callContract<string>(QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'reverseResolve', [address]);
    networkAvailable = true;
    if (!name || name === '') return null;
    return name.endsWith('.qf') ? name.slice(0, -3) : name;
  } catch (error: any) {
    networkAvailable = false;
    lastNetworkError = error.message || 'Network connection failed';
    return null;
  }
}

export async function checkAvailability(name: string): Promise<boolean> {
  try {
    const result = await callContract<boolean>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'available', [name]);
    networkAvailable = true;
    return result;
  } catch (error: any) {
    networkAvailable = false;
    lastNetworkError = error.message || 'Network connection failed';
    throw new Error('Network unavailable - unable to check name availability');
  }
}

export async function getRegistration(name: string): Promise<{
  owner: string;
  expires: bigint;
  registeredAt: bigint;
} | null> {
  try {
    const lh = labelHash(name.toLowerCase());
    const result = await callContract<[string, bigint, bigint]>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'registrations', [lh]);
    networkAvailable = true;
    if (!result || result[0] === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    return { owner: result[0], expires: result[1], registeredAt: result[2] };
  } catch (error: any) {
    networkAvailable = false;
    lastNetworkError = error.message || 'Network connection failed';
    return null;
  }
}

export async function registerName(
  name: string,
  years: number,
  permanent: boolean,
  account: string
): Promise<TxResult> {
  const fee = await getPrice(name, years, permanent);
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS,
      REGISTRAR_ABI,
      'register',
      [name, years, permanent],
      BigInt(fee?.toString() || '0'),
      async () => {
        const available = await checkAvailability(name);
        return !available;
      }
    );
  }

  // Substrate path (existing)
  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'register',
    [name, years, permanent], account, BigInt(fee?.toString() || '0'),
    // Verification: check if name is now registered
    async () => {
      const available = await checkAvailability(name);
      return !available; // if NOT available, it was registered
    }
  );
}

export async function renewName(
  name: string,
  years: number,
  account: string
): Promise<TxResult> {
  const fee = await getPrice(name, years, false);
  const regBefore = await getRegistration(name).catch(() => null);
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'renew',
      [name, years], fee,
      async () => {
        const regAfter = await getRegistration(name);
        if (!regAfter || !regBefore) return false;
        return regAfter.expires > regBefore.expires;
      }
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'renew',
    [name, years], account, fee,
    async () => {
      const regAfter = await getRegistration(name);
      if (!regAfter || !regBefore) return false;
      return regAfter.expires > regBefore.expires;
    }
  );
}

export async function transferNameOnChain(
  name: string,
  newOwner: string,
  account: string
): Promise<TxResult> {
  let evmOwner = newOwner;
  if (!newOwner.startsWith('0x')) {
    const { deriveEVMAddress } = await import('./wallet');
    evmOwner = deriveEVMAddress(newOwner);
  }
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'transferName',
      [name, evmOwner], 0n,
      async () => {
        const reg = await getRegistration(name);
        return !!reg && reg.owner.toLowerCase() === evmOwner.toLowerCase();
      }
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'transferName',
    [name, evmOwner], account, 0n,
    async () => {
      const reg = await getRegistration(name);
      return !!reg && reg.owner.toLowerCase() === evmOwner.toLowerCase();
    }
  );
}

export async function getTextRecord(name: string, key: string): Promise<string> {
  try {
    const node = namehash(`${name}.qf`);
    return await callContract<string>(QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'text', [node, key]);
  } catch (error: any) {
    return '';
  }
}

export async function setTextRecord(
  name: string,
  key: string,
  value: string,
  account: string
): Promise<TxResult> {
  const node = namehash(`${name}.qf`);
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setText',
      [node, key, value], 0n,
      async () => {
        const stored = await getTextRecord(name, key);
        return stored === value;
      }
    );
  }

  return writeContract(
    QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setText',
    [node, key, value], account, 0n,
    async () => {
      const stored = await getTextRecord(name, key);
      return stored === value;
    }
  );
}

export async function setMultipleTextRecords(
  name: string,
  keys: string[],
  values: string[],
  account: string
): Promise<TxResult> {
  const node = namehash(`${name}.qf`);
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setMultipleTexts',
      [node, keys, values], 0n,
      keys.length > 0 ? async () => {
        const stored = await getTextRecord(name, keys[0]);
        return stored === values[0];
      } : undefined
    );
  }

  return writeContract(
    QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setMultipleTexts',
    [node, keys, values], account, 0n,
    keys.length > 0 ? async () => {
      const stored = await getTextRecord(name, keys[0]);
      return stored === values[0];
    } : undefined
  );
}

export async function setPrimaryName(
  name: string,
  evmAddress: string,
  signerAddress: string
): Promise<TxResult> {
  const nameNode = namehash(`${name}.qf`);
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setReverse',
      [evmAddress, nameNode], 0n,
      async () => {
        const resolved = await resolveReverse(evmAddress);
        return resolved === name;
      }
    );
  }

  return writeContract(
    QNS_RESOLVER_ADDRESS, RESOLVER_ABI, 'setReverse',
    [evmAddress, nameNode], signerAddress, 0n,
    async () => {
      const resolved = await resolveReverse(evmAddress);
      return resolved === name;
    }
  );
}

export async function getNamesOwnedByAddress(address: string): Promise<{
  name: string;
  owner: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
}[]> {
  const normalizedAddress = address.toLowerCase();
  
  try {
    const names = await callContract<string[]>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'getNamesByOwner', [normalizedAddress]);

    const results = [];
    for (const name of names) {
      const reg = await getRegistration(name);
      if (reg && reg.owner.toLowerCase() === normalizedAddress) {
        results.push({
          name,
          owner: reg.owner,
          expires: reg.expires,
          registeredAt: reg.registeredAt,
          isPermanent: false,
        });
      }
    }

    return results;
  } catch (error: any) {
    return [];
  }
}

export async function getQFBalance(address: string): Promise<bigint> {
  try {
    // EVM address (0x...) — use ETH JSON-RPC endpoint
    if (address.startsWith('0x') && address.length === 42) {
      const response = await fetch(QF_ETH_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });
      const json = await response.json();
      if (json.result) {
        return BigInt(json.result);
      }
      return 0n;
    }

    // SS58 address — query Substrate storage directly
    const typedApi = getTypedApi();
    const accountInfo = await typedApi.query.System.Account.getValue(address);
    return accountInfo?.data?.free ?? 0n;
  } catch (error: any) {
    console.error('getQFBalance error:', error);
    return 0n;
  }
}



export async function getSubstrateQFBalance(ss58Address: string): Promise<bigint> {
  // If the address looks like an EVM address, use EVM balance
  if (ss58Address.startsWith('0x') && ss58Address.length === 42) {
    const { evmGetBalance } = await import('./evmContractCall');
    return evmGetBalance(ss58Address);
  }
  return getQFBalance(ss58Address);
}

export async function hasMinimumBalance(ss58Address: string, minBalance: bigint = 1000000000000000n): Promise<boolean> {
  const balance = await getQFBalance(ss58Address);
  return balance > minBalance;
}

export async function reserveName(name: string, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'reserveName',
      [name], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'reserveName',
    [name], account, 0n, undefined
  );
}

export async function unreserveName(name: string, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'unreserveName',
      [name], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'unreserveName',
    [name], account, 0n, undefined
  );
}

export async function assignReservedName(name: string, to: string, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'assignReservedName',
      [name, to], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'assignReservedName',
    [name, to], account, 0n, undefined
  );
}

export async function setPrice(
  new3: bigint,
  new4: bigint,
  new5Plus: bigint,
  account: string
): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setPrice',
      [new3, new4, new5Plus], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setPrice',
    [new3, new4, new5Plus], account, 0n, undefined
  );
}

export async function setPermanentMultiplier(newMult: bigint, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setPermanentMultiplier',
      [newMult], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setPermanentMultiplier',
    [newMult], account, 0n, undefined
  );
}

export async function setBurnPercent(newPercent: bigint, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setBurnPercent',
      [newPercent], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setBurnPercent',
    [newPercent], account, 0n, undefined
  );
}

export async function setTreasury(newTreasury: string, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setTreasury',
      [newTreasury], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setTreasury',
    [newTreasury], account, 0n, undefined
  );
}

export async function setBurnAddress(newBurn: string, account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setBurnAddress',
      [newBurn], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'setBurnAddress',
    [newBurn], account, 0n, undefined
  );
}

export async function withdrawToTreasury(account: string): Promise<TxResult> {
  const providerType = await getProviderType();

  if (providerType === 'evm') {
    const { evmWriteContract } = await import('./evmContractCall');
    return evmWriteContract(
      QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'withdrawToTreasury',
      [], 0n, undefined
    );
  }

  return writeContract(
    QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'withdrawToTreasury',
    [], account, 0n, undefined
  );
}

export async function getAdmin(): Promise<string | null> {
  try {
    return await callContract<string>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'admin');
  } catch (error: any) {
    return null;
  }
}

export async function getBurnPercentContract(): Promise<bigint | null> {
  try {
    return await callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'burnPercent');
  } catch (error: any) {
    return null;
  }
}

export async function getTotalRegistrations(): Promise<bigint | null> {
  try {
    return await callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'totalRegistrations');
  } catch (error: any) {
    return null;
  }
}

export async function getTotalBurnedContract(): Promise<bigint | null> {
  try {
    return await callContract<bigint>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'totalBurned');
  } catch {
    return null;
  }
}

export async function getReservedNamesList(): Promise<string[]> {
  try {
    return await callContract<string[]>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'getReservedNames');
  } catch (error: any) {
    return [];
  }
}

export async function isReserved(name: string): Promise<boolean> {
  try {
    const lh = labelHash(name.toLowerCase());
    return await callContract<boolean>(QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'reserved', [lh]);
  } catch (error: any) {
    return false;
  }
}

export const BURN_ADDRESS_SS58 = '5C4hrfjw9DjXZTzV3MwzrrAr9PUr9y8SHgV3cmVGNUWRiJL5';
const REGISTRAR_SS58 = '5EpRx3VESwPSVZL6xrxT2P3hoRhdmWHgVfGFiZqqvWkAftNx'; // QNS Registrar on-chain SS58 (pallet-revive contract account)
const QF_EXPLORER_API = 'https://qf-explorer.mathswins.co.uk/api';

export const BURN_ADDRESS_EVM = '0x000000000000000000000000000000000000dEaD';

export interface BurnStats {
  totalBurned: number;      // All QF burned (all sources)
  qnsBurned: number;        // QF burned via QNS registrations only
  totalRegistrations: number;
  burnPercent: number;       // e.g. 5
  stale: boolean;           // ← ADD THIS FIELD
}

const BURN_CACHE_KEY = 'qns:burnStats';
const BURN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function readBurnCache(): BurnStats | null {
  try {
    const raw = localStorage.getItem(BURN_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > BURN_CACHE_TTL) {
      localStorage.removeItem(BURN_CACHE_KEY);
      return null;
    }
    return { ...data, stale: true };
  } catch {
    return null;
  }
}

function writeBurnCache(stats: BurnStats): void {
  try {
    const { stale, ...data } = stats;
    localStorage.setItem(BURN_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export async function getBurnStats(): Promise<BurnStats> {
  const cached = readBurnCache();

  const [transfersRes, totalRegs, burnPct] = await Promise.allSettled([
    fetch(`${QF_EXPLORER_API}/txs/${BURN_ADDRESS_SS58}?limit=200`)
      .then(r => {
        if (!r.ok) throw new Error(`Explorer API ${r.status}`);
        return r.json();
      }),
    getTotalRegistrations(),
    getBurnPercentContract(),
  ]);

  let totalBurned = 0;
  let qnsBurned = 0;
  let explorerAvailable = false;

  if (transfersRes.status === 'fulfilled' && transfersRes.value?.transfers?.items) {
    explorerAvailable = true;
    const items = transfersRes.value.transfers.items as Array<{
      from: string;
      to: string;
      amountQF: string;
    }>;

    for (const tx of items) {
      if (tx.to === BURN_ADDRESS_SS58) {
        const amount = parseFloat(tx.amountQF);
        totalBurned += amount;
        if (tx.from === REGISTRAR_SS58) {
          qnsBurned += amount;
        }
      }
    }
  }

  const totalRegistrations = totalRegs.status === 'fulfilled' && totalRegs.value
    ? Number(totalRegs.value)
    : 0;

  const burnPercent = burnPct.status === 'fulfilled' && burnPct.value
    ? Number(burnPct.value)
    : 5;

  // If explorer was down, try on-chain totalBurned (future contract upgrade)
  if (!explorerAvailable) {
    try {
      const onChainBurned = await callContract<bigint>(
        QNS_REGISTRAR_ADDRESS, REGISTRAR_ABI, 'totalBurned', []
      );
      if (onChainBurned !== undefined && onChainBurned !== null) {
        qnsBurned = Number(onChainBurned) / 1e18;
      }
    } catch {
      // totalBurned doesn't exist on current contract — expected pre-redeploy
    }
  }

  // If explorer available → fresh data, cache it and return
  if (explorerAvailable) {
    const stats: BurnStats = { totalBurned, qnsBurned, totalRegistrations, burnPercent, stale: false };
    writeBurnCache(stats);
    return stats;
  }

  // Explorer down → return cache if available, otherwise return zeros
  if (cached) {
    // Overlay fresh on-chain values onto cached explorer data
    return {
      ...cached,
      totalRegistrations: totalRegistrations || cached.totalRegistrations,
      burnPercent: burnPercent || cached.burnPercent,
      stale: true,
    };
  }

  return { totalBurned, qnsBurned, totalRegistrations, burnPercent, stale: false };
}
