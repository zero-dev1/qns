// deploy-mainnet.mjs — QNS mainnet deployment script for QF Network
// Usage: DEPLOYER_SEED="0x..." TREASURY_ADDRESS="0x..." BURN_ADDRESS="0x..." node deploy-mainnet.mjs
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { keccakAsU8a, decodeAddress } from '@polkadot/util-crypto';
import { stringToHex, u8aToHex } from '@polkadot/util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';

// ============================================
// CONFIGURATION
// ============================================
const MAINNET_RPC_URL = 'wss://mainnet.qfnode.net';
const COMBINED_JSON_PATH = './contracts/combined.json';
const RESERVED_NAMES_PATH = './reserved-names.json';

// Environment variables (required)
const DEPLOYER_SEED = process.env.DEPLOYER_SEED;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const BURN_ADDRESS = process.env.BURN_ADDRESS || '0x000000000000000000000000000000000000dEaD';

// Batch size for reserved names (to stay within gas limits)
const RESERVED_NAMES_BATCH_SIZE = 30;

// ============================================
// VALIDATION
// ============================================
if (!DEPLOYER_SEED) {
  console.error('❌ Error: DEPLOYER_SEED environment variable is required');
  console.error('   Example: DEPLOYER_SEED="0x..." node deploy-mainnet.mjs');
  process.exit(1);
}

if (!TREASURY_ADDRESS) {
  console.error('❌ Error: TREASURY_ADDRESS environment variable is required');
  console.error('   Example: TREASURY_ADDRESS="0x..." node deploy-mainnet.mjs');
  process.exit(1);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert SS58 Substrate address to EVM H160 address
 */
function substrateToEvmAddress(ss58Address) {
  if (typeof ss58Address === 'string' && ss58Address.startsWith('0x')) {
    const hex = ss58Address.slice(2);
    if (hex.length === 40) {
      return ss58Address.toLowerCase();
    }
  }
  
  const publicKey = decodeAddress(ss58Address);
  const hash = keccakAsU8a(publicKey);
  return u8aToHex(hash.slice(12));
}

/**
 * Load contract artifact from combined.json
 */
function loadContractArtifact(contractName) {
  const raw = JSON.parse(readFileSync(COMBINED_JSON_PATH, 'utf-8'));
  
  const contractKey = Object.keys(raw.contracts).find(k => {
    const parts = k.split(':');
    return parts[parts.length - 1] === contractName;
  });
  
  if (!contractKey) {
    throw new Error(`Contract ${contractName} not found in combined.json`);
  }
  
  const contractData = raw.contracts[contractKey];
  
  if (!contractData.bin) {
    throw new Error(`Contract ${contractName} has no bytecode`);
  }
  
  const abi = typeof contractData.abi === 'string' ? JSON.parse(contractData.abi) : contractData.abi;
  const bytecode = contractData.bin.startsWith('0x') ? contractData.bin : '0x' + contractData.bin;
  
  return { abi, bytecode };
}

/**
 * Encode constructor arguments using ethers.js Interface
 */
function encodeConstructorArgs(abi, args = []) {
  const constructorAbi = abi.find(item => item.type === 'constructor');
  
  if (!constructorAbi || args.length === 0) {
    if (args.length > 0) {
      throw new Error('Arguments provided but no constructor found in ABI');
    }
    return '0x';
  }
  
  const iface = new ethers.Interface(abi);
  const encoded = iface.encodeDeploy(args);
  return encoded;
}

/**
 * Deploy contract using pallet-revive's instantiateWithCode extrinsic
 */
async function deployContract(api, deployer, name, artifact, args = [], options = {}) {
  console.log(`\n--- Deploying ${name}${args.length ? ' with args: ' + JSON.stringify(args).slice(0, 100) : ''} ---`);
  
  const { abi, bytecode } = artifact;
  const constructorData = encodeConstructorArgs(abi, args);
  
  const code = bytecode;
  const data = constructorData === '0x' ? '' : constructorData;
  
  const gasLimit = options.gasLimit;
  const storageDepositLimit = options.storageDepositLimit;
  const value = options.value || BigInt(0);
  
  console.log(`     Code size: ${(code.length - 2) / 2} bytes`);
  console.log(`     Data size: ${data.length > 2 ? (data.length - 2) / 2 : 0} bytes`);
  
  const tx = api.tx.revive.instantiateWithCode(
    value,
    gasLimit,
    storageDepositLimit,
    code,
    data,
    null
  );
  
  console.log(`  ⏳ Waiting for finalization...`);
  
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deployment timed out after 180 seconds'));
    }, 180000);
    
    // CRITICAL: withSignedTransaction: false for CheckMetadataHash fix
    tx.signAndSend(deployer, { withSignedTransaction: false }, ({ status, events, dispatchError, txHash }) => {
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
        console.log(`  📦 Included in block: ${status.asInBlock.toHex()}`);
      }
      
      if (status.isFinalized) {
        clearTimeout(timeout);
        console.log(`  ✅ Finalized in block: ${status.asFinalized.toHex()}`);
        
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
        
        resolve({
          blockHash: status.asFinalized.toHex(),
          contractAddress,
          events,
        });
      }
    }).catch(err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  
  if (!result.contractAddress) {
    throw new Error(`${name} deployment failed — no contract address found in events`);
  }
  
  console.log(`\n  ✅ ${name} deployed at: ${result.contractAddress}`);
  return result.contractAddress;
}

