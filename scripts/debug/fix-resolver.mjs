// fix-resolver.mjs - Fix resolver settings on already-deployed QNS contracts
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { ethers } from 'ethers';

const RPC_URL = process.env.VITE_QF_RPC_URL || 'ws://localhost:9944';
const REGISTRY = process.env.VITE_QNS_REGISTRY_ADDRESS;
const REGISTRAR = process.env.VITE_QNS_REGISTRAR_ADDRESS;
const RESOLVER = process.env.VITE_QNS_RESOLVER_ADDRESS;

async function main() {
  console.log('============================================');
  console.log('QNS RESOLVER FIX - Applying to existing deployment');
  console.log('============================================');
  
  if (!REGISTRY || !REGISTRAR || !RESOLVER) {
    console.error('❌ Missing contract addresses in environment:');
    console.error(`   REGISTRY: ${REGISTRY || 'NOT SET'}`);
    console.error(`   REGISTRAR: ${REGISTRAR || 'NOT SET'}`);
    console.error(`   RESOLVER: ${RESOLVER || 'NOT SET'}`);
    process.exit(1);
  }
  
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Registry: ${REGISTRY}`);
  console.log(`Registrar: ${REGISTRAR}`);
  console.log(`Resolver: ${RESOLVER}`);
  console.log('');
  
  const api = await ApiPromise.create({ provider: new WsProvider(RPC_URL) });
  const keyring = new Keyring({ type: 'sr25519' });
  const deployer = keyring.addFromUri(process.env.DEPLOYER_SEED || '//Alice');

  console.log(`Deployer: ${deployer.address}`);
  console.log('');

  const blockWeights = api.consts.system.blockWeights;
  const maxExtrinsic = blockWeights.perClass.normal.maxExtrinsic.unwrap();
  const gasLimit = api.registry.createType('Weight', {
    refTime: maxExtrinsic.refTime.toBigInt() * 50n / 100n,
    proofSize: maxExtrinsic.proofSize.toBigInt() * 50n / 100n,
  });
  
  // Calculate storage deposit based on balance like deploy.mjs does
  const { data: balance } = await api.query.system.account(deployer.address);
  const freeBalance = balance.free.toBigInt();
  const storageDep = freeBalance / 100n; // 1% of free balance
  console.log(`   Gas limit set, Storage deposit: ${storageDep.toString()} (${(Number(storageDep) / 1e18).toFixed(4)} QF)`);

  // Helper function to send transaction
  async function sendTransaction(dest, data, description) {
    console.log(`\n${description}...`);
    return new Promise((resolve, reject) => {
      api.tx.revive.call(dest, 0, gasLimit, storageDep, data)
        .signAndSend(deployer, { withSignedTransaction: false }, ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            return;
          }
          if (status.isInBlock) {
            console.log(`   📦 Included in block: ${status.asInBlock.toHex()}`);
          }
          if (status.isFinalized) {
            console.log(`   ✅ ${description} - Finalized`);
            resolve();
          }
        });
    });
  }

  // 1. Set default resolver on Registrar
  const registrarIface = new ethers.Interface([
    'function setDefaultResolver(address resolver)',
  ]);
  const setDefaultData = registrarIface.encodeFunctionData('setDefaultResolver', [RESOLVER]);
  await sendTransaction(REGISTRAR, setDefaultData, 'Setting default resolver on Registrar');

  // 2. Set resolver for .qf node in Registry
  // Since Registrar owns .qf node, we need to:
  // a) Transfer .qf ownership back to deployer
  // b) Set resolver
  // c) Transfer .qf ownership back to Registrar
  
  const rootNode = ethers.ZeroHash;
  const qfLabelHash = ethers.keccak256(ethers.toUtf8Bytes('qf'));
  const qfNode = ethers.keccak256(ethers.concat([rootNode, qfLabelHash]));
  
  console.log('\n=== Fixing .qf node resolver ===');
  console.log('   .qf node:', qfNode);
  
  const registryIface = new ethers.Interface([
    'function setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner)',
    'function setResolver(bytes32 node, address resolver)',
  ]);
  
  const deployerEvmAddr = '0x9621dde636de098b43efb0fa9b61facfe328f99d';
  
  // a) Transfer .qf ownership to deployer
  const transferToDeployerData = registryIface.encodeFunctionData('setSubnodeOwner', [
    rootNode,
    qfLabelHash,
    deployerEvmAddr
  ]);
  await sendTransaction(REGISTRY, transferToDeployerData, 'Transferring .qf ownership to deployer');
  
  // b) Set resolver for .qf node
  const setResolverData = registryIface.encodeFunctionData('setResolver', [qfNode, RESOLVER]);
  await sendTransaction(REGISTRY, setResolverData, 'Setting resolver for .qf node');
  
  // c) Transfer .qf ownership back to Registrar
  const transferToRegistrarData = registryIface.encodeFunctionData('setSubnodeOwner', [
    rootNode,
    qfLabelHash,
    REGISTRAR
  ]);
  await sendTransaction(REGISTRY, transferToRegistrarData, 'Transferring .qf ownership back to Registrar');

  console.log('\n============================================');
  console.log('✅ All fixes applied successfully!');
  console.log('============================================');
  console.log('\nRun debug-contracts.mjs again to verify:');
  console.log('   VITE_ETH_RPC_URL=http://127.0.0.1:8545 node --env-file=.env.development debug-contracts.mjs');
  
  await api.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Fix failed:', err.message);
  process.exit(1);
});
