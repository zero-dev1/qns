import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, FileCode, Globe, ArrowRightLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  QNS_REGISTRY_ADDRESS,
  QNS_REGISTRAR_ADDRESS,
  QNS_RESOLVER_ADDRESS,
} from '../config/contracts';

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'addr',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reverseResolve',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
];

const PAPI_EXAMPLE = `import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { getTypedApi, Binary } from 'polkadot-api';

const RESOLVER_ABI = [
  {
    name: 'addr',
    type: 'function',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'reverseResolve',
    type: 'function',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
];

const RESOLVER_ADDRESS = '${QNS_RESOLVER_ADDRESS}';

// Namehash: converts "alice.qf" to a bytes32 node
function namehash(name: string): \`0x\${string}\` {
  if (!name) return '0x' + '00'.repeat(32) as \`0x\${string}\`;
  const labels = name.split('.').reverse();
  let node: \`0x\${string}\` = '0x' + '00'.repeat(32) as \`0x\${string}\`;
  for (const label of labels) {
    const labelHash = keccak256(toHex(label));
    node = keccak256(encodePacked(['bytes32', 'bytes32'], [node, labelHash]));
  }
  return node;
}

// === READ EXAMPLE ===
async function resolveName(typedApi: any, name: string) {
  const node = namehash(name);
  
  const calldata = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: 'addr',
    args: [node],
  });
  
  const result = await typedApi.apis.ReviveApi.call(
    '5C62Ck4UrFPiB2C...',  // origin SS58 address
    Binary.fromHex(RESOLVER_ADDRESS),
    0n,                     // value
    undefined,              // gas_limit (optional)
    undefined,              // storage_deposit_limit (optional)
    Binary.fromHex(calldata)
  );
  
  if (result.success) {
    const decoded = decodeFunctionResult({
      abi: RESOLVER_ABI,
      functionName: 'addr',
      data: result.value.result.asOk.toHex(),
    });
    return decoded;
  }
  throw new Error('Call failed');
}

// === WRITE EXAMPLE ===
async function registerName(typedApi: any, signer: any, name: string) {
  const REGISTRAR_ABI = [...]; // Your registrar ABI
  
  const calldata = encodeFunctionData({
    abi: REGISTRAR_ABI,
    functionName: 'register',
    args: [name],
  });
  
  // Dry-run first
  const dryRun = await typedApi.apis.ReviveApi.call(
    '5C62Ck4UrFPiB2C...',
    Binary.fromHex('${QNS_REGISTRAR_ADDRESS}'),
    1000000000000n,  // registration fee
    undefined,
    undefined,
    Binary.fromHex(calldata)
  );
  
  if (!dryRun.success) throw new Error('Dry run failed');
  
  // Submit transaction
  const tx = typedApi.tx.Revive.call({
    dest: Binary.fromHex('${QNS_REGISTRAR_ADDRESS}'),
    value: 1000000000000n,
    gas_limit: dryRun.value.gas_consumed,
    storage_deposit_limit: dryRun.value.storage_deposit.asCharge,
    data: Binary.fromHex(calldata),
  });
  
  const result = await tx.signAndSubmit(signer);
  return result;
}`;

const SOLIDITY_EXAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IQNSResolver {
    function addr(bytes32 node) 
        external view returns (address);
    function reverseResolve(address _addr) 
        external view returns (string memory);
}

