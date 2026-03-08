// simulate.mjs — QNS real-world usage simulation
import { createWalletClient, createPublicClient, http, defineChain, parseEther, formatEther, keccak256, encodePacked, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';

// ============================================
// CONFIG
// ============================================
const RPC_URL = 'http://localhost:8545';
const CHAIN_ID = 42;
const DEPLOYER_KEY = '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133';

// Load contract addresses from .env.development
function loadEnv() {
  const envContent = readFileSync('.env.development', 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const match = line.match(/^VITE_(\w+)=(.+)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const REGISTRY_ADDRESS = env.QNS_REGISTRY_ADDRESS;
const REGISTRAR_ADDRESS = env.QNS_REGISTRAR_ADDRESS;
const RESOLVER_ADDRESS = env.QNS_RESOLVER_ADDRESS;

const qfChain = defineChain({
  id: CHAIN_ID,
  name: 'QF Local',
  nativeCurrency: { name: 'QF', symbol: 'QF', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ============================================
// ABIs (from src/config/contracts.ts)
// ============================================
const QNS_REGISTRAR_ABI = [
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
  {
    type: 'function',
    name: 'getNamesByOwner',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'string[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalRegistrations',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

const QNS_RESOLVER_ABI = [
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
    name: 'setName',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: '_name', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reverseResolve',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
];

// ============================================
// HELPERS
// ============================================
function namehash(name) {
  if (!name) return '0x0000000000000000000000000000000000000000000000000000000000000000';
  const labels = name.split('.').reverse();
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  for (const label of labels) {
    const labelHash = keccak256(new TextEncoder().encode(label));
    node = keccak256(encodePacked(['bytes32', 'bytes32'], [node, labelHash]));
  }
  return node;
}

function getPriceWei(name, price3Char, price4Char, price5PlusChar, permanentMultiplier, permanent) {
  const len = name.length;
  let base;
  if (len === 3) base = price3Char;
  else if (len === 4) base = price4Char;
  else base = price5PlusChar;

  if (permanent) return base * permanentMultiplier;
  return base;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN SIMULATION
// ============================================
async function main() {
  console.log('============================================');
  console.log('QNS REAL-WORLD USAGE SIMULATION');
  console.log('============================================');
  console.log(`Registry:  ${REGISTRY_ADDRESS}`);
  console.log(`Registrar: ${REGISTRAR_ADDRESS}`);
  console.log(`Resolver:  ${RESOLVER_ADDRESS}`);
  console.log('');

  // Setup deployer
  const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: qfChain,
    transport: http(RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: qfChain,
    transport: http(RPC_URL),
  });

  console.log(`Deployer: ${deployerAccount.address}`);
  console.log('');

  // Verify contracts are accessible
  console.log('Verifying contract deployment...');
  try {
    const totalReg = await publicClient.readContract({
      address: REGISTRAR_ADDRESS,
      abi: QNS_REGISTRAR_ABI,
      functionName: 'totalRegistrations',
    });
    console.log(`✅ Contracts accessible (totalRegistrations: ${totalReg})`);
  } catch (err) {
    console.error('❌ Cannot access registrar contract:', err.message?.slice(0, 80));
    process.exit(1);
  }
  console.log('');

  // Get contract prices
  const [price3Char, price4Char, price5PlusChar, permanentMultiplier] = await Promise.all([
    publicClient.readContract({ address: REGISTRAR_ADDRESS, abi: QNS_REGISTRAR_ABI, functionName: 'price3Char' }),
    publicClient.readContract({ address: REGISTRAR_ADDRESS, abi: QNS_REGISTRAR_ABI, functionName: 'price4Char' }),
    publicClient.readContract({ address: REGISTRAR_ADDRESS, abi: QNS_REGISTRAR_ABI, functionName: 'price5PlusChar' }),
    publicClient.readContract({ address: REGISTRAR_ADDRESS, abi: QNS_REGISTRAR_ABI, functionName: 'permanentMultiplier' }),
  ]);

  // ============================================
  // STEP 1: Generate 100 wallets
  // ============================================
  console.log('STEP 1: Generating 100 wallets...');
  const wallets = [];
  for (let i = 0; i < 100; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    wallets.push({ privateKey, account, address: account.address });
  }
  console.log(`✅ Generated ${wallets.length} wallets`);
  console.log('');

  // ============================================
  // STEP 2: Fund all 100 wallets
  // ============================================
  console.log('STEP 2: Funding wallets...');
  console.log('  Wallets 0-4: 5,000 QF each (for permanent registrations)');
  console.log('  Wallets 5-99: 2,000 QF each');
  let fundedCount = 0;
  const baseFundAmount = parseEther('2000');
  const permanentFundAmount = parseEther('5000');

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const fundAmount = i < 5 ? permanentFundAmount : baseFundAmount;
    try {
      const hash = await deployerWallet.sendTransaction({
        to: wallet.address,
        value: fundAmount,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      fundedCount++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Funded ${i + 1}/100 wallets...`);
      }
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to fund wallet ${i}: ${err.message?.slice(0, 80)}`);
    }
  }
  const totalFunded = parseEther('5000') * BigInt(5) + parseEther('2000') * BigInt(95);
  console.log(`✅ Funded ${fundedCount}/100 wallets (~${formatEther(totalFunded)} QF total)`);
  console.log('');

  // ============================================
  // STEP 3: Register names (100 wallets, 1 name each)
  // ============================================
  const names = [
    "alice", "marco", "stella", "nova", "pixel", "storm", "ember", "atlas", "lunar", "cedar",
    "river", "sage", "onyx", "iris", "felix", "hazel", "wolf", "raven", "jade", "blaze",
    "echo", "frost", "coral", "dusk", "aero", "bolt", "cleo", "drift", "eve", "flint",
    "glow", "haze", "ionic", "jinx", "karma", "lyric", "muse", "neon", "opal", "pulse",
    "quest", "ridge", "solar", "titan", "umbra", "vibe", "wren", "xenon", "yuma", "zephyr",
    "axel", "brix", "cipher", "delta", "elara", "forge", "glitch", "hydra", "ignis", "jolt",
    "koda", "lark", "mirth", "nexus", "orbit", "prism", "quill", "rust", "shard", "thorn",
    "ultra", "volt", "wisp", "xeno", "yonder", "zen", "amber", "brink", "crash", "dawn",
    "flare", "grain", "haven", "inlet", "juno", "keen", "lotus", "maple", "north", "ocean",
    "pine", "quartz", "rain", "silk", "teal", "unity", "vivid", "west", "yarrow", "zinc", "apex"
  ];

  console.log('STEP 3: Registering names (5+ char names permanent for first 5 wallets, rest annual)...');
  let registeredCount = 0;
  let permanentCount = 0;
  let annualCount = 0;
  const successfulRegistrations = new Set(); // Track which wallet indices succeeded

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const name = names[i];
    // Only make 5+ char names permanent (3-4 char names are too expensive for permanent with 2k budget)
    const isPermanent = i < 5 && name.length >= 5;
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const priceWei = getPriceWei(name, price3Char, price4Char, price5PlusChar, permanentMultiplier, isPermanent);

      const hash = await walletClient.writeContract({
        address: REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'register',
        args: [name, 1n, isPermanent],
        value: priceWei,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      registeredCount++;
      successfulRegistrations.add(i); // Track success
      if (isPermanent) permanentCount++;
      else annualCount++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Registered ${i + 1}/100 names...`);
      }
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to register '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Registered ${registeredCount}/100 names (${permanentCount} permanent, ${annualCount} annual)`);
  console.log('');

  // ============================================
  // STEP 4: 20 wallets register a second name
  // ============================================
  const secondNames = [
    "alpha2", "beta2", "gamma2", "delta2", "epsilon2", "zeta2", "theta2", "iota2", "kappa2", "lambda2",
    "sigma2", "omega2", "phi2", "chi2", "psi2", "rho2", "tau2", "upsilon2", "digamma2", "koppa2"
  ];

  console.log('STEP 4: Wallets 0-19 registering second names...');
  let secondNamesCount = 0;

  for (let i = 0; i < 20; i++) {
    const wallet = wallets[i];
    const name = secondNames[i];
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const priceWei = getPriceWei(name, price3Char, price4Char, price5PlusChar, permanentMultiplier, false);

      const hash = await walletClient.writeContract({
        address: REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'register',
        args: [name, 1n, false],
        value: priceWei,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      secondNamesCount++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to register second name '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Second names registered: ${secondNamesCount}/20`);
  console.log('');

  // ============================================
  // STEP 5: 30 wallets switch primary name
  // ============================================
  console.log('STEP 5: Switching primary names...');
  let primarySwitches = 0;

  // Wallets 0-19: switch to their second name
  for (let i = 0; i < 20; i++) {
    if (!successfulRegistrations.has(i)) {
      console.log(`  Skipped wallet ${i} — no registered name`);
      continue;
    }
    const wallet = wallets[i];
    const newName = secondNames[i];
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const cleanAddress = wallet.address.toLowerCase().slice(2);
      const reverseName = `${cleanAddress}.reverse`;
      const reverseNode = namehash(reverseName);

      const hash = await walletClient.writeContract({
        address: RESOLVER_ADDRESS,
        abi: QNS_RESOLVER_ABI,
        functionName: 'setName',
        args: [reverseNode, newName],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      primarySwitches++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to switch primary for wallet ${i}: ${err.message?.slice(0, 80)}`);
    }
  }

  // Wallets 20-29: call setPrimaryName with their existing name
  for (let i = 20; i < 30; i++) {
    if (!successfulRegistrations.has(i)) {
      console.log(`  Skipped wallet ${i} — no registered name`);
      continue;
    }
    const wallet = wallets[i];
    const name = names[i];
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const cleanAddress = wallet.address.toLowerCase().slice(2);
      const reverseName = `${cleanAddress}.reverse`;
      const reverseNode = namehash(reverseName);

      const hash = await walletClient.writeContract({
        address: RESOLVER_ADDRESS,
        abi: QNS_RESOLVER_ABI,
        functionName: 'setName',
        args: [reverseNode, name],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      primarySwitches++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to set primary for wallet ${i}: ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Primary switches: ${primarySwitches}/30`);
  console.log('');

  // ============================================
  // STEP 6: 50 wallets gift QF to other wallets
  // ============================================
  console.log('STEP 6: Wallets 50-99 gifting QF to wallets 0-49...');
  let giftsSent = 0;
  let totalGifted = 0n;

  for (let i = 50; i < 100; i++) {
    const sender = wallets[i];
    const recipientIndex = Math.floor(Math.random() * 50); // 0-49
    const recipient = wallets[recipientIndex];
    const giftAmount = parseEther(String(Math.floor(Math.random() * 191) + 10)); // 10-200 QF

    const walletClient = createWalletClient({
      account: sender.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const hash = await walletClient.sendTransaction({
        to: recipient.address,
        value: giftAmount,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      giftsSent++;
      totalGifted += giftAmount;
      console.log(`  Wallet ${i} gifted ${formatEther(giftAmount)} QF to wallet ${recipientIndex} (${names[recipientIndex]}.qf)`);
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Wallet ${i} failed to gift: ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Gifts sent: ${giftsSent}/50 (total: ${formatEther(totalGifted)} QF)`);
  console.log('');

  // ============================================
  // STEP 7: 15 wallets renew their names
  // ============================================
  console.log('STEP 7: Wallets 30-44 renewing names...');
  let renewals = 0;

  for (let i = 30; i < 45; i++) {
    const wallet = wallets[i];
    const name = names[i];
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const priceWei = getPriceWei(name, price3Char, price4Char, price5PlusChar, permanentMultiplier, false);

      const hash = await walletClient.writeContract({
        address: REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'renew',
        args: [name, 1n],
        value: priceWei,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      renewals++;
      console.log(`  Renewed '${name}' for wallet ${i}`);
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to renew '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Renewals: ${renewals}/15`);
  console.log('');

  // ============================================
  // STEP 8: 20 name transfers
  // ============================================
  console.log('STEP 8: Wallets 60-79 transferring names to wallets 0-19...');
  let transfers = 0;

  for (let i = 60; i < 80; i++) {
    if (!successfulRegistrations.has(i)) {
      console.log(`  Skipped wallet ${i} transfer — no registered name`);
      continue;
    }
    const sender = wallets[i];
    const recipient = wallets[i - 60]; // wallets 0-19
    const name = names[i];
    const walletClient = createWalletClient({
      account: sender.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      const hash = await walletClient.writeContract({
        address: REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'transferName',
        args: [name, recipient.address],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      transfers++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to transfer '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Transfers: ${transfers}/20`);
  console.log('');

  // ============================================
  // STEP 9: Admin assigns 10 reserved names
  // ============================================
  // Reserved names from deploy.mjs - must match exactly what was reserved
  // These are all 5+ characters to avoid pricing issues
  const reservedNames = [
    "qflink", "qfpad", "qfclash", "qfstream", "nucleusx",
    "quantumnotary", "governance", "treasury", "validator", "token"
  ];

  console.log('STEP 9: Admin assigning reserved names to wallets 80-89...');
  let reservedAssigned = 0;

  for (let i = 0; i < 10; i++) {
    const targetWallet = wallets[80 + i];
    const name = reservedNames[i];

    try {
      const hash = await deployerWallet.writeContract({
        address: REGISTRAR_ADDRESS,
        abi: QNS_REGISTRAR_ABI,
        functionName: 'assignReservedName',
        args: [name, targetWallet.address],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      reservedAssigned++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to assign '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Reserved names assigned: ${reservedAssigned}/10`);
  console.log('');

  // ============================================
  // STEP 10: 40 wallets set profile data
  // ============================================
  console.log('STEP 10: Wallets 0-39 setting profile data...');
  let profilesSet = 0;

  for (let i = 0; i < 40; i++) {
    if (!successfulRegistrations.has(i)) {
      console.log(`  Skipped wallet ${i} profile — no registered name`);
      continue;
    }
    const wallet = wallets[i];
    const name = names[i];
    const node = namehash(`${name}.qf`);
    const walletClient = createWalletClient({
      account: wallet.account,
      chain: qfChain,
      transport: http(RPC_URL),
    });

    try {
      // Set avatar
      let hash = await walletClient.writeContract({
        address: RESOLVER_ADDRESS,
        abi: QNS_RESOLVER_ABI,
        functionName: 'setText',
        args: [node, 'avatar', `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Set bio
      hash = await walletClient.writeContract({
        address: RESOLVER_ADDRESS,
        abi: QNS_RESOLVER_ABI,
        functionName: 'setText',
        args: [node, 'bio', `I'm ${name} on Quantum Fusion`],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Set twitter
      hash = await walletClient.writeContract({
        address: RESOLVER_ADDRESS,
        abi: QNS_RESOLVER_ABI,
        functionName: 'setText',
        args: [node, 'twitter', `${name}_qf`],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      profilesSet++;
      await sleep(100);
    } catch (err) {
      console.log(`  ⚠️ Failed to set profile for '${name}': ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`✅ Profiles set: ${profilesSet}/40`);
  console.log('');

  // ============================================
  // STEP 11: Print summary
  // ============================================
  const registrarBalance = await publicClient.getBalance({ address: REGISTRAR_ADDRESS });

  console.log('============================================');
  console.log('QNS SIMULATION COMPLETE');
  console.log('============================================');
  console.log(`Wallets created:        100`);
  console.log(`Wallets funded:         ${fundedCount} (~${formatEther(totalFunded)} QF total)`);
  console.log(`Names registered:       ${registeredCount}/100 (${permanentCount} permanent, ${annualCount} annual)`);
  console.log(`Second names:           ${secondNamesCount}/20`);
  console.log(`Primary switches:       ${primarySwitches}/30`);
  console.log(`Gifts sent:             ${giftsSent}/50 (total: ${formatEther(totalGifted)} QF)`);
  console.log(`Renewals:               ${renewals}/15`);
  console.log(`Transfers:              ${transfers}/20`);
  console.log(`Reserved assigned:      ${reservedAssigned}/10`);
  console.log(`Profiles set:           ${profilesSet}/40`);
  console.log(`Registrar balance:      ${formatEther(registrarBalance)} QF`);
  console.log('============================================');
}

main().catch(err => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
