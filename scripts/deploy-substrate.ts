#!/usr/bin/env ts-node
/**
 * Contract Deployment Script for QF Network (Substrate + Revive)
 * 
 * This script deploys Solidity smart contracts compiled to PolkaVM bytecode
d */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { CodePromise } from '@polkadot/api-contract';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_URL = process.env.QF_RPC_URL || 'wss://rpc.qfnetwork.io';
const MNEMONIC = process.env.DEPLOYER_MNEMONIC;
const BYTECODE_PATH = process.env.BYTECODE_PATH || './output/QNS.polkavm';
const ABI_PATH = process.env.ABI_PATH || './src/abi/QNSRegistrar.json';
const CONSTRUCTOR_ARGS = process.env.CONSTRUCTOR_ARGS ? JSON.parse(process.env.CONSTRUCTOR_ARGS) : [];
const VALUE = process.env.DEPLOY_VALUE || '0';
const GAS_LIMIT = process.env.GAS_LIMIT || '100000000000';

// ============================================================================
// DEPLOYMENT SCRIPT
// ============================================================================

async function deployContract() {
  console.log('========================================');
  console.log('  QF Network Contract Deployment');
  console.log('========================================\n');

  // Validate environment
  if (!MNEMONIC) {
    console.error('❌ Error: DEPLOYER_MNEMONIC not set in environment');
    console.error('   Create a .env file or set it in your environment.\n');
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------------------
    // Step 1: Connect to QF Network
    // -------------------------------------------------------------------------
    console.log('📡 Connecting to QF Network...');
    console.log(`   RPC: ${RPC_URL}\n`);

    const provider = new WsProvider(RPC_URL);
    const api = await ApiPromise.create({ provider });

    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);

    console.log(`✅ Connected to ${chain}`);
    console.log(`   Node: ${nodeName} v${nodeVersion}\n`);

    // -------------------------------------------------------------------------
    // Step 2: Load deployer account
    // -------------------------------------------------------------------------
    console.log('🔑 Loading deployer account...');
    const keyring = new Keyring({ type: 'sr25519' });
    const deployer = keyring.addFromMnemonic(MNEMONIC);
    console.log(`   Address: ${deployer.address}\n`);

    // Check balance
    const { data: balance } = await api.query.system.account(deployer.address);
    const freeBalance = BigInt(balance.free.toString());
    console.log(`💰 Balance: ${formatBalance(freeBalance)} QF\n`);

    if (freeBalance === 0n) {
      console.error('❌ Error: Deployer account has zero balance');
      console.error('   Fund your account before deploying.\n');
      process.exit(1);
    }

    // -------------------------------------------------------------------------
    // Step 3: Load PolkaVM bytecode
    // -------------------------------------------------------------------------
    console.log('📦 Loading PolkaVM bytecode...');
    const bytecodePath = resolve(BYTECODE_PATH);
    let bytecode: Buffer;
    
    try {
      bytecode = readFileSync(bytecodePath);
      console.log(`   Path: ${bytecodePath}`);
      console.log(`   Size: ${bytecode.length} bytes\n`);
    } catch (error) {
      console.error(`❌ Error: Failed to read bytecode file: ${byteCODE_PATH}`);
      console.error('   Make sure to compile the contract first:');
      console.error('   ./scripts/compile-revive.sh contracts/QNSRegistrar.sol\n');
      process.exit(1);
    }

    // -------------------------------------------------------------------------
    // Step 4: Load ABI
    // -------------------------------------------------------------------------
    console.log('📋 Loading contract ABI...');
    const abiPath = resolve(ABI_PATH);
    let abi: any;
    
    try {
      const abiContent = readFileSync(abiPath, 'utf-8');
      abi = JSON.parse(abiContent);
      console.log(`   Path: ${abiPath}`);
      console.log(`   Contract: ${abi.contract?.name || 'Unknown'}\n`);
    } catch (error) {
      console.error(`❌ Error: Failed to read ABI file: ${ABI_PATH}\n`);
      process.exit(1);
    }

    // -------------------------------------------------------------------------
    // Step 5: Deploy contract via revive.instantiate
    // -------------------------------------------------------------------------
    console.log('🚀 Deploying contract...');
    console.log(`   Gas Limit: ${GAS_LIMIT}`);
    console.log(`   Value: ${VALUE} QF`);
    console.log(`   Constructor Args: ${JSON.stringify(CONSTRUCTOR_ARGS)}\n`);

    // Create CodePromise for the contract
    const code = new CodePromise(api, abi, bytecode);

    // Prepare deployment options
    const value = BigInt(VALUE);
    const gasLimit = BigInt(GAS_LIMIT);
    
    // Deploy the contract
    const tx = code.tx[
      abi.contract?.constructors?.[0]?.identifier || 'new'
    ]({
      gasLimit,
      value,
    }, ...CONSTRUCTOR_ARGS);

    console.log('⏳ Waiting for transaction finalization...\n');

    // Sign and send the transaction
    const result = await new Promise<any>((resolve, reject) => {
      tx.signAndSend(deployer, ({ status, events, dispatchError, contract }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { docs, name, section } = decoded;
            reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        }

        if (status.isInBlock) {
          console.log(`📦 Included in block: ${status.asInBlock.toHex()}`);
        }

        if (status.isFinalized) {
          console.log(`✅ Finalized in block: ${status.asFinalized.toHex()}`);
          
          // Extract contract address from events
          let contractAddress: string | null = null;
          
          events.forEach(({ event }: { event: any }) => {
            const { section, method, data } = event;
            
            // Look for ContractInstantiated event from the revive pallet
            if (section === 'revive' && method === 'Instantiated') {
              contractAddress = data[1]?.toString();
            }
          });

          resolve({
            blockHash: status.asFinalized.toHex(),
            contractAddress,
            events,
          });
        }
      }).catch(reject);
    });

    // -------------------------------------------------------------------------
    // Step 6: Output deployment results
    // -------------------------------------------------------------------------
    console.log('\n========================================');
    console.log('  ✅ Deployment Successful!');
    console.log('========================================\n');
    console.log(`📍 Contract Address: ${result.contractAddress || 'Not found'}`);
    console.log(`🔍 Block Hash: ${result.blockHash}`);
    console.log(`🌐 Explorer: https://explorer.qfnetwork.io/contract/${result.contractAddress}\n`);

    // Update instruction
    console.log('📋 Next Steps:');
    console.log('   1. Update CONTRACT_ADDRESS in src/utils/qns.ts');
    console.log('   2. Update src/config/contracts.ts');
    console.log('   3. Verify the contract on the explorer\n');

    await api.disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Deployment failed:\n');
    console.error(error.message || error);
    process.exit(1);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatBalance(balance: bigint): string {
  const qf = Number(balance) / 1e18;
  return qf.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// ============================================================================
// RUN
// ============================================================================

deployContract();
