// deploy.mjs — QNS deployment script for QF Network (pallet-revive via eth-rpc)
import { createWalletClient, createPublicClient, http, defineChain, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';

// ============================================
// CONFIG
// ============================================
const RPC_URL = 'http://localhost:8545';
const CHAIN_ID = 42;
const DEPLOYER_KEY = '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

const qfChain = defineChain({
  id: CHAIN_ID,
  name: 'QF Local',
  nativeCurrency: { name: 'QF', symbol: 'QF', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const account = privateKeyToAccount(DEPLOYER_KEY);
const TREASURY = account.address;

const walletClient = createWalletClient({
  account,
  chain: qfChain,
  transport: http(RPC_URL),
});

const publicClient = createPublicClient({
  chain: qfChain,
  transport: http(RPC_URL),
});

// ============================================
// HELPERS
// ============================================
function loadCombinedJson() {
  const raw = JSON.parse(readFileSync('contracts/combined.json', 'utf-8'));
  const contracts = {};
  for (const [key, value] of Object.entries(raw.contracts)) {
    const name = key.split(':').pop();
    // Skip interfaces (they don't have bytecode)
    if (name.startsWith('I')) continue;
    // Only include if it has bytecode
    if (!value.bin) continue;
    contracts[name] = {
      abi: typeof value.abi === 'string' ? JSON.parse(value.abi) : value.abi,
      bytecode: value.bin.startsWith('0x') ? value.bin : '0x' + value.bin,
    };
  }
  return contracts;
}

async function deploy(name, abi, bytecode, args = []) {
  console.log(`\n--- Deploying ${name}${args.length ? ' with args: ' + JSON.stringify(args).slice(0, 100) : ''} ---`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
  });

  console.log(`  TX hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(`${name} deployment failed — no contract address in receipt`);
  }

  console.log(`  ✅ ${name} deployed at: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

async function callContract(name, address, abi, functionName, args = []) {
  console.log(`  Calling ${name}.${functionName}(${args.map(a => typeof a === 'string' ? a.slice(0, 20) + '...' : a).join(', ')})`);

  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`${name}.${functionName} failed — tx reverted`);
  }

  console.log(`  ✅ ${functionName} succeeded`);
  return receipt;
}

// ============================================
// STEP 1: LOAD COMPILED CONTRACTS
// ============================================
console.log('============================================');
console.log('STEP 1: Loading compiled contracts');
console.log('============================================');

const contracts = loadCombinedJson();
console.log(`Loaded: ${Object.keys(contracts).join(', ')}`);

if (!contracts.QNSRegistry || !contracts.QNSResolver || !contracts.QNSRegistrar) {
  throw new Error('Missing one or more contracts in combined.json. Run: resolc contracts/QNSRegistry.sol contracts/QNSResolver.sol contracts/QNSRegistrar.sol --combined-json abi,bin -o contracts/ --overwrite');
}

// ============================================
// STEP 2: DEPLOY
// ============================================
console.log('\n============================================');
console.log('STEP 2: Deploying contracts');
console.log('============================================');
console.log(`Deployer: ${account.address}`);
console.log(`Treasury: ${TREASURY}`);
console.log(`Burn: ${BURN_ADDRESS}`);

const registryAddress = await deploy(
  'QNSRegistry',
  contracts.QNSRegistry.abi,
  contracts.QNSRegistry.bytecode
);

const resolverAddress = await deploy(
  'QNSResolver',
  contracts.QNSResolver.abi,
  contracts.QNSResolver.bytecode,
  [registryAddress]
);

const registrarAddress = await deploy(
  'QNSRegistrar',
  contracts.QNSRegistrar.abi,
  contracts.QNSRegistrar.bytecode,
  [registryAddress, resolverAddress, TREASURY, BURN_ADDRESS]
);

// ============================================
// STEP 3: WIRE CONTRACTS
// ============================================
console.log('\n============================================');
console.log('STEP 3: Wiring contracts');
console.log('============================================');

const rootNode = '0x0000000000000000000000000000000000000000000000000000000000000000';
const qfLabel = keccak256(toHex('qf'));

await callContract('QNSRegistry', registryAddress, contracts.QNSRegistry.abi, 'setSubnodeOwner', [
  rootNode,
  qfLabel,
  registrarAddress,
]);

await callContract('QNSResolver', resolverAddress, contracts.QNSResolver.abi, 'addAuthorizedCaller', [
  registrarAddress,
]);

// ============================================
// STEP 4: RESERVE NAMES
// ============================================
console.log('\n============================================');
console.log('STEP 4: Reserving names');
console.log('============================================');

const reservedNames = [
  'qflink', 'qfpad', 'qfclash', 'qfstream', 'nucleusx',
  'quantumnotary', 'quantum', 'fusion', 'quantumfusion', 'qf',
  'dapp', 'bridge', 'governance', 'admin', 'treasury',
  'validator', 'node', 'swap', 'stake', 'pool',
  'vault', 'dao', 'nft', 'token', 'wallet',
  'vector', 'nucleus',
];

let reserved = 0;
let failed = 0;

for (const name of reservedNames) {
  try {
    await callContract('QNSRegistrar', registrarAddress, contracts.QNSRegistrar.abi, 'reserveName', [name]);
    reserved++;
  } catch (err) {
    console.log(`  ⚠️ Failed to reserve "${name}": ${err.message?.slice(0, 80)}`);
    failed++;
  }
}

console.log(`\nReserved: ${reserved}/${reservedNames.length} (${failed} failed)`);

// ============================================
// STEP 5: WRITE .env.development
// ============================================
console.log('\n============================================');
console.log('STEP 5: Writing .env.development');
console.log('============================================');

const envContent = `# QNS Contract Addresses (Local Dev)
# Generated by deploy.mjs on ${new Date().toISOString()}

VITE_QNS_REGISTRY_ADDRESS=${registryAddress}
VITE_QNS_REGISTRAR_ADDRESS=${registrarAddress}
VITE_QNS_RESOLVER_ADDRESS=${resolverAddress}
VITE_RPC_URL=${RPC_URL}
VITE_CHAIN_ID=${CHAIN_ID}
VITE_TREASURY_ADDRESS=${TREASURY}
VITE_BURN_ADDRESS=${BURN_ADDRESS}
`;

writeFileSync('.env.development', envContent);
console.log('✅ .env.development written');

// ============================================
// SUMMARY
// ============================================
console.log('\n============================================');
console.log('DEPLOYMENT COMPLETE');
console.log('============================================');
console.log(`QNSRegistry:  ${registryAddress}`);
console.log(`QNSResolver:  ${resolverAddress}`);
console.log(`QNSRegistrar: ${registrarAddress}`);
console.log(`Treasury:     ${TREASURY}`);
console.log(`Burn:         ${BURN_ADDRESS}`);
console.log(`Names reserved: ${reserved}/${reservedNames.length}`);
console.log('\nRun your dev server to start using QNS.');