contract MyContract {
    IQNSResolver public qnsResolver;
    
    constructor(address _resolver) {
        qnsResolver = IQNSResolver(_resolver);
    }
    
    // Compute namehash for a .qf name
    function _namehash(string calldata label) 
        internal pure returns (bytes32) {
        // qfNode = keccak256(abi.encodePacked(bytes32(0), keccak256("qf")))
        bytes32 qfNode = 0x[COMPUTED_AT_DEPLOY];
        bytes32 labelHash = keccak256(bytes(label));
        return keccak256(abi.encodePacked(qfNode, labelHash));
    }
    
    function getAddress(bytes32 node) 
        external view returns (address) {
        return qnsResolver.addr(node);
    }
    
    function getName(address wallet) 
        external view returns (string memory) {
        return qnsResolver.reverseResolve(wallet);
    }
    
    // Example: Send payment to a QNS name node
    function sendToNode(bytes32 node) 
        external payable {
        address recipient = qnsResolver.addr(node);
        require(recipient != address(0), "Name not found");
        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "Transfer failed");
    }
}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg text-[#6A6A6A] hover:text-[#00D179] hover:bg-[#1E1E1E] transition-all duration-200"
      title="Copy"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-[#1E1E1E] last:border-0 text-left cursor-pointer hover:bg-[#1E1E1E]/30 transition-colors px-1 -mx-1 rounded"
    >
      <span className="text-sm text-[#8A8A8A] mb-1 sm:mb-0">{label}</span>
      <div className="flex items-center gap-3">
        <code className="text-sm text-[#00D179] font-mono break-all">{address}</code>
        <span className="text-xs text-[#00D179] whitespace-nowrap">
          {copied ? 'Copied!' : ''}
        </span>
      </div>
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono text-[#E0E0E0]">{code}</code>
      </pre>
      <div className="absolute top-3 left-4 text-xs text-[#6A6A6A] uppercase tracking-wider">
        {language}
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#00D179]/10 flex items-center justify-center">
          <Icon size={20} className="text-[#00D179]" />
        </div>
        <h2 className="font-clash font-semibold text-2xl text-white">{title}</h2>
      </div>
      <div className="pl-[52px]">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#1E1E1E]">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-clash font-semibold text-xl text-white tracking-tight hover:opacity-80 transition-opacity"
          >
            QNS<span className="text-[#00D179]">.</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-6">
        <div className="max-w-[1120px] mx-auto">
          {/* Header */}
          <div className="mb-12">
            <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-2">
              Developer Resources
            </p>
            <h1 className="font-clash font-semibold text-4xl text-white mb-4">
              QNS Documentation
            </h1>
            <p className="text-[#8A8A8A] max-w-2xl">
              Integrate Quantum Name Service into your applications. Resolve .qf names to 
              addresses and perform reverse lookups with minimal code.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">
            {/* Sidebar Navigation */}
            <aside className="hidden lg:block">
              <nav className="sticky top-28 space-y-1">
                <a
                  href="#contracts"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#8A8A8A] hover:text-white hover:bg-[#141414] transition-all"
                >
                  <Globe size={16} />
                  Contract Addresses
                </a>
                <a
                  href="#abi"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#8A8A8A] hover:text-white hover:bg-[#141414] transition-all"
                >
                  <FileCode size={16} />
                  Resolver ABI
                </a>
                <a
                  href="#how-it-works"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#8A8A8A] hover:text-white hover:bg-[#141414] transition-all"
                >
                  <ArrowRightLeft size={16} />
                  How It Works
                </a>
                <a
                  href="#papi"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#8A8A8A] hover:text-white hover:bg-[#141414] transition-all"
                >
                  <span className="w-4 text-center text-xs">JS</span>
                  JavaScript / TypeScript
                </a>
                <a
                  href="#solidity"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#8A8A8A] hover:text-white hover:bg-[#141414] transition-all"
                >
                  <span className="w-4 text-center text-xs">SOL</span>
                  Solidity Integration
                </a>
              </nav>
            </aside>

            {/* Content */}
            <div className="space-y-16">
              {/* Contract Addresses */}
              <Section id="contracts" title="Contract Addresses" icon={Globe}>
                <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-5">
                  <AddressRow label="QNS Registry" address={QNS_REGISTRY_ADDRESS} />
                  <AddressRow label="QNS Registrar" address={QNS_REGISTRAR_ADDRESS} />
                  <AddressRow label="QNS Resolver" address={QNS_RESOLVER_ADDRESS} />
                </div>
                <p className="text-sm text-[#6A6A6A] mt-3">
                  These addresses are also available as environment variables:{' '}
                  <code className="text-[#8A8A8A]">VITE_QNS_RESOLVER_ADDRESS</code>, etc.
                </p>
              </Section>

              {/* Resolver ABI */}
              <Section id="abi" title="Resolver ABI" icon={FileCode}>
                <p className="text-[#8A8A8A] mb-4">
                  The QNS Resolver provides two core functions for name resolution. 
                  Use <code className="text-[#00D179]">addr()</code> for forward lookups 
                  and <code className="text-[#00D179]">reverseResolve()</code> for reverse lookups.
                </p>
                <div className="relative group bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-5">
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={JSON.stringify(RESOLVER_ABI, null, 2)} />
                  </div>
                  <pre className="text-sm font-mono text-[#E0E0E0] overflow-x-auto">
                    {JSON.stringify(RESOLVER_ABI, null, 2)}
                  </pre>
                </div>
              </Section>

              {/* How It Works */}
              <Section id="how-it-works" title="How QNS Resolution Works" icon={ArrowRightLeft}>
                <div className="space-y-4 text-[#8A8A8A]">
                  <p>
                    QNS (Quantum Name Service) maps human-readable names like{' '}
                    <span className="text-[#00D179]">alice.qf</span> to blockchain addresses. 
                    The resolution process is straightforward:
                  </p>
                  <ol className="space-y-3 ml-5 list-decimal marker:text-[#00D179]">
                    <li>
                      <strong className="text-white">Forward Resolution:</strong> Call{' '}
                      <code className="text-[#00D179] bg-[#141414] px-1.5 py-0.5 rounded text-sm">
                        addr(namehash(&quot;alice.qf&quot;))
                      </code>{' '}
                      to get the associated address. Returns{' '}
                      <code className="text-[#E5484D]">0x0000...</code> if not found.
                    </li>
                    <li>
                      <strong className="text-white">Reverse Resolution:</strong> Call{' '}
                      <code className="text-[#00D179] bg-[#141414] px-1.5 py-0.5 rounded text-sm">
                        reverseResolve(0x1234...)
                      </code>{' '}
                      to get the primary name for an address. Returns empty string if not set.
                    </li>
                    <li>
                      <strong className="text-white">Namehash:</strong> Internally, names are 
                      converted to node hashes using EIP-137 namehash algorithm before storage.
                    </li>
                  </ol>
                  <div className="bg-[#00D179]/5 border border-[#00D179]/20 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong className="text-white">Note:</strong> Always validate that 
                      forward resolution returns a non-zero address before using the result. 
                      For reverse resolution, consider verifying the name still resolves back 
                      to the original address to prevent spoofing.
                    </p>
                  </div>
                  <div className="bg-[#141414] border border-[#1E1E1E] rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <strong className="text-white">QF Network Architecture:</strong>{' '}
                      QF Network uses Substrate + pallet-revive, so interaction is via{' '}
                      <code className="text-[#00D179]">polkadot-api</code> rather than standard EVM RPC. 
                      Users connect with Polkadot wallets (Talisman, SubWallet) and a one-time{' '}
                      <code className="text-[#00D179]">map_account</code> links their SS58 address 
                      to an on-chain EVM address.
                    </p>
                  </div>
                </div>
              </Section>

              {/* JavaScript / TypeScript Example */}
              <Section id="papi" title="JavaScript / TypeScript" icon={FileCode}>
                <p className="text-[#8A8A8A] mb-4">
                  Use polkadot-api (PAPI) to interact with QNS contracts on QF Network. 
                  viem is used only for ABI encoding/decoding — not for RPC calls.
                </p>
                <CodeBlock code={PAPI_EXAMPLE} language="TypeScript" />
              </Section>

              {/* Solidity Example */}
              <Section id="solidity" title="Solidity Integration" icon={FileCode}>
                <p className="text-[#8A8A8A] mb-4">
                  Integrate QNS resolution directly into your smart contracts. 
                  Perfect for accepting payments to names or displaying user identities. 
                  On-chain contract-to-contract calls work the same way regardless of frontend.
                </p>
                <CodeBlock code={SOLIDITY_EXAMPLE} language="Solidity" />
              </Section>

              {/* Footer */}
              <div className="pt-8 border-t border-[#1E1E1E]">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6A6A6A]">
                    Need help? Check out the{' '}
                    <a 
                      href="https://github.com/your-org/qns" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#00D179] hover:underline"
                    >
                      GitHub repo
                    </a>.
                  </p>
                  <span className="font-clash font-semibold text-white">
                    QNS<span className="text-[#00D179]">.</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
