import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Check, Book, Code, Globe, Key, FileText } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  QNS_REGISTRY_ADDRESS,
  QNS_RESOLVER_ADDRESS,
  QNS_REGISTRAR_ADDRESS,
} from '../config/contracts';

const sections = [
  { id: 'overview', label: 'Overview', icon: Book },
  { id: 'contracts', label: 'Contract Addresses', icon: Key },
  { id: 'how-it-works', label: 'How It Works', icon: Globe },
  { id: 'text-records', label: 'Text Records', icon: FileText },
  { id: 'integrate-js', label: 'JavaScript / TypeScript', icon: Code },
  { id: 'integrate-sol', label: 'Solidity', icon: Code },
];


const PAPI_EXAMPLE = `import { encodeFunctionData, decodeFunctionResult, keccak256, toHex, encodePacked } from 'viem';
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

const ORIGIN_SS58 = '5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM'; // Any valid SS58 address

// === READ EXAMPLE ===
async function resolveName(typedApi: any, name: string) {
  const node = namehash(name);
  
  const calldata = encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: 'addr',
    args: [node],
  });
  
  const result = await typedApi.apis.ReviveApi.call(
    ORIGIN_SS58,  // origin SS58 address
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
    ORIGIN_SS58,
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
        bytes32 qfNode = 0xd2053912931651d18bb9045a93e991724ea9e28b11010c9d5433d664804ff6cb;
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[#555] hover:text-[#00D179] hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
    >
      {copied ? <Check size={12} className="text-[#00D179]" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[#0A0A0A] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#444]">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-[#999] font-mono text-[13px]">{code}</code>
      </pre>
    </div>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-[#666]">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono text-[#00D179] break-all">{address}</code>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const location = useLocation();
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll spy — highlight active section in sidebar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        sectionRefs.current[id] = el;
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  // Handle hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0A0A0A]">
        <div className="max-w-[1120px] mx-auto px-6 py-12 md:py-20">
          <div className="flex gap-12">
            {/* Sidebar — desktop only */}
            <nav className="hidden lg:block w-[200px] shrink-0">
              <div className="sticky top-24 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#444] mb-4 px-3">Documentation</p>
                {sections.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                      activeSection === id
                        ? 'text-[#00D179] bg-[#00D179]/[0.06]'
                        : 'text-[#555] hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Main content */}
            <main className="flex-1 min-w-0 max-w-3xl">
              {/* Mobile section nav */}
              <div className="lg:hidden mb-8 -mx-6 px-6 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 min-w-max">
                  {sections.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                        activeSection === id
                          ? 'bg-[#00D179]/10 text-[#00D179] border border-[#00D179]/20'
                          : 'bg-white/[0.03] text-[#555] border border-white/[0.06]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overview Section */}
              <section id="overview" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">Overview</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  Integrate Quantum Name Service into your applications. Resolve .qf names to 
                  addresses and perform reverse lookups with minimal code.
                </p>
                <div className="bg-[#00D179]/5 border border-[#00D179]/20 rounded-lg p-4">
                  <p className="text-sm text-[#666]">
                    <strong className="text-white">QNS</strong> is the identity layer for QF Network, 
                    providing human-readable names that map to blockchain addresses.
                  </p>
                </div>
              </section>

              {/* Contract Addresses */}
              <section id="contracts" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">Contract Addresses</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  Core QNS smart contract addresses on QF Network.
                </p>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                  <AddressRow label="QNS Registry" address={QNS_REGISTRY_ADDRESS} />
                  <AddressRow label="QNS Registrar" address={QNS_REGISTRAR_ADDRESS} />
                  <AddressRow label="QNS Resolver" address={QNS_RESOLVER_ADDRESS} />
                </div>
                <p className="text-sm text-[#666] mt-4">
                  These addresses are also available as environment variables for your builds.
                </p>
              </section>

              {/* How It Works */}
              <section id="how-it-works" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">How It Works</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  QNS maps human-readable names like <code className="text-[#00D179]">alice.qf</code> to blockchain addresses.
                </p>
                <div className="space-y-4 text-[#666]">
                  <ol className="space-y-3 ml-5 list-decimal marker:text-[#00D179]">
                    <li>
                      <strong className="text-white">Forward Resolution:</strong> Call{' '}
                      <code className="text-[#00D179] bg-white/[0.06] px-1.5 py-0.5 rounded text-sm">
                        addr(namehash("alice.qf"))
                      </code>{' '}
                      to get the associated address.
                    </li>
                    <li>
                      <strong className="text-white">Reverse Resolution:</strong> Call{' '}
                      <code className="text-[#00D179] bg-white/[0.06] px-1.5 py-0.5 rounded text-sm">
                        reverseResolve(0x1234...)
                      </code>{' '}
                      to get the primary name for an address.
                    </li>
                    <li>
                      <strong className="text-white">Namehash:</strong> Names are converted to node hashes using EIP-137 algorithm.
                    </li>
                  </ol>
                  <div className="bg-[#00D179]/5 border border-[#00D179]/20 rounded-lg p-4">
                    <p className="text-sm">
                      <strong className="text-white">QF Network Architecture:</strong>{' '}
                      Uses Substrate + pallet-revive. Interact via{' '}
                      <code className="text-[#00D179]">polkadot-api</code> rather than standard EVM RPC.
                    </p>
                  </div>
                </div>
              </section>

              {/* Text Records */}
              <section id="text-records" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">Text Records</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  QNS names can store profile metadata as text records for avatars, bios, and social links.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-medium mb-2">Supported Keys</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['avatar', 'bio', 'twitter', 'github', 'url', 'telegram'].map(key => (
                        <code key={key} className="bg-white/[0.06] text-[#00D179] px-2 py-1 rounded text-sm">
                          {key}
                        </code>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-2">Reading Text Records</h4>
                    <p className="text-[#666] mb-3">
                      Use the resolver's <code className="text-[#00D179]">text(node, key)</code> function:
                    </p>
                    <CodeBlock 
                      code={`// Read text records for a QNS name
const node = namehash("alice.qf");
const avatar = await resolver.text(node, "avatar");
const bio = await resolver.text(node, "bio");
const twitter = await resolver.text(node, "twitter");

console.log(\`Avatar: \${avatar}\`);
console.log(\`Bio: \${bio}\`);
console.log(\`Twitter: \${twitter}\`);`} 
                      language="JavaScript" 
                    />
                  </div>
                </div>
              </section>

              {/* JavaScript / TypeScript */}
              <section id="integrate-js" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">JavaScript / TypeScript</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  Use polkadot-api (PAPI) to interact with QNS contracts on QF Network. viem is used for ABI encoding/decoding.
                </p>
                <CodeBlock code={PAPI_EXAMPLE} language="TypeScript" />
              </section>

              {/* Solidity */}
              <section id="integrate-sol" className="mb-16 scroll-mt-24">
                <h2 className="font-clash text-2xl font-semibold text-white mb-2">Solidity</h2>
                <p className="text-[#666] mb-6 leading-relaxed">
                  Integrate QNS resolution directly into your smart contracts for accepting payments to names.
                </p>
                <CodeBlock code={SOLIDITY_EXAMPLE} language="Solidity" />
              </section>
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
