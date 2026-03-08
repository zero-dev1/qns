import { createPublicClient, createWalletClient, custom, http, keccak256, encodePacked, type Hex, formatEther, parseEther } from 'viem';
import {
  localChain,
  QNS_REGISTRY_ADDRESS,
  QNS_REGISTRAR_ADDRESS,
  QNS_RESOLVER_ADDRESS,
  QNS_REGISTRY_ABI,
  QNS_REGISTRAR_ABI,
  QNS_RESOLVER_ABI,
} from '../config/contracts';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const PRICE_3_CHAR = parseEther('1000');
const PRICE_4_CHAR = parseEther('300');
const PRICE_5_PLUS_CHAR = parseEther('100');
const PERMANENT_MULTIPLIER = 15n;
const QF_USD_RATE = 0.01;

export function getPublicClient() {
  // Use /rpc proxy in dev mode to avoid CORS, otherwise use env URL
  const rpcUrl = import.meta.env.DEV ? '/rpc' : (import.meta.env.VITE_RPC_URL || 'http://localhost:8545');
  return createPublicClient({
    chain: localChain,
    transport: http(rpcUrl),
  });
}

export function getWalletClient() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return createWalletClient({
    chain: localChain,
    transport: custom(window.ethereum),
  });
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

export function getPrice(name: string, years: number, permanent: boolean): bigint {
  const len = name.length;
  let base: bigint;
  if (len === 3) base = PRICE_3_CHAR;
  else if (len === 4) base = PRICE_4_CHAR;
  else base = PRICE_5_PLUS_CHAR;

  if (permanent) return base * PERMANENT_MULTIPLIER;
  return base * BigInt(years);
}

export function formatQF(wei: bigint): string {
  const qf = formatEther(wei);
  const num = parseFloat(qf);
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatUSD(wei: bigint): string {
  const qf = parseFloat(formatEther(wei));
  const usd = qf * QF_USD_RATE;
  if (usd >= 1) return `~$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `~$${usd.toFixed(2)}`;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function resolveForward(name: string): Promise<string | null> {
  const client = getPublicClient();
  const node = namehash(name.endsWith('.qf') ? name : `${name}.qf`);
  try {
    const resolverAddr = await client.readContract({
      address: QNS_REGISTRY_ADDRESS,
      abi: QNS_REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    });
    if (resolverAddr === '0x0000000000000000000000000000000000000000') return null;
    const addr = await client.readContract({
      address: QNS_RESOLVER_ADDRESS,
      abi: QNS_RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    });
    if (addr === '0x0000000000000000000000000000000000000000') return null;
    return addr;
  } catch {
    return null;
  }
}

export async function resolveReverse(address: string): Promise<string | null> {
  const client = getPublicClient();
  try {
    const name = await client.readContract({
      address: QNS_RESOLVER_ADDRESS,
      abi: QNS_RESOLVER_ABI,
      functionName: 'reverseResolve',
      args: [address as `0x${string}`],
    });
    if (!name || name === '') return null;
    // Strip .qf suffix if present so frontend can consistently add it
    return name.endsWith('.qf') ? name.slice(0, -3) : name;
  } catch {
    return null;
  }
}

export async function checkAvailability(name: string): Promise<boolean> {
  const client = getPublicClient();
  try {
    console.log('[QNS] checkAvailability() calling registrar.available("' + name + '")');
    const result = await client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'available',
      args: [name],
    });
    console.log('[QNS] available("' + name + '") returned:', result);
    return result;
  } catch (err: any) {
    console.log('[QNS] available() ERROR:', err?.message || err);
    throw err;
  }
}

export async function getRegistration(name: string): Promise<{
  owner: string;
  expires: bigint;
  registeredAt: bigint;
} | null> {
  const client = getPublicClient();
  const lh = labelHash(name.toLowerCase());
  console.log('[QNS] getRegistration() name="' + name + '", labelHash=' + lh);
  try {
    console.log('[QNS] calling registrar.registrations(' + lh + ')');
    const result = await client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'registrations',
      args: [lh],
    });
    console.log('[QNS] registrations(' + lh + ') returned:', result);
    if (result[0] === '0x0000000000000000000000000000000000000000') {
      console.log('[QNS] registration has zero address - returning null');
      return null;
    }
    return { owner: result[0], expires: result[1], registeredAt: result[2] };
  } catch (err: any) {
    console.log('[QNS] registrations() ERROR:', err?.message || err);
    return null;
  }
}

export async function registerName(
  name: string,
  years: number,
  permanent: boolean,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet connected');
  const fee = getPrice(name, years, permanent);
  const hash = await walletClient.writeContract({
    address: QNS_REGISTRAR_ADDRESS,
    abi: QNS_REGISTRAR_ABI,
    functionName: 'register',
    args: [name, BigInt(years), permanent],
    value: fee,
    account,
    chain: localChain,
  });
  return hash;
}

export async function renewName(
  name: string,
  years: number,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet connected');
  const fee = getPrice(name, years, false);
  const hash = await walletClient.writeContract({
    address: QNS_REGISTRAR_ADDRESS,
    abi: QNS_REGISTRAR_ABI,
    functionName: 'renew',
    args: [name, BigInt(years)],
    value: fee,
    account,
    chain: localChain,
  });
  return hash;
}

export async function transferNameOnChain(
  name: string,
  newOwner: `0x${string}`,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet connected');
  const hash = await walletClient.writeContract({
    address: QNS_REGISTRAR_ADDRESS,
    abi: QNS_REGISTRAR_ABI,
    functionName: 'transferName',
    args: [name, newOwner],
    account,
    chain: localChain,
  });
  return hash;
}

export async function getTextRecord(name: string, key: string): Promise<string> {
  const client = getPublicClient();
  const node = namehash(`${name}.qf`);
  try {
    return await client.readContract({
      address: QNS_RESOLVER_ADDRESS,
      abi: QNS_RESOLVER_ABI,
      functionName: 'text',
      args: [node, key],
    });
  } catch {
    return '';
  }
}

export async function setTextRecord(
  name: string,
  key: string,
  value: string,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet connected');
  const node = namehash(`${name}.qf`);
  return walletClient.writeContract({
    address: QNS_RESOLVER_ADDRESS,
    abi: QNS_RESOLVER_ABI,
    functionName: 'setText',
    args: [node, key, value],
    account,
    chain: localChain,
  });
}

export async function getNamesOwnedByAddress(address: string): Promise<{
  name: string;
  owner: string;
  expires: bigint;
  registeredAt: bigint;
}[]> {
  const client = getPublicClient();
  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  
  console.log('[QNS] getNamesOwnedByAddress() called for:', normalizedAddress);

  try {
    // Get names from contract's getNamesByOwner function
    const names = await client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'getNamesByOwner',
      args: [normalizedAddress],
    }) as string[];

    console.log('[QNS] getNamesByOwner returned:', names);

    // Get registration details for each name
    const results = [];
    for (const name of names) {
      const reg = await getRegistration(name);
      if (reg && reg.owner.toLowerCase() === normalizedAddress) {
        results.push({
          name,
          owner: reg.owner,
          expires: reg.expires,
          registeredAt: reg.registeredAt,
        });
      }
    }

    console.log('[QNS] Final owned names:', results.map(r => r.name));
    return results;
  } catch (err) {
    console.error('[QNS] getNamesOwnedByAddress error:', err);
    return [];
  }
}

export async function getQFBalance(address: string): Promise<bigint> {
  const client = getPublicClient();
  try {
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    });
    return balance;
  } catch {
    return 0n;
  }
}
