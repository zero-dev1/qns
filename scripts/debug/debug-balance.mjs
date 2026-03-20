// Debug script to check contract balance via multiple methods
// This helps determine if funds are actually in the contract but our read is broken

import { ethers } from 'ethers';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Configuration - adjust these as needed
const REGISTRAR = '0xd86e4732bd7ff878da393a3654c0cd471280b13b'; // Your registrar address
const ETH_RPC = 'http://127.0.0.1:8545'; // Local eth-rpc endpoint
const WS_ENDPOINT = 'ws://127.0.0.1:9944'; // Local Substrate node

console.log('=== Contract Balance Debug Script ===\n');
console.log('Registrar contract:', REGISTRAR);
console.log('ETH RPC:', ETH_RPC);
console.log('WS Endpoint:', WS_ENDPOINT);
console.log('');

// ============================================================================
// Method 1: eth_getBalance via RPC (EVM level)
// ============================================================================
async function checkEthBalance() {
  console.log('--- Method 1: eth_getBalance (EVM) ---');
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
    console.log('Raw response:', result);
    
    if (result.result) {
      const balanceWei = BigInt(result.result);
      console.log('Balance (wei):', balanceWei.toString());
      console.log('Balance (QF):', Number(balanceWei) / 1e18);
    } else if (result.error) {
      console.log('Error:', result.error);
    }
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Method 2: Call address(this).balance via Solidity
// ============================================================================
async function checkContractInternalBalance() {
  console.log('--- Method 2: address(this).balance via Solidity ---');
  try {
    // Minimal ABI for getting balance - we need a view function that returns address(this).balance
    // If your contract has such a function, adjust this. Otherwise we'll try eth_call directly.
    
    // Using ethers to call address(this).balance equivalent
    // Actually, there's no standard Solidity function for this - we need the contract to expose it
    // Let me check if there's a getBalance or similar in the ABI
    
    console.log('Note: The Registrar contract does not expose address(this).balance as a view function');
    console.log('The balance can only be read via eth_getBalance or Substrate queries');
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Method 3: Substrate system.account query
// ============================================================================
async function checkSubstrateBalance(api) {
  console.log('--- Method 3: Substrate system.account ---');
  try {
    const accountInfo = await api.query.system.account(REGISTRAR);
    const data = accountInfo.toHuman();
    console.log('Account info (human):', data);
    
    const raw = accountInfo.toJSON();
    console.log('Account info (JSON):', raw);
    
    if (raw.data?.free) {
      const free = BigInt(raw.data.free);
      console.log('Free balance:', free.toString());
      console.log('Free balance (QF):', Number(free) / 1e18);
    }
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Method 4: pallet-revive specific queries
// ============================================================================
async function checkReviveStorage(api) {
  console.log('--- Method 4: pallet-revive storage ---');
  try {
    // Try to get contract info from pallet-revive
    // The exact storage key depends on pallet-revive's implementation
    
    // Method 4a: Try api.query.revive.contractInfoOf
    try {
      const contractInfo = await api.query.revive.contractInfoOf(REGISTRAR);
      console.log('revive.contractInfoOf:', contractInfo.toHuman());
    } catch (e) {
      console.log('revive.contractInfoOf not available:', e.message);
    }
    
    // Method 4b: Try api.query.revive.accountInfoOf  
    try {
      const accountInfo = await api.query.revive.accountInfoOf(REGISTRAR);
      console.log('revive.accountInfoOf:', accountInfo.toHuman());
    } catch (e) {
      console.log('revive.accountInfoOf not available:', e.message);
    }
    
    // Method 4c: List all available revive queries
    console.log('\nAvailable revive queries:');
    const reviveQueries = Object.keys(api.query.revive || {});
    console.log(reviveQueries.join(', ') || 'None found');
    
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Method 5: Check if the EVM address maps to a different Substrate account
// ============================================================================
async function checkAddressMapping(api) {
  console.log('--- Method 5: Address mapping check ---');
  try {
    // In pallet-revive, EVM addresses might map to specific Substrate accounts
    // The contract's balance might be stored under a different account ID
    
    console.log('EVM address:', REGISTRAR);
    
    // Try to convert EVM address to Substrate account ID
    // This is implementation-specific to pallet-revive
    
    // Method 5a: Check if there's an addressMapping query
    try {
      const mapped = await api.query.revive.addressMapping(REGISTRAR);
      console.log('revive.addressMapping:', mapped.toHuman());
    } catch (e) {
      console.log('revive.addressMapping not available');
    }
    
    // Method 5b: Check for accountIdMapping
    try {
      const mapped = await api.query.revive.accountIdMapping(REGISTRAR);
      console.log('revive.accountIdMapping:', mapped.toHuman());
    } catch (e) {
      console.log('revive.accountIdMapping not available');
    }
    
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Method 6: Direct RPC state query for contract account
// ============================================================================
async function checkDirectStateQuery(api) {
  console.log('--- Method 6: Direct state query ---');
  try {
    // Query the raw state for the contract address
    const accountData = await api.rpc.state.getStorage(
      api.query.system.account.key(REGISTRAR)
    );
    console.log('Raw account data:', accountData.toHex());
    
    // Decode it
    if (accountData && !accountData.isEmpty) {
      const decoded = api.registry.createType('AccountInfo', accountData);
      console.log('Decoded account:', decoded.toHuman());
    } else {
      console.log('No account data found (account does not exist in Substrate state)');
    }
  } catch (err) {
    console.error('Failed:', err.message);
  }
  console.log('');
}

// ============================================================================
// Main execution
// ============================================================================
async function main() {
  // Method 1: ETH RPC
  await checkEthBalance();
  
  // Method 2: Solidity internal (not really applicable)
  await checkContractInternalBalance();
  
  // Connect to Substrate
  console.log('--- Connecting to Substrate node ---');
  let api;
  try {
    const provider = new WsProvider(WS_ENDPOINT);
    api = await ApiPromise.create({ provider });
    console.log('Connected! Block:', (await api.rpc.chain.getBlock()).block.header.number.toString());
    console.log('Chain decimals:', api.registry.chainDecimals);
    console.log('Token symbol:', api.registry.chainToken);
    console.log('');
  } catch (err) {
    console.error('Failed to connect to Substrate:', err.message);
    console.log('Skipping Substrate queries...\n');
  }
  
  if (api) {
    // Method 3: Substrate balance
    await checkSubstrateBalance(api);
    
    // Method 4: Revive storage
    await checkReviveStorage(api);
    
    // Method 5: Address mapping
    await checkAddressMapping(api);
    
    // Method 6: Direct state query
    await checkDirectStateQuery(api);
    
    // Disconnect
    await api.disconnect();
  }
  
  console.log('=== Debug complete ===');
}

main().catch(console.error);
