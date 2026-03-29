// deploy-badge-registry.mjs — Deploy QNSBadgeRegistry to QF Mainnet
// Usage: DEPLOYER_SEED="0x..." node deploy-badge-registry.mjs
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { readFileSync } from 'fs';

// ============================================
// CONFIGURATION
// ============================================
const MAINNET_RPC_URL = 'wss://mainnet.qfnode.net';
const COMBINED_JSON_PATH = './output/combined.json';

const DEPLOYER_SEED = process.env.DEPLOYER_SEED;

if (!DEPLOYER_SEED) {
  console.error('❌ Error: DEPLOYER_SEED environment variable is required');
  console.error('   Usage: DEPLOYER_SEED="0x..." node deploy-badge-registry.mjs');
  process.exit(1);
}

// ============================================
// LOAD CONTRACT ARTIFACT
// ============================================
function loadBadgeRegistryArtifact() {
  const raw = JSON.parse(readFileSync(COMBINED_JSON_PATH, 'utf-8'));

  const contractKey = Object.keys(raw.contracts).find(k => {
    const parts = k.split(':');
    return parts[parts.length - 1] === 'QNSBadgeRegistry';
  });

  if (!contractKey) {
    throw new Error('QNSBadgeRegistry not found in combined.json');
  }

  const contractData = raw.contracts[contractKey];

  if (!contractData.bin) {
    throw new Error('QNSBadgeRegistry has no bytecode');
  }

  const bytecode = contractData.bin.startsWith('0x') ? contractData.bin : '0x' + contractData.bin;
  return { bytecode };
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('============================================');
  console.log('QNSBadgeRegistry DEPLOYMENT');
  console.log('============================================');
  console.log(`RPC: ${MAINNET_RPC_URL}\n`);

  // Load artifact
  console.log('📦 Loading contract artifact...');
  const { bytecode } = loadBadgeRegistryArtifact();
  console.log(`   Bytecode size: ${(bytecode.length - 2) / 2} bytes\n`);

  // Connect
  console.log('📡 Connecting to QF Mainnet...');
  const provider = new WsProvider(MAINNET_RPC_URL);

  const connectionTimeout = setTimeout(() => {
    console.error(`\n❌ Could not connect to ${MAINNET_RPC_URL}`);
    process.exit(1);
  }, 15000);

  const api = await ApiPromise.create({ provider });
  clearTimeout(connectionTimeout);

  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);

  console.log(`✅ Connected to ${chain}`);
  console.log(`   Node: ${nodeName} v${nodeVersion}\n`);

  // Deployer
  console.log('🔑 Loading deployer account...');
  const keyring = new Keyring({ type: 'sr25519' });
  const deployer = keyring.addFromUri(DEPLOYER_SEED);
  console.log(`   SS58 Address: ${deployer.address}`);

  const { data: balance } = await api.query.system.account(deployer.address);
  const freeBalance = balance.free.toBigInt();
  console.log(`   Balance: ${(Number(freeBalance) / 1e18).toFixed(4)} QF\n`);

  if (freeBalance === 0n) {
    console.error('❌ Deployer has zero balance');
    await api.disconnect();
    process.exit(1);
  }

  // Gas limits — same calculation as deploy-mainnet.mjs
  console.log('⚖️  Calculating gas limits...');
  const blockWeights = api.consts.system.blockWeights;
  const maxExtrinsic = blockWeights.perClass.normal.maxExtrinsic.unwrap();
  const maxRefTime = maxExtrinsic.refTime.toBigInt();
  const maxProofSize = maxExtrinsic.proofSize.toBigInt();

  const deployRefTime = maxRefTime * 75n / 100n;
  const deployProofSize = maxProofSize * 75n / 100n;

  const gasLimit = api.registry.createType('Weight', {
    refTime: deployRefTime,
    proofSize: deployProofSize,
  });

  const storageDepositLimit = freeBalance / 10n;

  console.log(`   refTime:  ${deployRefTime.toString()}`);
  console.log(`   proofSize: ${deployProofSize.toString()}`);
  console.log(`   storageDeposit: ${storageDepositLimit.toString()}\n`);

  // Deploy — no constructor args, no value, no data
  console.log('🚀 Deploying QNSBadgeRegistry...');

  const tx = api.tx.revive.instantiateWithCode(
    BigInt(0),           // value
    gasLimit,            // gasLimit
    storageDepositLimit, // storageDepositLimit
    bytecode,            // code
    '',                  // data (no constructor args)
    null                 // salt
  );

  console.log('⏳ Waiting for finalization...\n');

  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deployment timed out after 180 seconds'));
    }, 180000);

    tx.signAndSend(deployer, { withSignedTransaction: false }, ({ status, events, dispatchError }) => {
      if (dispatchError) {
        clearTimeout(timeout);
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          const { docs, name, section } = decoded;
          reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock) {
        console.log(`📦 Included in block: ${status.asInBlock.toHex()}`);
      }

      if (status.isFinalized) {
        clearTimeout(timeout);
        console.log(`✅ Finalized in block: ${status.asFinalized.toHex()}`);

        let contractAddress = null;
        for (const { event } of events) {
          const { section, method, data } = event;
          if (section === 'revive' && method === 'Instantiated') {
            if (data.length >= 2) {
              contractAddress = data[1]?.toString();
            }
            break;
          }
        }

        resolve({ blockHash: status.asFinalized.toHex(), contractAddress });
      }
    }).catch(err => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  if (!result.contractAddress) {
    console.error('❌ Deployment failed — no contract address found in events');
    await api.disconnect();
    process.exit(1);
  }

  // Output
  console.log('\n============================================');
  console.log('✅ DEPLOYMENT SUCCESSFUL');
  console.log('============================================\n');
  console.log(`📍 Contract Address: ${result.contractAddress}`);
  console.log(`🔍 Block Hash: ${result.blockHash}\n`);
  console.log('NEXT STEPS:');
  console.log(`1. Add to Vercel env: VITE_QNS_BADGE_REGISTRY_ADDRESS=${result.contractAddress}`);
  console.log('2. Push frontend changes');
  console.log('3. Verify at /admin → Badges section\n');
  console.log('🧹 Clear your terminal to remove any trace of your seed.\n');

  await api.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error('\n❌ Deployment failed:', err.message || err);
  process.exit(1);
});
