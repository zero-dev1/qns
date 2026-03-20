// debug-registration.mjs - Deep dive into registration failure
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
console.log('');

const registryAbi = [
  'function owner(bytes32 node) view returns (address)',
  'function resolver(bytes32 node) view returns (address)',
  'function records(bytes32 node) view returns (address owner, address resolver)',
];

const registrarAbi = [
  'function qfNode() view returns (bytes32)',
  'function registry() view returns (address)',
  'function register(string name, uint256 years, bool permanent) payable',
];

const registry = new ethers.Contract(REGISTRY, registryAbi, provider);
const registrar = new ethers.Contract(REGISTRAR, registrarAbi, provider);

async function main() {
  // Get the qfNode from Registrar
  const qfNode = await registrar.qfNode();
  console.log('=== NODE INFO ===');
  console.log('Registrar.qfNode():', qfNode);
  
  // Compute what we think it should be
  const rootNode = ethers.ZeroHash;
  const qfLabelHash = ethers.keccak256(ethers.toUtf8Bytes('qf'));
  const computedQfNode = ethers.keccak256(ethers.concat([rootNode, qfLabelHash]));
  console.log('Computed qfNode:', computedQfNode);
  console.log('Match:', qfNode === computedQfNode ? 'YES ✅' : 'NO ❌');
  console.log('');
  
  // Check .qf node details
  console.log('=== .QF NODE STATE ===');
  const qfOwner = await registry.owner(qfNode);
  const qfResolver = await registry.resolver(qfNode);
  const qfRecord = await registry.records(qfNode);
  console.log('  .qf node owner:', qfOwner);
  console.log('  .qf node resolver:', qfResolver);
  console.log('  .qf full record:', { owner: qfRecord[0], resolver: qfRecord[1] });
  console.log('  Registrar address:', REGISTRAR);
  console.log('  Owner matches Registrar:', qfOwner.toLowerCase() === REGISTRAR.toLowerCase() ? 'YES ✅' : 'NO ❌');
  console.log('');
  
  // Compute satoshi node
  const satoshiLabel = ethers.keccak256(ethers.toUtf8Bytes('satoshi'));
  const satoshiNode = ethers.keccak256(ethers.concat([qfNode, satoshiLabel]));
  console.log('=== SATOSHI NODE ===');
  console.log('  Label hash:', satoshiLabel);
  console.log('  Computed node:', satoshiNode);
  console.log('  Current owner:', await registry.owner(satoshiNode));
  console.log('');
  
  // Trace the registration step by step
  console.log('=== REGISTRATION TRACE ===');
  console.log('Step 1: registry.setSubnodeOwner(qfNode, satoshiLabel, REGISTRAR)');
  console.log('  Caller will be:', REGISTRAR);
  console.log('  Node being modified:', qfNode);
  console.log('  Current owner of qfNode:', qfOwner);
  console.log('  Caller is owner?', qfOwner.toLowerCase() === REGISTRAR.toLowerCase() ? 'YES ✅' : 'NO ❌');
  console.log('');
  
  // Try to manually simulate what the Registrar does
  console.log('=== MANUAL SIMULATION ===');
  const registryIface = new ethers.Interface([
    'function setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner)',
  ]);
  
  // This is what Registrar calls inside register()
  const setSubnodeData = registryIface.encodeFunctionData('setSubnodeOwner', [
    qfNode,
    satoshiLabel,
    REGISTRAR  // Registrar sets itself as owner first
  ]);
  
  console.log('Calling setSubnodeOwner from REGISTRAR address...');
  console.log('  Data:', setSubnodeData);
  
  try {
    const result = await provider.call({
      from: REGISTRAR,  // Simulate call from Registrar
      to: REGISTRY,
      data: setSubnodeData,
    });
    console.log('  Result: SUCCESS ✅');
    console.log('  Return data:', result);
  } catch (e) {
    console.log('  Result: REVERTED ❌');
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
  
  // Now try from a different address to show the difference
  console.log('\nCalling setSubnodeOwner from Alice address (should fail)...');
  const aliceEvm = '0x9621dde636de098b43efb0fa9b61facfe328f99d';
  try {
    await provider.call({
      from: aliceEvm,
      to: REGISTRY,
      data: setSubnodeData,
    });
    console.log('  Result: SUCCESS (unexpected)');
  } catch (e) {
    console.log('  Result: REVERTED ❌ (expected)');
    if (e.data) {
      try {
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + e.data.slice(10));
        console.log('  Revert reason:', reason[0]);
      } catch {
        console.log('  Raw revert data:', e.data);
      }
    }
  }
  
  // Test full registration with different from addresses
  console.log('\n=== FULL REGISTRATION TESTS ===');
  const registrarFullIface = new ethers.Interface([
    'function register(string name, uint256 years, bool permanent) payable',
  ]);
  const registerData = registrarFullIface.encodeFunctionData('register', ['satoshi', 1, false]);
  const price = ethers.parseEther('100');
  
  // Test 1: From Alice
  console.log('\nTest 1: register() from Alice');
  try {
    await provider.call({
      from: aliceEvm,
      to: REGISTRAR,
      data: registerData,
      value: price,
    });
    console.log('  Result: SUCCESS');
  } catch (e) {
    console.log('  Result: REVERTED -', e.message.split('reverted:')[1]?.trim() || e.message);
  }
  
  process.exit(0);
}

main().catch(console.error);
