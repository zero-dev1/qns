import { createPublicClient, createWalletClient, custom, http, keccak256, encodePacked, type Hex, formatEther } from 'viem';
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

export async function getContractPrice(name: string, years: number, permanent: boolean): Promise<bigint> {
  const client = getPublicClient();
  
  console.log('[QNS] getPrice() name:', name, 'length:', name.length);
  
  const [price3Char, price4Char, price5PlusChar, permanentMultiplier] = await Promise.all([
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price3Char',
    }),
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price4Char',
    }),
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price5PlusChar',
    }),
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'permanentMultiplier',
    }),
  ]);
  
  const len = name.length;
  let base: bigint;
  let priceFunction: string;
  
  if (len === 3) {
    base = price3Char as bigint;
    priceFunction = 'price3Char';
  } else if (len === 4) {
    base = price4Char as bigint;
    priceFunction = 'price4Char';
  } else {
    base = price5PlusChar as bigint;
    priceFunction = 'price5PlusChar';
  }

  console.log('[QNS] getPrice() using price function:', priceFunction);
  console.log('[QNS] getPrice() raw wei from contract:', base.toString());
  console.log('[QNS] getPrice() after formatEther:', formatEther(base));

  const finalPrice = permanent ? base * (permanentMultiplier as bigint) : base * BigInt(years);
  
  console.log('[QNS] getPrice() final return value (wei):', finalPrice.toString());
  return finalPrice;
}

export function getPublicClient() {
  // Use /rpc proxy in dev mode to avoid CORS, otherwise use env URL
  const rpcUrl = import.meta.env.DEV ? '/rpc' : (import.meta.env.VITE_RPC_URL || 'http://localhost:8545');
  return createPublicClient({
    chain: localChain,
    transport: http(rpcUrl),
  });
}

export async function getContractPrices(): Promise<{
  price3Char: bigint;
  price4Char: bigint;
  price5PlusChar: bigint;
  permanentMultiplier: bigint;
}> {
  const client = getPublicClient();
  
  const [price3Char, price4Char, price5PlusChar, permanentMultiplier] = await Promise.all([
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price3Char',
    }) as Promise<bigint>,
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price4Char',
    }) as Promise<bigint>,
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'price5PlusChar',
    }) as Promise<bigint>,
    client.readContract({
      address: QNS_REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'permanentMultiplier',
    }) as Promise<bigint>,
  ]);
  
  return { price3Char, price4Char, price5PlusChar, permanentMultiplier };
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

const QF_USD_RATE = 0.01;

export async function getPrice(name: string, years: number, permanent: boolean): Promise<bigint> {
  return getContractPrice(name, years, permanent);
}

export function formatQF(wei: bigint): string {
  const qf = parseFloat(formatEther(wei));
  if (qf >= 1000) return qf.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return qf.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
  const fee = await getPrice(name, years, permanent);
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
  const fee = await getPrice(name, years, false);
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

export async function setPrimaryName(
  name: string,
  account: `0x${string}`
): Promise<`0x${string}`> {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('No wallet connected');

  // Compute reverse node: namehash of "{address lowercase without 0x}.reverse"
  const cleanAddress = account.toLowerCase().slice(2);
  const reverseName = `${cleanAddress}.reverse`;
  const reverseNode = namehash(reverseName);

  console.log('[QNS] setPrimaryName() calling setName with:');
  console.log('  account:', account);
  console.log('  reverseName:', reverseName);
  console.log('  reverseNode:', reverseNode);
  console.log('  name (to set):', name);

  // The reverse node should already exist (created during first registration)
  // Just update the name on the reverse node
  const hash = await walletClient.writeContract({
    address: QNS_RESOLVER_ADDRESS,
    abi: QNS_RESOLVER_ABI,
    functionName: 'setName',
    args: [reverseNode, name],
    account,
    chain: localChain,
  });

  console.log('[QNS] setPrimaryName() transaction hash:', hash);
  return hash;
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
