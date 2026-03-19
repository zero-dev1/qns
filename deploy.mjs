// deploy.mjs — QNS deployment script for QF Network (pallet-revive via raw extrinsics)
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { keccakAsU8a, decodeAddress } from '@polkadot/util-crypto';
import { stringToHex, u8aToHex } from '@polkadot/util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables from .env.development
dotenv.config({ path: '.env.development' });

// ============================================
// CONFIG
// ============================================
const RPC_URL = process.env.VITE_QF_RPC_URL || 'ws://localhost:9944';
const DEPLOYER_SEED = process.env.DEPLOYER_SEED || '//Alice';
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || null;
const BURN_ADDRESS = process.env.BURN_ADDRESS || '0x000000000000000000000000000000000000dEaD';

// Contract artifact paths
const COMBINED_JSON_PATH = './contracts/combined.json';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert SS58 Substrate address to EVM H160 address
 * Derivation: keccak256(publicKey) -> last 20 bytes
 */
function substrateToEvmAddress(ss58Address) {
  // If it's already an EVM address (0x prefix, 40 hex chars), return as-is
  if (typeof ss58Address === 'string' && ss58Address.startsWith('0x')) {
    const hex = ss58Address.slice(2);
    if (hex.length === 40) {
      return ss58Address.toLowerCase();
    }
  }
  
  // Decode SS58 address to get the 32-byte public key
  const publicKey = decodeAddress(ss58Address);
  const hash = keccakAsU8a(publicKey);
  // Take last 20 bytes as EVM address
  return u8aToHex(hash.slice(12));
}

/**
 * Convert address to EVM H160 format (20 bytes)
 * Handles both SS58 (Substrate) and H160 addresses
 */
function toEvmAddress(address) {
  // If it's already a hex string starting with 0x
  if (typeof address === 'string' && address.startsWith('0x')) {
    const hex = address.slice(2);
    if (hex.length === 40) {
      // Already 20 bytes
      return address.toLowerCase();
    }
    // If longer, truncate to 20 bytes
    if (hex.length > 40) {
      return '0x' + hex.slice(-40).toLowerCase();
    }
  }
  
  // For SS58 addresses, return as-is for now
  return address.toLowerCase();
}

/**
 * Load contract artifact from combined.json (resolc output)
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
    throw new Error(`Contract ${contractName} has no bytecode - might be an interface`);
  }
  
  const abi = typeof contractData.abi === 'string' ? JSON.parse(contractData.abi) : contractData.abi;
  const bytecode = contractData.bin.startsWith('0x') ? contractData.bin : '0x' + contractData.bin;
  
  const objectFormat = contractData['object-format'];
  if (objectFormat !== 'PVM') {
    console.warn(`  ⚠️  Warning: Expected PVM format, got ${objectFormat}`);
  }
  
  return { abi, bytecode, objectFormat };
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
  
  // encoded includes bytecode prefix, return full data for instantiateWithCode
  return encoded;
}

/**
 * Deploy contract using pallet-revive's instantiateWithCode extrinsic
 */
