import 'dotenv/config';
import { ethers } from 'ethers';

const ETH_RPC = process.env.VITE_ETH_RPC_URL || 'http://127.0.0.1:8545';
const provider = new ethers.JsonRpcProvider(ETH_RPC);

const REGISTRY = process.env.VITE_QNS_REGISTRY_ADDRESS;
const REGISTRAR = process.env.VITE_QNS_REGISTRAR_ADDRESS;
const RESOLVER = process.env.VITE_QNS_RESOLVER_ADDRESS;

console.log('Contract addresses:');
console.log('  Registry:', REGISTRY);
console.log('  Registrar:', REGISTRAR);
console.log('  Resolver:', RESOLVER);
console.log('  ETH RPC:', ETH_RPC);
console.log('');

// Minimal ABIs for the checks we need
const registryAbi = [
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
];

const registrarAbi = [
  'function admin() view returns (address)',
  'function treasury() view returns (address)',
  'function burnAddress() view returns (address)',
  'function price3Char() view returns (uint256)',
  'function price4Char() view returns (uint256)',
  'function price5PlusChar() view returns (uint256)',
  'function permanentMultiplier() view returns (uint256)',
  'function burnPercent() view returns (uint256)',
  'function available(string name) view returns (bool)',
  'function resolver() view returns (address)',
  'function registry() view returns (address)',
  'function register(string name, uint256 years, bool permanent) payable',
];

const resolverAbi = [
  'function authorizedCallers(address) view returns (bool)',
];

const registry = new ethers.Contract(REGISTRY, registryAbi, provider);
const registrar = new ethers.Contract(REGISTRAR, registrarAbi, provider);
const resolver = new ethers.Contract(RESOLVER, resolverAbi, provider);

// Compute nodes
const rootNode = ethers.ZeroHash; // bytes32(0)
const qfLabelHash = ethers.keccak256(ethers.toUtf8Bytes('qf'));
const qfNode = ethers.keccak256(ethers.concat([rootNode, qfLabelHash]));

console.log('Computed nodes:');
console.log('  Root node:', rootNode);
console.log('  QF label hash:', qfLabelHash);
console.log('  QF node (namehash):', qfNode);
console.log('');

