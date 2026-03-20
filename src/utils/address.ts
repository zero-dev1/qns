import { getSs58AddressInfo } from 'polkadot-api';
import { keccak256 } from 'viem';

export type AddressFormat = 'ss58' | 'evm' | 'invalid';

function isValidSubstrateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  const ss58Regex = /^[1-9A-HJ-NP-Za-km-z]{47,48}$/;
  if (!ss58Regex.test(address)) {
    return false;
  }
  
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for (const char of address) {
    if (!base58Chars.includes(char)) {
      return false;
    }
  }
  
  return true;
}

export function detectAddressFormat(address: string): AddressFormat {
  if (!address || typeof address !== 'string') {
    return 'invalid';
  }

  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  if (evmRegex.test(address)) {
    return 'evm';
  }

  try {
    if (isValidSubstrateAddress(address)) {
      return 'ss58';
    }
  } catch {
  }

  return 'invalid';
}

export function isValidAddress(address: string): boolean {
  return detectAddressFormat(address) !== 'invalid';
}

export function isSS58Address(address: string): boolean {
  return detectAddressFormat(address) === 'ss58';
}

export function isEVMAddress(address: string): boolean {
  return detectAddressFormat(address) === 'evm';
}

export function truncateAddress(address: string, prefixLen = 6, suffixLen = 4): string {
  if (!address) return '';
  if (address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

export function normalizeEVMAddress(address: string): string {
  if (!address) return '';
  const lower = address.toLowerCase();
  if (lower.startsWith('0x')) return lower;
  return `0x${lower}`;
}

export function getAddressFormatLabel(format: AddressFormat): string {
  switch (format) {
    case 'ss58':
      return 'Substrate address detected';
    case 'evm':
      return 'EVM address detected';
    default:
      return '';
  }
}

export function ss58ToEvmAddress(ss58Address: string): string {
  const info = getSs58AddressInfo(ss58Address);
  if (!info.isValid) throw new Error('Invalid SS58 address');
  const pubKeyHex = ('0x' + Array.from(info.publicKey)
    .map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
  const hash = keccak256(pubKeyHex);
  return '0x' + hash.slice(-40);
}
