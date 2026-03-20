// fix-reverse-node.mjs
// Sets up the reverse node in the Registry, owned by the Registrar

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { ethers } from 'ethers';

const RPC = process.env.VITE_QF_RPC_URL || 'ws://localhost:9944';
const REGISTRY = process.env.VITE_QNS_REGISTRY_ADDRESS;
const REGISTRAR = process.env.VITE_QNS_REGISTRAR_ADDRESS;

const REGISTRY_ABI = [
  'function setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner) returns (bytes32)',
  'function owner(bytes32 node) view returns (address)'
];

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(RPC) });
  const keyring = new Keyring({ type: 'sr25519' });
  const deployer = keyring.addFromUri('//Alice');

  const iface = new ethers.Interface(REGISTRY_ABI);
  
  const rootNode = '0x' + '00'.repeat(32);
  const reverseLabel = ethers.keccak256(ethers.toUtf8Bytes('reverse'));
  
  console.log('Root node:', rootNode);
  console.log('Reverse label hash:', reverseLabel);
  
  // setSubnodeOwner(rootNode, keccak256("reverse"), registrarAddress)
  const calldata = iface.encodeFunctionData('setSubnodeOwner', [rootNode, reverseLabel, REGISTRAR]);
  
  const blockWeights = api.consts.system.blockWeights;
  const maxWeight = blockWeights.perClass.normal.maxExtrinsic.unwrap();
  const gasLimit = api.registry.createType('Weight', {
    refTime: maxWeight.refTime.toBigInt() * 50n / 100n,
    proofSize: maxWeight.proofSize.toBigInt() * 50n / 100n,
  });

  const balance = (await api.query.system.account(deployer.address)).data.free;
  const storageDeposit = balance.toBigInt() / 100n;

  console.log('\nSetting reverse node owner to Registrar...');
  console.log('  Registry:', REGISTRY);
  console.log('  Registrar:', REGISTRAR);
  
  await new Promise((resolve, reject) => {
    api.tx.revive.call(
      REGISTRY,
      0n,
      gasLimit,
      storageDeposit,
      calldata
    ).signAndSend(deployer, { withSignedTransaction: false }, ({ status, dispatchError, events }) => {
      if (status.isInBlock) console.log('  📦 Included in block:', status.asInBlock.toHex());
      if (dispatchError) {
        const err = api.registry.findMetaError(dispatchError.asModule);
        reject(new Error(`${err.section}.${err.name}: ${err.docs.join(' ')}`));
        return;
      }
      if (status.isFinalized) {
        console.log('  ✅ Reverse node owner set to Registrar');
        resolve();
      }
    });
  });

  // Also update deploy.mjs for future deployments
  console.log('\n✅ Done! Add this step to deploy.mjs for future deployments.');
  console.log('Now run debug-contracts.mjs to verify, then try registration again.');
  
  await api.disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

