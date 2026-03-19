import { isAddress as isSubstrateAddress, decodeAddress } from '@polkadot/util-crypto';
import { keccak256 } from 'ethers';

export type AddressFormat = 'ss58' | 'evm' | 'invalid';

/**
 * Detect the format of an address
 * Returns 'ss58' for Substrate addresses, 'evm' for EVM addresses, 'invalid' for neither
 */
export function detectAddressFormat(address: string): AddressFormat {
  if (!address || typeof address !== 'string') {
    return 'invalid';
  }

  // Check for EVM address (0x prefix + 40 hex chars)
  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  if (evmRegex.test(address)) {
    return 'evm';
  }

  // Check for SS58 address (starts with a letter/number, varies in length)
  // SS58 addresses typically start with 1, 5, or a letter
  try {
    if (isSubstrateAddress(address)) {
      return 'ss58';
    }
  } catch {
    // isAddress throws on invalid input
  }

  return 'invalid';
}

/**
 * Validate an address - accepts both SS58 and EVM formats
 */
export function isValidAddress(address: string): boolean {
  return detectAddressFormat(address) !== 'invalid';
}

/**
 * Check if address is SS58 format
 */
export function isSS58Address(address: string): boolean {
  return detectAddressFormat(address) === 'ss58';
}

/**
 * Check if address is EVM format
 */
export function isEVMAddress(address: string): boolean {
  return detectAddressFormat(address) === 'evm';
}

/**
 * Truncate an address for display (works with both formats)
 */
export function truncateAddress(address: string, prefixLen = 6, suffixLen = 4): string {
  if (!address) return '';
  if (address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Normalize an EVM address to lowercase with 0x prefix
 */
export function normalizeEVMAddress(address: string): string {
  if (!address) return '';
  const lower = address.toLowerCase();
  if (lower.startsWith('0x')) return lower;
  return `0x${lower}`;
}

/**
 * Get address label for UI display
 */
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

/**
 * Convert an SS58 Substrate address to an EVM address
 * The EVM address is derived by hashing the 32-byte public key with keccak256
 * and taking the last 20 bytes of the hash (matches pallet-revive's AccountId32Mapper::to_address)
 */
export function ss58ToEvmAddress(ss58Address: string): string {
  const publicKey = decodeAddress(ss58Address);
  const hash = keccak256(publicKey);
  // Take last 20 bytes of the hash (skip first 12 bytes = 24 hex chars + '0x' prefix)
  return '0x' + hash.slice(26);
}