async function deployContract(api, deployer, name, artifact, args = [], options = {}) {
  console.log(`\n--- Deploying ${name}${args.length ? ' with args: ' + JSON.stringify(args).slice(0, 100) : ''} ---`);
  
  const { abi, bytecode } = artifact;
  
  // Encode constructor arguments
  const constructorData = encodeConstructorArgs(abi, args);
  console.log(`  Constructor data: ${constructorData.slice(0, 50)}...`);
  
  // For instantiateWithCode, we separate code and data
  const code = bytecode; // Hex string
  const data = constructorData === '0x' ? '' : constructorData; // Remove 0x prefix if empty
  
  // Get limits from options or use defaults
  const gasLimit = options.gasLimit;
  const storageDepositLimit = options.storageDepositLimit;
  const value = options.value || BigInt(0);
  
  // Log all parameters before sending
  console.log('\n  📋 Deployment Parameters:');
  console.log(`     Value: ${value.toString()}`);
  console.log(`     Gas refTime: ${gasLimit.refTime.toString()}`);
  console.log(`     Gas proofSize: ${gasLimit.proofSize.toString()}`);
  console.log(`     Storage deposit limit: ${storageDepositLimit ? storageDepositLimit.toString() : 'null'}`);
  console.log(`     Code size: ${(code.length - 2) / 2} bytes`);
  console.log(`     Data size: ${data.length > 2 ? (data.length - 2) / 2 : 0} bytes`);
  
  // Create the instantiateWithCode transaction
  // Parameter order: value, gasLimit, storageDepositLimit, code, data, salt
  const tx = api.tx.revive.instantiateWithCode(
    value,                // value: Balance to transfer
    gasLimit,             // gas_limit: Weight
    storageDepositLimit,  // storage_deposit_limit: Option<Balance>
    code,                 // code: Vec<u8> (hex string)
    data,                 // data: Vec<u8> (constructor args)
    null                  // salt: Option<[u8; 32]> (null for no salt)
  );
  
  console.log(`  ⏳ Waiting for finalization...`);
  
  // Sign and send, waiting for finalization
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deployment timed out after 120 seconds'));
    }, 120000);
    
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
        
        // Log all events for debugging
        console.log('\n  📊 All Events:');
        events.forEach(({ event }, index) => {
          const { section, method, data } = event;
          console.log(`     [${index}] ${section}.${method}`);
          try {
            const humanData = data.toHuman();
            console.log(`         Data:`, JSON.stringify(humanData, null, 2).substring(0, 200));
          } catch (e) {
            console.log(`         Raw:`, data.toString().substring(0, 200));
          }
        });
        
        // Extract contract address from revive.Instantiated event
        let contractAddress = null;
        for (const { event } of events) {
          const { section, method, data } = event;
          if (section === 'revive' && method === 'Instantiated') {
            console.log('\n  🔍 Found revive.Instantiated event:');
            console.log(`     Raw data:`, data.toHuman());
            
            // Try different field access patterns
            if (data.length >= 2) {
              contractAddress = data[1]?.toString();
              console.log(`     Contract address (data[1]): ${contractAddress}`);
            }
            
            // Also try to access by field name if available
            try {
              const human = data.toHuman();
              if (human.contract) {
                contractAddress = human.contract;
                console.log(`     Contract address (human.contract): ${contractAddress}`);
              }
            } catch (e) {}
            
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
  console.log(`     Contract: ${contractAddress}`);
  
  // Find the function in ABI
  const fnAbi = abi.find(item => item.type === 'function' && item.name === methodName);
  if (!fnAbi) {
    throw new Error(`Function ${methodName} not found in ABI`);
  }
  
  // Encode the function call using ethers.js
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(methodName, args);
  
  console.log(`     Encoded calldata: ${data.slice(0, 50)}...`);
  
  // Get limits from options
  const gasLimit = options.gasLimit;
  const value = options.value || BigInt(0);
  const storageDepositLimit = options.storageDepositLimit;
  
  console.log(`     Gas refTime: ${gasLimit.refTime.toString()}`);
  console.log(`     Gas proofSize: ${gasLimit.proofSize.toString()}`);
  console.log(`     Storage deposit: ${storageDepositLimit ? storageDepositLimit.toString() : 'null'}`);
  
  // pallet-revive call extrinsic:
  // - dest: H160 (contract address)
  // - value: Balance
  // - gas_limit: Weight
  // - storage_deposit_limit: Option<Balance>
  // - data: Vec<u8>
  const tx = api.tx.revive.call(
    contractAddress,      // dest: H160
    value,                // value: Balance
    gasLimit,             // gas_limit: Weight
    storageDepositLimit,  // storage_deposit_limit: Option<Balance>
    data                  // data: Vec<u8>
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Transaction timed out after 60 seconds'));
    }, 60000);
    
    tx.signAndSend(deployer, { withSignedTransaction: false }, ({ status, dispatchError, events }) => {
      if (dispatchError) {
        clearTimeout(timeout);
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          
          // Log all events on error for debugging
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

async function updateEnvFile(addresses) {
  const envPath = '.env.development';
  let envContent = '';
  
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8');
  }
  
  const envLines = envContent.split('\n');
  const envVars = {};
  envLines.forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
  
  envVars.VITE_QNS_REGISTRY_ADDRESS = addresses.registry;
  envVars.VITE_QNS_REGISTRAR_ADDRESS = addresses.registrar;
  envVars.VITE_QNS_RESOLVER_ADDRESS = addresses.resolver;
  
  if (!envVars.VITE_QF_RPC_URL) envVars.VITE_QF_RPC_URL = RPC_URL;
  if (!envVars.VITE_ETH_RPC_URL) envVars.VITE_ETH_RPC_URL = 'http://localhost:8545';
  if (!envVars.VITE_CHAIN_ID) envVars.VITE_CHAIN_ID = '42';
  
  const newContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  writeFileSync(envPath, newContent + '\n');
  console.log(`✅ Updated ${envPath}`);
}

// ============================================
// MAIN DEPLOYMENT
// ============================================

async function main() {
  console.log('============================================');
  console.log('QNS DEPLOYMENT - pallet-revive (PolkaVM)');
  console.log('============================================');
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Deployer: ${DEPLOYER_SEED}`);
  console.log('');
  
  // Check if contracts are compiled
  if (!existsSync(COMBINED_JSON_PATH)) {
    console.error('❌ contracts/combined.json not found. Please compile contracts first:');
    console.error('   resolc contracts/QNSRegistry.sol contracts/QNSResolver.sol contracts/QNSRegistrar.sol --combined-json abi,bin -o contracts/ --overwrite');
    process.exit(1);
  }
  
  // Connect to the chain
  console.log('📡 Connecting to QF Network...');
  const provider = new WsProvider(RPC_URL);
  
  const connectionTimeout = setTimeout(() => {
    console.error(`\n❌ Could not connect to RPC at ${RPC_URL}. Is your local node running?`);
    process.exit(1);
  }, 10000);
  
  let api;
  try {
    api = await ApiPromise.create({ provider });
    clearTimeout(connectionTimeout);
  } catch (err) {
    clearTimeout(connectionTimeout);
    console.error(`\n❌ Could not connect to RPC at ${RPC_URL}.`);
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }
  
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  
  console.log(`✅ Connected to ${chain}`);
  console.log(`   Node: ${nodeName} v${nodeVersion}\n`);
  
  // Check available revive extrinsics
  console.log('📋 Checking pallet-revive extrinsics:');
  if (api.tx.revive) {
    console.log(`   Available: ${Object.keys(api.tx.revive).join(', ')}`);
    
    // Log the signature of instantiateWithCode for debugging
    const instantiateMeta = api.tx.revive.instantiateWithCode.meta;
    console.log(`\n   instantiateWithCode signature:`);
    instantiateMeta.args.forEach((arg, i) => {
      console.log(`     [${i}] ${arg.name}: ${arg.type}`);
    });
    
    // Log the signature of call for debugging
    const callMeta = api.tx.revive.call.meta;
    console.log(`\n   call signature:`);
    callMeta.args.forEach((arg, i) => {
      console.log(`     [${i}] ${arg.name}: ${arg.type}`);
    });
  } else {
    console.error('❌ pallet-revive not found!');
    await api.disconnect();
    process.exit(1);
  }
  console.log('');
  
  // ============================================
  // STEP 1: Query chain limits FIRST
  // ============================================
  console.log('⚖️  Querying chain limits...');
  
  const blockWeights = api.consts.system.blockWeights;
  const maxExtrinsic = blockWeights.perClass.normal.maxExtrinsic.unwrap();
  
  console.log(`   Max extrinsic refTime:  ${maxExtrinsic.refTime.toString()}`);
  console.log(`   Max extrinsic proofSize: ${maxExtrinsic.proofSize.toString()}`);
  
  // Setup deployer account
  console.log('\n🔑 Loading deployer account...');
  const keyring = new Keyring({ type: 'sr25519' });
  const deployer = keyring.addFromUri(DEPLOYER_SEED);
  const deployerEvmAddress = substrateToEvmAddress(deployer.address);
  console.log(`   Address: ${deployer.address}`);
  console.log(`   EVM:     ${deployerEvmAddress}`);
  
  // Check deployer's free balance
  const { data: balance } = await api.query.system.account(deployer.address);
  const freeBalance = balance.free.toBigInt();
  console.log(`   Free balance: ${freeBalance.toString()} (${(Number(freeBalance) / 1e18).toFixed(4)} QF)`);
  
  if (freeBalance === 0n) {
    console.error('❌ Error: Deployer account has zero balance');
    process.exit(1);
  }
  
  // ============================================
  // STEP 2: Calculate gas limits using integer math
  // ============================================
  console.log('\n🔧 Calculating gas limits (integer math only)...');
  
  const maxRefTime = maxExtrinsic.refTime.toBigInt();
  const maxProofSize = maxExtrinsic.proofSize.toBigInt();
  
  // Deploy gas: 75% of max extrinsic (for large deployments)
  const deployRefTime = maxRefTime * 75n / 100n;
  const deployProofSize = maxProofSize * 75n / 100n;
  
  const DEPLOY_GAS_LIMIT = api.registry.createType('Weight', {
    refTime: deployRefTime,
    proofSize: deployProofSize,
  });
  
  // Call gas: 25% of max extrinsic (for post-deploy calls)
  const callRefTime = maxRefTime * 25n / 100n;
  const callProofSize = maxProofSize * 25n / 100n;
  
  const CALL_GAS_LIMIT = api.registry.createType('Weight', {
    refTime: callRefTime,
    proofSize: callProofSize,
  });
  
  // Storage deposit limits
  // For deployments: 10% of free balance (generous, unused is refunded)
  const deployStorageDeposit = freeBalance / 10n;
  // For calls: 1% of free balance
  const callStorageDeposit = freeBalance / 100n;
  
  console.log(`   Deploy gas refTime:      ${deployRefTime.toString()}`);
  console.log(`   Deploy gas proofSize:    ${deployProofSize.toString()}`);
  console.log(`   Call gas refTime:        ${callRefTime.toString()}`);
  console.log(`   Call gas proofSize:      ${callProofSize.toString()}`);
  console.log(`   Deploy storage deposit:  ${deployStorageDeposit.toString()}`);
  console.log(`   Call storage deposit:    ${callStorageDeposit.toString()}`);
  console.log('');
  
  // ============================================
  // STEP 3: Load contract artifacts
  // ============================================
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
  // STEP 4: Deploy contracts with try-catch and full error logging
  // ============================================
  
  let registryAddress, resolverAddress, registrarAddress;
  
  // Deploy Registry
  try {
    console.log('============================================');
    console.log('STEP 4a: Deploying QNSRegistry');
    console.log('============================================');
    
    registryAddress = await deployContract(api, deployer, 'QNSRegistry', artifacts.registry, [], {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Registry deployment failed:');
    console.error(err.message);
    if (err.events) {
      console.error('\nEvents at failure:');
      err.events.forEach(({ event }) => {
        console.error(`  ${event.section}.${event.method}:`, event.data.toHuman());
      });
    }
    await api.disconnect();
    process.exit(1);
  }
  
  // Deploy Resolver
  try {
    console.log('\n============================================');
    console.log('STEP 4b: Deploying QNSResolver');
    console.log('============================================');
    
    resolverAddress = await deployContract(api, deployer, 'QNSResolver', artifacts.resolver, [registryAddress], {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Resolver deployment failed:');
    console.error(err.message);
    if (err.events) {
      console.error('\nEvents at failure:');
      err.events.forEach(({ event }) => {
        console.error(`  ${event.section}.${event.method}:`, event.data.toHuman());
      });
    }
    await api.disconnect();
    process.exit(1);
  }
  
  // Deploy Registrar
  try {
    console.log('\n============================================');
    console.log('STEP 4c: Deploying QNSRegistrar');
    console.log('============================================');
    
    // Log the actual constructor ABI
    const constructorAbi = artifacts.registrar.abi.find(item => item.type === 'constructor');
    console.log('   QNSRegistrar constructor ABI:', JSON.stringify(constructorAbi, null, 2));
    
    // Treasury: use env var if set, otherwise use deployer
    const treasuryEvmAddress = TREASURY_ADDRESS 
      ? (TREASURY_ADDRESS.startsWith('0x') ? TREASURY_ADDRESS : substrateToEvmAddress(TREASURY_ADDRESS))
      : deployerEvmAddress;
    
    // Burn address: use env var or default
    const burnEvmAddress = BURN_ADDRESS.startsWith('0x') 
      ? BURN_ADDRESS 
      : substrateToEvmAddress(BURN_ADDRESS);
    
    console.log(`   Using addresses:`);
    console.log(`     Registry:  ${registryAddress}`);
    console.log(`     Resolver:  ${resolverAddress}`);
    console.log(`     Treasury:  ${treasuryEvmAddress}`);
    console.log(`     Burn:      ${burnEvmAddress}`);
    
    // Registrar constructor: (registryAddress, resolverAddress, treasuryAddress, _burnAddress)
    const constructorArgs = [
      registryAddress,      // registryAddress
      resolverAddress,      // resolverAddress
      treasuryEvmAddress,   // treasuryAddress
      burnEvmAddress,       // _burnAddress
    ];
    console.log(`   Constructor args count: ${constructorArgs.length}`);
    
    registrarAddress = await deployContract(api, deployer, 'QNSRegistrar', artifacts.registrar, constructorArgs, {
      gasLimit: DEPLOY_GAS_LIMIT,
      storageDepositLimit: deployStorageDeposit,
    });
  } catch (err) {
    console.error('\n❌ Registrar deployment failed:');
    console.error(err.message);
    if (err.events) {
      console.error('\nEvents at failure:');
      err.events.forEach(({ event }) => {
        console.error(`  ${event.section}.${event.method}:`, event.data.toHuman());
      });
    }
    await api.disconnect();
    process.exit(1);
  }
  
  // ============================================
  // STEP 5: Wire contracts (post-deploy calls)
  // ============================================
  try {
    console.log('\n============================================');
    console.log('STEP 5: Wiring contracts (post-deploy setup)');
    console.log('============================================');

    // Node hashes
    const rootNode = '0x' + '00'.repeat(32);
    const qfLabelHash = ethers.keccak256(ethers.toUtf8Bytes('qf'));
    const reverseLabelHash = ethers.keccak256(ethers.toUtf8Bytes('reverse'));
    const qfNode = ethers.keccak256(ethers.solidityPacked(['bytes32', 'bytes32'], [rootNode, qfLabelHash]));

    console.log(`  Root node:         ${rootNode}`);
    console.log(`  .qf label hash:    ${qfLabelHash}`);
    console.log(`  .reverse label:    ${reverseLabelHash}`);
    console.log(`  .qf node:          ${qfNode}`);
    console.log(`  Deployer EVM addr: ${deployerEvmAddress}`);
    console.log(`  Registrar EVM addr: ${registrarAddress}`);
    console.log(`  Resolver EVM addr:  ${resolverAddress}`);

    // Gas limits for post-deploy calls (50% of max extrinsic)
    const postDeployRefTime = maxRefTime * 50n / 100n;
    const postDeployProofSize = maxProofSize * 50n / 100n;
    const POST_DEPLOY_GAS_LIMIT = api.registry.createType('Weight', {
      refTime: postDeployRefTime,
      proofSize: postDeployProofSize,
    });

    // Helper: call with logging, finalization wait, and dispatchError check
    async function postDeployCall(stepName, contractAddress, abi, methodName, args) {
      console.log(`\n  [${stepName}] ${methodName}`);
      await callContract(api, deployer, contractAddress, abi, methodName, args, {
        gasLimit: POST_DEPLOY_GAS_LIMIT,
        storageDepositLimit: callStorageDeposit,
      });
    }

    // Step 5a: Set .qf owner to deployer temporarily (so deployer can set resolver)
    await postDeployCall(
      '5a', registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, qfLabelHash, deployerEvmAddress]
    );

    // Step 5b: Set .reverse owner to Registrar
    await postDeployCall(
      '5b', registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, reverseLabelHash, registrarAddress]
    );

    // Step 5c: Set .qf resolver to Resolver (deployer is owner, so this works)
    await postDeployCall(
      '5c', registryAddress, artifacts.registry.abi, 'setResolver',
      [qfNode, resolverAddress]
    );

    // Step 5d: Set .qf owner to Registrar (permanent ownership)
    await postDeployCall(
      '5d', registryAddress, artifacts.registry.abi, 'setSubnodeOwner',
      [rootNode, qfLabelHash, registrarAddress]
    );

    // Step 5e: Authorize Registrar in Resolver
    await postDeployCall(
      '5e', resolverAddress, artifacts.resolver.abi, 'addAuthorizedCaller',
      [registrarAddress]
    );

    // Step 5f: Set default resolver on Registrar
    await postDeployCall(
      '5f', registrarAddress, artifacts.registrar.abi, 'setDefaultResolver',
      [resolverAddress]
    );

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n============================================');
    console.log('POST-DEPLOY SETUP COMPLETE');
    console.log('============================================');
    console.log('  ✅ reverse node owner → Registrar');
    console.log('  ✅ .qf node resolver → Resolver');
    console.log('  ✅ .qf node owner → Registrar');
    console.log('  ✅ Registrar authorized in Resolver');
    console.log('  ✅ Default resolver set on Registrar');

  } catch (err) {
    console.error('\n❌ Contract wiring failed:');
    console.error(err.message);
    await api.disconnect();
    process.exit(1);
  }
  
  // ============================================
  // STEP 6: Write addresses to .env.development
  // ============================================
  console.log('\n============================================');
  console.log('STEP 6: Writing deployment addresses');
  console.log('============================================');

  await updateEnvFile({
    registry: registryAddress,
    resolver: resolverAddress,
    registrar: registrarAddress,
  });

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('\n============================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('============================================');
  console.log(`VITE_QNS_REGISTRY_ADDRESS:  ${process.env.VITE_QNS_REGISTRY_ADDRESS || registryAddress}`);
  console.log(`VITE_QNS_RESOLVER_ADDRESS:  ${process.env.VITE_QNS_RESOLVER_ADDRESS || resolverAddress}`);
  console.log(`VITE_QNS_REGISTRAR_ADDRESS: ${process.env.VITE_QNS_REGISTRAR_ADDRESS || registrarAddress}`);
  console.log(`\nDeployer SS58: ${deployer.address}`);
  console.log(`Deployer EVM:  ${deployerEvmAddress}`);
  
  await api.disconnect();
  console.log('\n✅ Done!');
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
