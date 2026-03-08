import { defineChain } from 'viem';

// Local devnet chain (for use with deploy.mjs local deployment)
export const localChain = defineChain({
  id: parseInt(import.meta.env.VITE_CHAIN_ID || '42'),
  name: 'Local QF Devnet',
  nativeCurrency: { name: 'QF', symbol: 'QF', decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_URL || 'http://localhost:8545'] },
  },
});

// Production Quantum Fusion chain
export const quantumFusion = defineChain({
  id: 1,
  name: 'Quantum Fusion',
  nativeCurrency: { name: 'QF', symbol: 'QF', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.quantumfusion.network'] },
  },
  blockExplorers: {
    default: { name: 'QF Explorer', url: 'https://explorer.quantumfusion.network' },
  },
});

export const QNS_REGISTRY_ADDRESS = (import.meta.env.VITE_QNS_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const QNS_REGISTRAR_ADDRESS = (import.meta.env.VITE_QNS_REGISTRAR_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const QNS_RESOLVER_ADDRESS = (import.meta.env.VITE_QNS_RESOLVER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const QNS_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'owner',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resolver',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setOwner',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setResolver',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: '_resolver', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSubnodeOwner',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'labelHash', type: 'bytes32' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const QNS_REGISTRAR_ABI = [
  // Read functions
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'burnAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'burnPercent',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalRegistrations',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReservedNames',
    inputs: [],
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reserved',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Existing read functions
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'durationInYears', type: 'uint256' },
      { name: 'permanent', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'renew',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'durationYears', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'available',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferName',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registrations',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'expires', type: 'uint256' },
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNamesByOwner',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'price3Char',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'price4Char',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'price5PlusChar',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permanentMultiplier',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Admin write functions
  {
    type: 'function',
    name: 'reserveName',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unreserveName',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'assignReservedName',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPrice',
    inputs: [
      { name: 'new3', type: 'uint256' },
      { name: 'new4', type: 'uint256' },
      { name: 'new5Plus', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPermanentMultiplier',
    inputs: [{ name: 'newMult', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBurnPercent',
    inputs: [{ name: 'newPercent', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTreasury',
    inputs: [{ name: 'newTreasury', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBurnAddress',
    inputs: [{ name: 'newBurn', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDefaultResolver',
    inputs: [{ name: 'newResolver', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAdmin',
    inputs: [{ name: 'newAdmin', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawToTreasury',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'NameRegistered',
    inputs: [
      { name: 'name', type: 'string', indexed: false },
      { name: 'labelHash', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'expires', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NameRenewed',
    inputs: [
      { name: 'name', type: 'string', indexed: false },
      { name: 'labelHash', type: 'bytes32', indexed: true },
      { name: 'newExpiry', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NameTransferred',
    inputs: [
      { name: 'name', type: 'string', indexed: false },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
    ],
  },
] as const;

export const QNS_RESOLVER_ABI = [
  {
    type: 'function',
    name: 'addr',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reverseResolve',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nameHash',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'text',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setText',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAddr',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'addr', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
