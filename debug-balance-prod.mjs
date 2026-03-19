// Debug script for production QF Network
// Run this after a registration to check where the funds went

import { ethers } from 'ethers';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Configuration for production
const REGISTRAR = process.env.REGISTRAR || '0xd86e4732bd7ff878da393a3654c0cd471280b13b';
const ETH_RPC = process.env.ETH_RPC || 'https://rpc.quantumfusion.network';
const WS_ENDPOINT = process.env.WS_ENDPOINT || 'wss://rpc.quantumfusion.network';

console.log('=== QF Network Contract Balance Debug ===\n');
console.log('Registrar contract:', REGISTRAR);
console.log('ETH RPC:', ETH_RPC);
console.log('WS Endpoint:', WS_ENDPOINT);
console.log('');

// ============================================================================
// Check all balance sources
// ============================================================================
async function main() {
  // 1. Check via ETH RPC
  console.log('--- 1. ETH RPC (eth_getBalance) ---');
  try {
    const provider = new ethers.JsonRpcProvider(ETH_RPC);
    const balance = await provider.getBalance(REGISTRAR);
    console.log('Balance (wei):', balance.toString());
    console.log('Balance (QF):', ethers.formatEther(balance));
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');

  // 2. Check via fetch directly
  console.log('--- 2. Direct fetch eth_getBalance ---');
  try {
    const response = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [REGISTRAR, 'latest'],
        id: 1
      })
    });
    const result = await response.json();
    console.log('Result:', result);
    if (result.result) {
      const wei = BigInt(result.result);
      console.log('Balance (wei):', wei.toString());
      console.log('Balance (QF):', Number(wei) / 1e18);
    }
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');

  // 3. Check via Substrate WS
  console.log('--- 3. Substrate WebSocket ---');
  let api;
  try {
    const provider = new WsProvider(WS_ENDPOINT);
    api = await ApiPromise.create({ provider });
    
    const block = await api.rpc.chain.getBlock();
    console.log('Connected! Block:', block.block.header.number.toString());
    console.log('Chain decimals:', api.registry.chainDecimals);
    console.log('Token symbol:', api.registry.chainToken);
    console.log('');

    // 3a. system.account
    console.log('--- 3a. system.account ---');
    try {
      const accountInfo = await api.query.system.account(REGISTRAR);
      const data = accountInfo.toHuman();
      console.log('Account info:', JSON.stringify(data, null, 2));
      
      const raw = accountInfo.toJSON();
      if (raw.data?.free) {
        const free = BigInt(raw.data.free);
        console.log('Free balance (raw):', free.toString());
        console.log('Free balance (QF, assuming 18 decimals):', Number(free) / 1e18);
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
    console.log('');

    // 3b. Check all available revive queries
    console.log('--- 3b. Available pallet-revive queries ---');
    const reviveModule = api.query.revive;
    if (reviveModule) {
      const queries = Object.keys(reviveModule);
      console.log('Found queries:', queries.join(', '));
      
      // Try each one
      for (const queryName of queries) {
        try {
          const result = await reviveModule[queryName](REGISTRAR);
          console.log(`\nrevive.${queryName}(${REGISTRAR}):`);
          console.log('  Human:', result.toHuman());
          console.log('  JSON:', result.toJSON());
        } catch (e) {
          console.log(`revive.${queryName}: Failed - ${e.message}`);
        }
      }
    } else {
      console.log('pallet-revive not found in runtime');
    }
    console.log('');

    // 3c. Check for contract accounts mapping
    console.log('--- 3c. Contract storage ---');
    try {
      // In some revive implementations, contract info is stored separately
      // Try to query the contract info
      const contractInfo = await api.query.revive?.contractInfoOf?.(REGISTRAR);
      if (contractInfo) {
        console.log('Contract info:', contractInfo.toHuman());
      }
    } catch (e) {
      console.log('Contract info not available:', e.message);
    }

  } catch (err) {
    console.error('Substrate connection failed:', err.message);
  } finally {
    if (api) await api.disconnect();
  }

  console.log('\n=== Debug complete ===');
  console.log('\nSUMMARY:');
  console.log('If eth_getBalance shows > 0 but system.account shows 0,');
  console.log('then pallet-revive stores contract balances separately from Substrate accounts.');
  console.log('The fix would be to use eth_getBalance instead of api.query.system.account');
}

main().catch(console.error);
