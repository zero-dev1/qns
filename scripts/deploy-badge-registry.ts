#!/usr/bin/env ts-node
/**
 * QNSBadgeRegistry Deployment Script for QF Network (Substrate + Revive)
 * 
 * This script deploys the QNSBadgeRegistry contract compiled to PolkaVM bytecode
 * It prompts for the mnemonic at runtime for security
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { CodePromise } from '@polkadot/api-contract';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import * as readline from 'readline';

// Load environment variables
config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_URL = process.env.QF_RPC_URL || 'wss://rpc.qfnetwork.io';
const BYTECODE_PATH = './output/QNSBadgeRegistry.polkavm';
const ABI_PATH = './src/abi/QNSBadgeRegistry.json';
const VALUE = '0';
const GAS_LIMIT = '100000000000';

// ============================================================================
// INTERACTIVE MNEMONIC PROMPT
// ============================================================================

function promptMnemonic(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter deployer mnemonic (input will be visible): ', (answer) => {
      rl.close();
      const mnemonic = answer.trim();
      
      if (!mnemonic) {
        reject(new Error('Mnemonic cannot be empty'));
        return;
      }
      
      resolve(mnemonic);
    });
  });
}

// ============================================================================
// DEPLOYMENT SCRIPT
// ============================================================================

async function deployContract() {
  console.log('========================================');
  console.log('  QNSBadgeRegistry Deployment');
  console.log('========================================\n');

  try {
    // -------------------------------------------------------------------------
    // Step 1: Get mnemonic from user
    // -------------------------------------------------------------------------
    console.log('🔐 Security Note:');
    console.log('   - Your mnemonic will be visible in the terminal');
    console.log('   - Please clear your terminal after deployment');
    console.log('   - Never share your mnemonic with anyone\n');
    
    const MNEMONIC = await promptMnemonic();
    console.log('✅ Mnemonic received\n');

    // -------------------------------------------------------------------------
    // Step 2: Connect to QF Network
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
    // Step 3: Load deployer account
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
    // Step 4: Load PolkaVM bytecode
    // -------------------------------------------------------------------------
    console.log('📦 Loading PolkaVM bytecode...');
    const bytecodePath = resolve(BYTECODE_PATH);
    let bytecode: Buffer;
    
    try {
      bytecode = readFileSync(bytecodePath);
      console.log(`   Path: ${bytecodePath}`);
      console.log(`   Size: ${bytecode.length} bytes\n`);
    } catch (error) {
      console.error(`❌ Error: Failed to read bytecode file: ${bytecodePath}`);
      console.error('   Make sure to compile the contract first:');
      console.error('   ./scripts/compile-revive.sh contracts/QNSBadgeRegistry.sol QNSBadgeRegistry\n');
      process.exit(1);
    }

    // -------------------------------------------------------------------------
    // Step 5: Load ABI
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
    // Step 6: Deploy contract via revive.instantiate
    // -------------------------------------------------------------------------
    console.log('🚀 Deploying contract...');
    console.log(`   Gas Limit: ${GAS_LIMIT}`);
    console.log(`   Value: ${VALUE} QF`);
    console.log(`   Constructor Args: [] (no constructor arguments)\n`);

    // Create CodePromise for the contract
    const code = new CodePromise(api, abi, bytecode);

    // Prepare deployment options
    const value = BigInt(VALUE);
    const gasLimit = BigInt(GAS_LIMIT);
    
    // Deploy the contract (no constructor args)
    const tx = code.tx[
      abi.contract?.constructors?.[0]?.identifier || 'new'
    ]({
      gasLimit,
      value,
    });

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
    // Step 7: Output deployment results
    // -------------------------------------------------------------------------
    console.log('\n========================================');
    console.log('  ✅ Deployment Successful!');
    console.log('========================================\n');
    console.log(`📍 Contract Address: ${result.contractAddress || 'Not found'}`);
    console.log(`🔍 Block Hash: ${result.blockHash}`);
    console.log(`🌐 Explorer: https://portal.qfnetwork.xyz/?rpc=wss%3A%2F%2Fmainnet.qfnode.net#/explorer/contract/${result.contractAddress}\n`);

    // Update instruction
    console.log('📋 Next Steps:');
    console.log('   1. Add the contract address to Vercel environment variables:');
    console.log(`      VITE_QNS_BADGE_REGISTRY_ADDRESS=${result.contractAddress}`);
    console.log('   2. Redeploy the frontend to apply the changes');
    console.log('   3. Verify the contract on the explorer\n');
    
    console.log('🧹 Security Reminder:');
    console.log('   Please clear your terminal to remove any trace of your mnemonic\n');

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