/**
 * Call a contract function using pallet-revive's call extrinsic
 */
async function callContract(api, deployer, contractAddress, abi, methodName, args = [], options = {}) {
  console.log(`\n  📞 Calling ${methodName}(${args.map(a => typeof a === 'string' && a.startsWith('0x') ? a.slice(0, 20) + '...' : a).join(', ')})`);
  
  const fnAbi = abi.find(item => item.type === 'function' && item.name === methodName);
  if (!fnAbi) {
    throw new Error(`Function ${methodName} not found in ABI`);
  }
  
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(methodName, args);
  
  const gasLimit = options.gasLimit;
  const value = options.value || BigInt(0);
  const storageDepositLimit = options.storageDepositLimit;
  
  const tx = api.tx.revive.call(
    contractAddress,
    value,
    gasLimit,
    storageDepositLimit,
    data
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transaction timed out after 120 seconds'));
    }, 120000);
    
    // CRITICAL: withSignedTransaction: false for CheckMetadataHash fix
    tx.signAndSend(deployer, { withSignedTransaction: false }, ({ status, dispatchError, events }) => {
      if (dispatchError) {
        clearTimeout(timeout);
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          
          console.error('\n  ❌ Transaction failed. Events:');
          events.forEach(({ event }) => {
            console.error(`     ${event.section}.${event.method}:`, event.data.toHuman());
          });
          
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }
      
      if (status.isInBlock) {
        console.log(`     📦 Included in block: ${status.asInBlock.toHex()}`);
      }
      
      if (status.isFinalized) {
        clearTimeout(timeout);
        console.log(`     ✅ ${methodName} succeeded`);
        resolve(status.asFinalized.toHex());
      }
    }).catch(err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Load reserved names from JSON file
 */
function loadReservedNames() {
  if (!existsSync(RESERVED_NAMES_PATH)) {
    console.warn(`⚠️  Reserved names file not found: ${RESERVED_NAMES_PATH}`);
    console.warn('   Skipping reserved names setup.');
    return [];
  }
  
  const data = JSON.parse(readFileSync(RESERVED_NAMES_PATH, 'utf-8'));
  console.log(`\n📋 Loaded ${data.names.length} reserved names from ${RESERVED_NAMES_PATH}`);
  return data.names;
}

/**
 * Reserve names in batches to avoid gas limits
 */
async function reserveNamesInBatches(api, deployer, registrarAddress, registrarAbi, names, gasLimits, storageDeposit) {
  console.log('\n============================================');
  console.log('RESERVING NAMES (BATCHED)');
  console.log('============================================');
  console.log(`Total names: ${names.length}`);
  console.log(`Batch size: ${RESERVED_NAMES_BATCH_SIZE}`);
  
  // Check if registrar has batchReserveNames function
  const hasBatchFunction = registrarAbi.some(item => 
    item.type === 'function' && item.name === 'batchReserveNames'
  );
  
  if (hasBatchFunction) {
    console.log('Using batchReserveNames for efficiency');
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < names.length; i += RESERVED_NAMES_BATCH_SIZE) {
      batches.push(names.slice(i, i + RESERVED_NAMES_BATCH_SIZE));
    }
    
    console.log(`Processing ${batches.length} batches...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n  Batch ${i + 1}/${batches.length} (${batch.length} names)...`);
      
      try {
        await callContract(api, deployer, registrarAddress, registrarAbi, 'batchReserveNames', [batch], {
          gasLimit: gasLimits.postDeploy,
          storageDepositLimit: storageDeposit,
        });
        successCount += batch.length;
      } catch (err) {
        console.error(`     ❌ Batch ${i + 1} failed: ${err.message}`);
        failCount += batch.length;
      }
      
      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    console.log(`\n  ✅ Reserved: ${successCount}/${names.length} (${failCount} failed)`);
    return { successCount, failCount };
  } else {
    console.log('batchReserveNames not found, falling back to individual reserveName calls');
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if ((i + 1) % 10 === 0 || i === 0 || i === names.length - 1) {
        console.log(`  Progress: ${i + 1}/${names.length} - Reserving "${name}"...`);
      }
      
      try {
        await callContract(api, deployer, registrarAddress, registrarAbi, 'reserveName', [name], {
          gasLimit: gasLimits.postDeploy,
          storageDepositLimit: storageDeposit,
        });
        successCount++;
      } catch (err) {
        console.error(`     ❌ Failed to reserve "${name}": ${err.message.slice(0, 80)}`);
        failCount++;
      }
      
      // Small delay every 10 names
      if ((i + 1) % 10 === 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    console.log(`\n  ✅ Reserved: ${successCount}/${names.length} (${failCount} failed)`);
    return { successCount, failCount };
  }
}

// ============================================
// MAIN DEPLOYMENT
// ============================================

async function main() {
  console.log('============================================');
  console.log('QNS MAINNET DEPLOYMENT');
  console.log('============================================');
  console.log(`RPC URL: ${MAINNET_RPC_URL}`);
  console.log(`Treasury: ${TREASURY_ADDRESS}`);
  console.log(`Burn: ${BURN_ADDRESS}`);
  console.log('');
  
  // Check if contracts are compiled
  if (!existsSync(COMBINED_JSON_PATH)) {
    console.error('❌ contracts/combined.json not found. Please compile contracts first:');
    console.error('   resolc contracts/QNSRegistry.sol contracts/QNSResolver.sol contracts/QNSRegistrar.sol --combined-json abi,bin -o contracts/ --overwrite');
    process.exit(1);
  }
  
  // Connect to mainnet
  console.log('📡 Connecting to QF Mainnet...');
  const provider = new WsProvider(MAINNET_RPC_URL);
  
  const connectionTimeout = setTimeout(() => {
    console.error(`\n❌ Could not connect to mainnet at ${MAINNET_RPC_URL}`);
    process.exit(1);
  }, 15000);
  
  let api;
  try {
    api = await ApiPromise.create({ provider });
    clearTimeout(connectionTimeout);
  } catch (err) {
    clearTimeout(connectionTimeout);
    console.error(`\n❌ Connection failed: ${err.message}`);
    process.exit(1);
  }
  
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  
  console.log(`✅ Connected to ${chain}`);
  console.log(`   Node: ${nodeName} v${nodeVersion}\n`);
  
  // Verify pallet-revive is available
  if (!api.tx.revive) {
    console.error('❌ pallet-revive not found on this chain!');
    await api.disconnect();
    process.exit(1);
  }
  
  // Query chain limits
  console.log('⚖️  Querying chain limits...');
  const blockWeights = api.consts.system.blockWeights;
  const maxExtrinsic = blockWeights.perClass.normal.maxExtrinsic.unwrap();
  
  console.log(`   Max extrinsic refTime:  ${maxExtrinsic.refTime.toString()}`);
  console.log(`   Max extrinsic proofSize: ${maxExtrinsic.proofSize.toString()}`);
  
  // Setup deployer account
  console.log('\n🔑 Loading deployer account from DEPLOYER_SEED...');
  const keyring = new Keyring({ type: 'sr25519' });
  const deployer = keyring.addFromUri(DEPLOYER_SEED);
  const deployerEvmAddress = substrateToEvmAddress(deployer.address);
  
  console.log(`   SS58 Address: ${deployer.address}`);
  console.log(`   EVM Address:  ${deployerEvmAddress}`);
  
  // Check deployer's balance
  const { data: balance } = await api.query.system.account(deployer.address);
  const freeBalance = balance.free.toBigInt();
  console.log(`   Free balance: ${freeBalance.toString()} (${(Number(freeBalance) / 1e18).toFixed(4)} QF)`);
  
  if (freeBalance === 0n) {
    console.error('❌ Error: Deployer account has zero balance');
    process.exit(1);
  }
  
  // Warn if low balance (less than 100 QF)
  if (freeBalance < 100n * 10n ** 18n) {
    console.warn('⚠️  Warning: Deployer balance is low (< 100 QF). Deployment may fail due to insufficient funds.');
  }
  
  // Map deployer account (required for pallet-revive contract interactions)
  console.log('\n🗺️  Mapping deployer account...');
  try {
    await new Promise((resolve, reject) => {
      api.tx.revive.mapAccount().signAndSend(deployer, { withSignedTransaction: false }, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            if (decoded.name.includes('AlreadyMapped') || decoded.name.includes('AccountAlreadyMapped')) {
              console.log('  ✅ Deployer already mapped');
              resolve();
              return;
            }
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            const err = dispatchError.toString();
            if (err.includes('AlreadyMapped')) { resolve(); return; }
            reject(new Error(err));
          }
          return;
        }
        if (status.isFinalized) {
          console.log('  ✅ Deployer account mapped successfully');
          resolve();
        }
      }).catch(reject);
    });
  } catch (err) {
    console.warn('⚠️  mapAccount warning:', err.message);
  }
  
  // Calculate gas limits
  console.log('\n🔧 Calculating gas limits...');
  
  const maxRefTime = maxExtrinsic.refTime.toBigInt();
  const maxProofSize = maxExtrinsic.proofSize.toBigInt();
  
  // Deploy gas: 75% of max extrinsic
  const deployRefTime = maxRefTime * 75n / 100n;
  const deployProofSize = maxProofSize * 75n / 100n;
  
  const DEPLOY_GAS_LIMIT = api.registry.createType('Weight', {
    refTime: deployRefTime,
    proofSize: deployProofSize,
  });
  
  // Post-deploy gas: 50% of max extrinsic
  const postDeployRefTime = maxRefTime * 50n / 100n;
  const postDeployProofSize = maxProofSize * 50n / 100n;
  
  const POST_DEPLOY_GAS_LIMIT = api.registry.createType('Weight', {
    refTime: postDeployRefTime,
    proofSize: postDeployProofSize,
  });
  
  // Storage deposit limits
  const deployStorageDeposit = freeBalance / 10n;
  const callStorageDeposit = freeBalance / 100n;
  
  console.log(`   Deploy gas: refTime=${deployRefTime.toString()}, proofSize=${deployProofSize.toString()}`);
  console.log(`   Call gas:   refTime=${postDeployRefTime.toString()}, proofSize=${postDeployProofSize.toString()}`);
  console.log(`   Deploy storage deposit: ${deployStorageDeposit.toString()}`);
  console.log(`   Call storage deposit:   ${callStorageDeposit.toString()}`);
  console.log('');
  
  // Load contract artifacts
  console.log('📦 Loading contract artifacts...');
  const artifacts = {};
  try {
    artifacts.registry = loadContractArtifact('QNSRegistry');
    console.log('  ✅ QNSRegistry loaded');
    
    artifacts.resolver = loadContractArtifact('QNSResolver');
    console.log('  ✅ QNSResolver loaded');
    
    artifacts.registrar = loadContractArtifact('QNSRegistrar');
    console.log('  ✅ QNSRegistrar loaded');
    console.log('');
  } catch (err) {
    console.error(`❌ Failed to load artifacts: ${err.message}`);
    process.exit(1);
  }
  
  // ============================================
  // STEP 1: Deploy Contracts
  // ============================================
  console.log('============================================');
  console.log('STEP 1: Deploying Contracts');
  console.log('============================================');
  
  let registryAddress, resolverAddress, registrarAddress;
  
  // Deploy Registry
  try {
    console.log('\n--- Deploying QNSRegistry ---');
    registryAddress = await deployContract(api, deployer, 'QNSRegistry', artifacts.registry, [], {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Registry deployment failed:', err.message);
    await api.disconnect();
    process.exit(1);
  }
  
  // Deploy Resolver
  try {
    console.log('\n--- Deploying QNSResolver ---');
    resolverAddress = await deployContract(api, deployer, 'QNSResolver', artifacts.resolver, [registryAddress], {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Resolver deployment failed:', err.message);
    await api.disconnect();
    process.exit(1);
  }
  
  // Deploy Registrar
  try {
    console.log('\n--- Deploying QNSRegistrar ---');
    
    // Ensure addresses are proper EVM format
    const treasuryEvmAddress = TREASURY_ADDRESS.startsWith('0x') 
      ? TREASURY_ADDRESS.toLowerCase()
      : substrateToEvmAddress(TREASURY_ADDRESS);
    
    const burnEvmAddress = BURN_ADDRESS.startsWith('0x')
      ? BURN_ADDRESS.toLowerCase()
      : substrateToEvmAddress(BURN_ADDRESS);
    
    console.log(`   Registry:  ${registryAddress}`);
    console.log(`   Resolver:  ${resolverAddress}`);
    console.log(`   Treasury:  ${treasuryEvmAddress}`);
    console.log(`   Burn:      ${burnEvmAddress}`);
    
    const constructorArgs = [
      registryAddress,
      resolverAddress,
      treasuryEvmAddress,
      burnEvmAddress,
    ];
    
    registrarAddress = await deployContract(api, deployer, 'QNSRegistrar', artifacts.registrar, constructorArgs, {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Registrar deployment failed:', err.message);
    await api.disconnect();
    process.exit(1);
  }
  
  // ============================================
  // STEP 2: Wire Contracts (Post-Deploy Setup)
  // ============================================
  console.log('\n============================================');
  console.log('STEP 2: Wiring Contracts (Post-Deploy Setup)');
  console.log('============================================');
  
  try {
    // Node hashes
    const rootNode = '0x' + '00'.repeat(32);
    const qfLabelHash = ethers.keccak256(ethers.toUtf8Bytes('qf'));
    const reverseLabelHash = ethers.keccak256(ethers.toUtf8Bytes('reverse'));
    const qfNode = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [rootNode, qfLabelHash]));
    
    console.log(`  Root node:          ${rootNode}`);
    console.log(`  .qf label hash:     ${qfLabelHash}`);
    console.log(`  .reverse label:     ${reverseLabelHash}`);
    console.log(`  .qf node:           ${qfNode}`);
    console.log(`  Deployer EVM addr:  ${deployerEvmAddress}`);
    console.log(`  Registrar EVM addr: ${registrarAddress}`);
    console.log(`  Resolver EVM addr:  ${resolverAddress}`);
    
    const gasLimits = {
      postDeploy: POST_DEPLOY_GAS_LIMIT,
    };
    
    // Step 2a: Set .qf owner to deployer temporarily
    console.log('\n  [2a] Setting .qf owner to deployer (temporary)...');
    await callContract(api, deployer, registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, qfLabelHash, deployerEvmAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    // Step 2b: Set .reverse owner to Registrar
    console.log('\n  [2b] Setting .reverse owner to Registrar...');
    await callContract(api, deployer, registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, reverseLabelHash, registrarAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    // Step 2c: Set .qf resolver to Resolver
    console.log('\n  [2c] Setting .qf resolver to Resolver...');
    await callContract(api, deployer, registryAddress, artifacts.registry.abi, 'setResolver',
      [qfNode, resolverAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    // Step 2d: Set .qf owner to Registrar (permanent)
    console.log('\n  [2d] Setting .qf owner to Registrar (permanent)...');
    await callContract(api, deployer, registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, qfLabelHash, registrarAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    // Step 2e: Authorize Registrar in Resolver
    console.log('\n  [2e] Authorizing Registrar in Resolver...');
    await callContract(api, deployer, resolverAddress, artifacts.resolver.abi, 'addAuthorizedCaller',
      [registrarAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    // Step 2f: Set default resolver on Registrar
    console.log('\n  [2f] Setting default resolver on Registrar...');
    await callContract(api, deployer, registrarAddress, artifacts.registrar.abi, 'setDefaultResolver',
      [resolverAddress],
      { gasLimit: POST_DEPLOY_GAS_LIMIT, storageDepositLimit: callStorageDeposit }
    );
    
    console.log('\n  ✅ All contract wiring complete!');
    
  } catch (err) {
    console.error('\n❌ Contract wiring failed:', err.message);
    await api.disconnect();
    process.exit(1);
  }
  
  // ============================================
  // STEP 3: Load Reserved Names
  // ============================================
  console.log('');
  const reservedNames = loadReservedNames();
  let reservedResults = { successCount: 0, failCount: 0 };
  
  if (reservedNames.length > 0) {
    try {
      reservedResults = await reserveNamesInBatches(
        api, deployer, registrarAddress, artifacts.registrar.abi,
        reservedNames, { postDeploy: POST_DEPLOY_GAS_LIMIT }, callStorageDeposit
      );
    } catch (err) {
      console.error('\n❌ Reserved names setup failed:', err.message);
      // Don't exit - we can continue without reserved names if needed
    }
  }
  
  // ============================================
  // STEP 4: Output Results
  // ============================================
  console.log('\n============================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('============================================');
  console.log('');
  console.log('CONTRACT ADDRESSES:');
  console.log('-------------------');
  console.log(`VITE_QNS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`VITE_QNS_RESOLVER_ADDRESS=${resolverAddress}`);
  console.log(`VITE_QNS_REGISTRAR_ADDRESS=${registrarAddress}`);
  console.log('');
  console.log('CONFIGURATION:');
  console.log('--------------');
  console.log(`VITE_QF_RPC_URL=${MAINNET_RPC_URL}`);
  console.log(`VITE_TREASURY_ADDRESS=${TREASURY_ADDRESS}`);
  console.log(`VITE_BURN_ADDRESS=${BURN_ADDRESS}`);
  console.log(`VITE_CHAIN_ID=1`);
  console.log('');
  console.log('RESERVED NAMES:');
  console.log('---------------');
  console.log(`Total: ${reservedNames.length}`);
  console.log(`Successfully reserved: ${reservedResults.successCount}`);
  console.log(`Failed: ${reservedResults.failCount}`);
  console.log('');
  console.log('DEPLOYER INFO:');
  console.log('--------------');
  console.log(`SS58: ${deployer.address}`);
  console.log(`EVM:  ${deployerEvmAddress}`);
  console.log('');
  console.log('============================================');
  console.log('NEXT STEPS:');
  console.log('============================================');
  console.log('1. Copy the contract addresses above to your .env.production file');
  console.log('2. Verify contracts on the QF explorer');
  console.log('3. Test name registration via the QNS frontend');
  console.log('');
  
  await api.disconnect();
  console.log('✅ Done!');
}

// Run with error handling
main().catch(err => {
  console.error('\n❌ Deployment failed:');
  console.error(err.message || err);
  if (err.stack) {
    console.error('\nStack trace:');
    console.error(err.stack);
  }
  process.exit(1);
});