async function main() {
  try {
    // 1. Check Registry
    console.log('=== REGISTRY CHECKS ===');
    
    const rootOwner = await registry.owner(rootNode);
    console.log('  Root node owner:', rootOwner);
    
    const qfNodeOwner = await registry.owner(qfNode);
    console.log('  .qf node owner:', qfNodeOwner);
    console.log('  .qf node should be Registrar:', qfNodeOwner.toLowerCase() === REGISTRAR.toLowerCase() ? 'YES ✅' : 'NO ❌ (This is likely the problem!)');
    
    const qfResolver = await registry.resolver(qfNode);
    console.log('  .qf node resolver:', qfResolver);
    console.log('');

    // 2. Check Registrar
    console.log('=== REGISTRAR CHECKS ===');
    
    const admin = await registrar.admin();
    console.log('  Admin:', admin);
    
    const treasury = await registrar.treasury();
    console.log('  Treasury:', treasury);
    
    const burnAddr = await registrar.burnAddress();
    console.log('  Burn address:', burnAddr);
    
    const price3 = await registrar.price3Char();
    console.log('  Price 3-char:', ethers.formatEther(price3), 'QF');
    
    const price4 = await registrar.price4Char();
    console.log('  Price 4-char:', ethers.formatEther(price4), 'QF');
    
    const price5 = await registrar.price5PlusChar();
    console.log('  Price 5+-char:', ethers.formatEther(price5), 'QF');
    
    const multiplier = await registrar.permanentMultiplier();
    console.log('  Permanent multiplier:', multiplier.toString());
    
    const burnPct = await registrar.burnPercent();
    console.log('  Burn percent:', burnPct.toString());
    
    let resolverAddr;
    try {
      resolverAddr = await registrar.resolver();
      console.log('  Resolver (defaultResolver):', resolverAddr);
      console.log('  Matches actual Resolver:', resolverAddr.toLowerCase() === RESOLVER.toLowerCase() ? 'YES ✅' : 'NO ❌');
    } catch(e) {
      console.log('  Resolver: (not set or not exposed)', e.message);
    }
    console.log('');

    // 3. Check Resolver
    console.log('=== RESOLVER CHECKS ===');
    
    const registrarAuthorized = await resolver.authorizedCallers(REGISTRAR);
    console.log('  Registrar is authorized caller:', registrarAuthorized ? 'YES ✅' : 'NO ❌ (This is likely the problem!)');
    console.log('');

    // 4. Check name availability
    console.log('=== AVAILABILITY CHECK ===');
    
    try {
      const isAvailable = await registrar.available('satoshi');
      console.log('  "satoshi" available:', isAvailable ? 'YES ✅' : 'NO ❌');
    } catch (err) {
      console.log('  "satoshi" availability check failed:', err.message);
    }
    console.log('');

    // 5. Simulate registration call (with proper value)
    console.log('=== SIMULATE REGISTRATION (with value) ===');
    const registrarIface = new ethers.Interface([
      'function register(string name, uint256 years, bool permanent) payable',
    ]);
    const registerData = registrarIface.encodeFunctionData('register', ['satoshi', 1, false]);
    const price = await registrar.price5PlusChar();
    console.log('  Price for 5+ char:', ethers.formatEther(price), 'QF');
    console.log('  Sending value:', ethers.formatEther(price), 'QF');

    try {
      const result = await provider.call({
        from: '0x9621dde636de098b43efb0fa9b61facfe328f99d', // Alice's mapped EVM address
        to: REGISTRAR,
        data: registerData,
        value: price
      });
      console.log('  Simulation SUCCESS ✅');
      console.log('  Return data:', result);
    } catch (e) {
      console.log('  Simulation REVERTED ❌');
      if (e.data) {
        try {
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + e.data.slice(10));
          console.log('  Revert reason:', reason[0]);
        } catch {
          console.log('  Raw revert data:', e.data);
        }
      }
      console.log('  Error:', e.message);
    }

    // 6. Registrar internal state checks
    console.log('\n=== REGISTRAR INTERNAL STATE ===');
    try {
      const regAddr = await registrar.registry();
      console.log('  Registrar.registry():', regAddr);
      console.log('  Matches actual Registry:', regAddr.toLowerCase() === REGISTRY.toLowerCase() ? 'YES ✅' : 'NO ❌');
    } catch(e) {
      console.log('  Could not read registry address from Registrar:', e.message);
    }

    try {
      const resAddr = await registrar.resolver();
      console.log('  Registrar.resolver():', resAddr);
      console.log('  Matches actual Resolver:', resAddr.toLowerCase() === RESOLVER.toLowerCase() ? 'YES ✅' : 'NO ❌');
    } catch(e) {
      console.log('  Could not read resolver from Registrar:', e.message);
    }

    // Check if the name "satoshi" is already registered
    try {
      const nameHash = ethers.namehash('satoshi.qf');
      const owner = await registry.owner(nameHash);
      console.log('  satoshi.qf owner:', owner);
      console.log('  Is available:', owner === '0x0000000000000000000000000000000000000000' ? 'YES ✅' : 'NO ❌');
    } catch(e) {
      console.log('  Could not check satoshi.qf:', e.message);
    }

    // Check Alice's balance via eth RPC
    try {
      const balance = await provider.getBalance('0x9621dde636de098b43efb0fa9b61facfe328f99d');
      console.log('  Alice EVM balance:', ethers.formatEther(balance), 'QF');
    } catch(e) {
      console.log('  Could not get Alice balance:', e.message);
    }

  } catch (err) {
    console.error('Debug failed:', err);
  }
  
  process.exit(0);
}

main();
