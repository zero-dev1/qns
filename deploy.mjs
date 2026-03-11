// deploy.mjs — QNS deployment script for QF Network (pallet-revive via eth-rpc)
import { createWalletClient, createPublicClient, http, defineChain, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================
// CONFIG
// ============================================
const RPC_URL = process.env.VITE_WALLET_RPC_URL;
if (!RPC_URL) throw new Error('VITE_WALLET_RPC_URL environment variable is required');
const CHAIN_ID = 42;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_KEY) throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required');
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

const qfChain = defineChain({
  id: CHAIN_ID,
  name: 'QF Local',
  nativeCurrency: { name: 'QF', symbol: 'QF', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const account = privateKeyToAccount(DEPLOYER_KEY);
const TREASURY = "0xA65cE65fFA2C1bb1D782CeAfb2Af94Fd636C6514";

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
// COMPILE CONTRACTS
// ============================================
console.log('============================================');
console.log('COMPILING CONTRACTS');
console.log('============================================');

// Delete existing combined.json if it exists
const combinedJsonPath = 'contracts/combined.json';
if (existsSync(combinedJsonPath)) {
  console.log('Deleting existing contracts/combined.json...');
  unlinkSync(combinedJsonPath);
}

// Run resolc compilation
console.log('Running resolc compilation...');
try {
  execSync(
    'resolc contracts/QNSRegistry.sol contracts/QNSResolver.sol contracts/QNSRegistrar.sol --combined-json abi,bin -o contracts/ --overwrite',
    { stdio: 'inherit' }
  );
} catch (err) {
  console.error('❌ Compilation failed:', err.message);
  process.exit(1);
}

// Verify combined.json was created
if (!existsSync(combinedJsonPath)) {
  console.error('❌ Compilation failed: contracts/combined.json was not created');
  process.exit(1);
}
console.log('✅ Compilation successful');
console.log('');

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
const reverseLabel = keccak256(toHex('reverse'));

await callContract('QNSRegistry', registryAddress, contracts.QNSRegistry.abi, 'setSubnodeOwner', [
  rootNode,
  qfLabel,
  registrarAddress,
]);

await callContract('QNSResolver', resolverAddress, contracts.QNSResolver.abi, 'addAuthorizedCaller', [
  registrarAddress,
]);

// Create the "reverse" top-level node owned by the deployer first
await callContract('QNSRegistry', registryAddress, contracts.QNSRegistry.abi, 'setSubnodeOwner', [
  rootNode,
  reverseLabel,
  account.address, // deployer owns it initially
]);

// Now transfer ownership of the "reverse" node to the Registrar so it can create subnodes
await callContract('QNSRegistry', registryAddress, contracts.QNSRegistry.abi, 'setSubnodeOwner', [
  rootNode,
  reverseLabel,
  registrarAddress,
]);

// ============================================
// RESERVED NAMES LIST
// ============================================
const RESERVED_NAMES = [
  // ===== PROTOCOL & INFRASTRUCTURE =====
  "qflink", "qfpad", "qfclash", "qfstream", "nucleusx", "quantumnotary",
  "quantum", "fusion", "quantumfusion", "dapp", "bridge", "governance",
  "admin", "treasury", "validator", "node", "swap", "stake", "pool",
  "vault", "dao", "nft", "token", "wallet", "vector", "nucleus",
  "protocol", "network", "chain", "testnet", "mainnet", "explorer",
  "faucet", "docs", "api", "sdk", "cli", "hub", "portal", "gateway",
  "relay", "oracle", "index", "registry", "resolver", "registrar",
  "contract", "deploy", "genesis", "block", "epoch", "shard",

  // ===== FOUNDER =====
  "main", "labs", "ben", "memechi",

  // ===== YOUR KOL LIST (provided) =====
  "abu", "alaoui", "altstein", "anthony", "ariff", "bitomoney", "bob",
  "bullishbear", "crayola", "crypto44", "cryptofella", "gideon", "jopp",
  "cryptomanic", "cryptomonk", "cryptonova", "rishad", "cryptocaesar",
  "ctgymrat", "degenkenn", "dippy", "drew", "druya", "ezmoney", "fattony",
  "gemdetector", "goomba", "hawk", "hwmedia", "intrepid", "justiinape",
  "karamata", "kito", "lawless", "layeralpha", "lsd", "matteo", "gorgonite",
  "mezcez", "moneylord", "goodie", "musa", "nite", "nilsb", "noach",
  "panamax", "paw", "roshi", "rush", "satoshiflipper", "sharky", "soef",
  "sykodelic", "tang", "tareeq", "teddy", "alchemist", "altcoinsensei",
  "uponlygreg", "web3princess",

  // ===== QF CALLERS (confirmed on X) =====
  "swampmonkey", "kenobi", "dtcrypto", "axeledger", "singularity",
  "chadpumpiano", "octgems", "axe",

  // ===== NAMED BIG KOLs =====
  "drprofit", "cryptogodjohn", "becker",

  // ===== TOP-TIER CRYPTO KOLs =====
  "pentoshi", "ansem", "bluntz", "hsaka", "cobie", "lookonchain",
  "watcherguru", "saylor", "vitalik", "donalt", "raoul", "arthurhays",
  "zhusu", "eliz", "murad", "kaleo", "crediblecrypto", "cryptotony",
  "bitboy", "larkdavis", "cryptobanter", "rektcapital", "cryptobirb",
  "altcoingordon", "cryptowizard", "nebraskagooner", "degenpoet",
  "inversebrah", "gainzy", "cryptoyoda", "cryptomanran",

  // ===== GEOGRAPHIC & POLITICAL =====
  "usa", "uae", "dubai", "london", "newyork", "tokyo", "singapore",
  "hongkong", "europe", "africa", "asia", "australia", "canada",
  "germany", "france", "india", "china", "korea", "japan", "brazil",
  "mexico", "nigeria", "kenya", "egypt", "saudi", "qatar", "bahrain",
  "kuwait", "oman", "jordan", "turkey", "russia", "ukraine",
  "president", "potus", "congress", "senate", "government", "royal",
  "kingdom", "embassy", "united", "nations", "olympic", "fifa",
  "minister", "chancellor", "governor", "mayor",

  // ===== HIGH-VALUE GENERIC =====
  "bitcoin", "ethereum", "solana", "polkadot", "polygon", "avalanche",
  "cardano", "ripple", "dogecoin", "shiba", "pepe", "meme", "memecoin",
  "official", "verified", "founder", "ceo", "cto", "developer",
  "engineer", "investor", "whale", "alpha", "sigma", "chad", "degen",
  "hodl", "moon", "lambo", "pump", "bull", "bear",

  // ===== FINANCE & DEFI =====
  "exchange", "market", "trade", "defi", "liquidity", "amm", "dex",
  "cex", "fee", "reward", "airdrop", "vest", "mint", "burn", "lend",
  "borrow", "yield", "farm", "harvest", "compound", "leverage",
  "margin", "futures", "options", "perps", "spot",

  // ===== IDENTITY & SOCIAL =====
  "name", "identity", "profile", "avatar", "bio", "link", "follow",
  "verified", "badge", "creator", "influencer", "artist", "musician",
  "gamer", "streamer", "trader", "analyst", "researcher",

  // ===== BRANDS & PLATFORMS (prevent impersonation) =====
  "binance", "coinbase", "kraken", "metamask", "uniswap", "opensea",
  "aave", "curve", "maker", "lido", "chainlink", "compound",
  "ledger", "trezor", "phantom", "rabby", "rainbow",
  "google", "apple", "amazon", "microsoft", "meta", "tesla",
  "twitter", "discord", "telegram", "reddit", "youtube", "tiktok",

  // ===== COMMON FIRST NAMES (high demand) =====
  "alice", "james", "john", "michael", "sarah", "david", "emma",
  "alex", "max", "sam", "chris", "dan", "tom", "jack", "nick",
  "ryan", "mark", "paul", "luke", "adam", "jason", "kevin",
  "brian", "eric", "matt", "mike", "steve", "peter", "joe",
  "maria", "anna", "lisa", "kate", "jane", "rachel", "laura",
  "emily", "sophie", "olivia", "ella", "mia", "noah", "leo",
  "omar", "ali", "ahmed", "hassan", "mohammed", "fatima", "aisha",

  // ===== UTILITY & SYSTEM =====
  "home", "root", "test", "demo", "info", "contact", "terms",
  "privacy", "search", "register", "renew", "manage", "settings",
  "app", "web", "welcome", "help", "support", "status", "blog",
  "news", "media", "press", "team", "about", "careers", "jobs"
];

// Deduplicate reserved names
const reservedNames = [...new Set(RESERVED_NAMES)];

// ============================================
// STEP 4: RESERVE NAMES
// ============================================
console.log('\n============================================');
console.log('STEP 4: Reserving names');
console.log('============================================');

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

// ============================================
// STEP 6: WRITE deployments.json (shared with QFLink)
// ============================================
console.log('\n============================================');
console.log('STEP 6: Writing deployments.json');
console.log('============================================');

const __dirname = dirname(fileURLToPath(import.meta.url));
const deploymentsPath = resolve(__dirname, 'deployments.json');

const deployments = {
  network: 'local',
  timestamp: new Date().toISOString(),
  contracts: {
    QNSRegistry: registryAddress,
    QNSRegistrar: registrarAddress,
    QNSResolver: resolverAddress
  }
};

writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
console.log(`✅ QNS addresses written to ${deploymentsPath}`);
console.log(JSON.stringify(deployments.contracts, null, 2));

// Export for potential external use
export { RESERVED_NAMES };
