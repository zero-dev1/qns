import { keccak256, encodePacked, type Hex } from 'viem';
import { getTypedApi } from './papiClient';
import { callContract, writeContract, sendTransfer } from './contractCall';
import {
  QNS_REGISTRAR_ADDRESS,
  QNS_RESOLVER_ADDRESS,
  QNS_REGISTRAR_ABI,
  QNS_RESOLVER_ABI,
} from '../config/contracts';

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
    }): Promise<`0x${string}`> => {
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

      const txHash = await writeContract(
        address,
        contractAbi,
        functionName,
        args || [],
        account,
        value || 0n
      );
      return txHash as `0x${string}`;
    },
    sendTransaction: async ({
      to,
      value,
      account,
    }: {
      to: `0x${string}`;
      value: bigint;
      account: `0x${string}` | string;
    }): Promise<`0x${string}`> => {
      const txHash = await sendTransfer(to, value, account);
      return txHash as `0x${string}`;
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
): Promise<string> {
  
  let fee: bigint;
  try {
    fee = await getPrice(name, years, permanent);
  } catch (feeErr: any) {
    throw feeErr;
  }
  
  
  try {
    // Ensure fee is a proper bigint before passing
    const feeBigInt = BigInt(fee?.toString() || '0');
    
    const result = await writeContract(
      QNS_REGISTRAR_ADDRESS,
      REGISTRAR_ABI,
      'register',
      [name, years, permanent],
      account,
      feeBigInt
    );
    return result;
  } catch (writeErr: any) {
    throw writeErr;
  }
}

export async function renewName(
  name: string,
  years: number,
  account: string
): Promise<string> {
  const fee = await getPrice(name, years, false);
  
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'renew',
    [name, years],
    account,
    fee
  );
}

export async function transferNameOnChain(
  name: string,
  newOwner: string,
  account: string
): Promise<string> {
  // Contract expects EVM address — convert SS58 if needed
  let evmOwner = newOwner;
  if (!newOwner.startsWith('0x')) {
    const { deriveEVMAddress } = await import('./wallet');
    evmOwner = deriveEVMAddress(newOwner);
      }

  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'transferName',
    [name, evmOwner],
    account,
    0n
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
): Promise<string> {
  const node = namehash(`${name}.qf`);
  
  return writeContract(
    QNS_RESOLVER_ADDRESS,
    RESOLVER_ABI,
    'setText',
    [node, key, value],
    account,
    0n
  );
}

export async function setMultipleTextRecords(
  name: string,
  keys: string[],
  values: string[],
  account: string
): Promise<string> {
  const node = namehash(`${name}.qf`);
  
  return writeContract(
    QNS_RESOLVER_ADDRESS,
    RESOLVER_ABI,
    'setMultipleTexts',
    [node, keys, values],
    account,
    0n
  );
}

export async function setPrimaryName(
  name: string,
  evmAddress: string,
  signerAddress: string
): Promise<string> {
  const nameNode = namehash(`${name}.qf`);
  
  return writeContract(
    QNS_RESOLVER_ADDRESS,
    RESOLVER_ABI,
    'setReverse',
    [evmAddress, nameNode],
    signerAddress,
    0n
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
    const typedApi = getTypedApi();
    const accountInfo = await typedApi.query.System.Account.getValue(address);
    return accountInfo?.data?.free ?? 0n;
  } catch (error: any) {
    return 0n;
  }
}



export async function getSubstrateQFBalance(ss58Address: string): Promise<bigint> {
  return getQFBalance(ss58Address);
}

export async function hasMinimumBalance(ss58Address: string, minBalance: bigint = 1000000000000000n): Promise<boolean> {
  const balance = await getQFBalance(ss58Address);
  return balance > minBalance;
}

export async function reserveName(name: string, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'reserveName',
    [name],
    account,
    0n
  );
}

export async function unreserveName(name: string, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'unreserveName',
    [name],
    account,
    0n
  );
}

export async function assignReservedName(name: string, to: string, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'assignReservedName',
    [name, to],
    account,
    0n
  );
}

export async function setPrice(
  new3: bigint,
  new4: bigint,
  new5Plus: bigint,
  account: string
): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'setPrice',
    [new3, new4, new5Plus],
    account,
    0n
  );
}

export async function setPermanentMultiplier(newMult: bigint, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'setPermanentMultiplier',
    [newMult],
    account,
    0n
  );
}

export async function setBurnPercent(newPercent: bigint, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'setBurnPercent',
    [newPercent],
    account,
    0n
  );
}

export async function setTreasury(newTreasury: string, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'setTreasury',
    [newTreasury],
    account,
    0n
  );
}

export async function setBurnAddress(newBurn: string, account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'setBurnAddress',
    [newBurn],
    account,
    0n
  );
}

export async function withdrawToTreasury(account: string): Promise<string> {
  return writeContract(
    QNS_REGISTRAR_ADDRESS,
    REGISTRAR_ABI,
    'withdrawToTreasury',
    [],
    account,
    0n
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
