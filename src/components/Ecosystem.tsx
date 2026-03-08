const dapps = [
  {
    name: 'QFLink',
    description: 'Message anyone by their .qf name. No more copying hex addresses.',
    status: 'Live' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <path d="M16 20l8-4 8 4v8l-8 4-8-4z" stroke="#00D179" strokeWidth="1.5" fill="none" />
        <path d="M24 16v16M16 20l8 4 8-4" stroke="#00D179" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: 'QFClash',
    description: 'Player profiles and leaderboards powered by .qf identity.',
    status: 'Coming Soon' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <rect x="14" y="12" width="10" height="14" rx="1" stroke="#00D179" strokeWidth="1.5" />
        <rect x="24" y="16" width="10" height="14" rx="1" stroke="#00D179" strokeWidth="1.5" />
        <path d="M19 22h4M29 26h4" stroke="#00D179" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'NucleusX',
    description: 'Send and receive tokens to yourname.qf on the QF DEX.',
    status: 'Coming Soon' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <circle cx="24" cy="24" r="7" stroke="#555555" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="2" fill="#555555" />
      </svg>
    ),
  },
  {
    name: 'QFPad',
    description: 'Project discovery and creator profiles with .qf names.',
    status: 'Coming Soon' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <rect x="17" y="16" width="14" height="16" rx="2" stroke="#555555" strokeWidth="1.5" />
        <path d="M21 21h6M21 25h4" stroke="#555555" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: '52F',
    description: 'Holder identity and leaderboard profiles for the deflationary engine.',
    status: 'Coming Soon' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="#555555" fontSize="14" fontWeight="600" fontFamily="system-ui">52!</text>
      </svg>
    ),
  },
  {
    name: 'QF dApp Store',
    description: 'Developer profiles and dApp branding with .qf names.',
    status: 'Coming Soon' as const,
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill="#1E1E1E" />
        <rect x="16" y="16" width="16" height="16" rx="3" stroke="#555555" strokeWidth="1.5" />
        <path d="M22 16v16M16 22h16" stroke="#555555" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function Ecosystem() {
  return (
    <section className="py-[100px] px-6">
      <div className="max-w-[1120px] mx-auto">
        <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-4 text-center">
          ECOSYSTEM
        </p>
        <h2 className="font-clash font-medium text-[32px] text-white mb-3 text-center">
          One name. Every dApp.
        </h2>
        <p className="font-satoshi text-lg text-[#8A8A8A] max-w-[480px] mx-auto mb-10 text-center">
          QNS is the identity layer for Quantum Fusion. Register once, recognized everywhere.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dapps.map((dapp) => (
            <div
              key={dapp.name}
              className="border border-[#1E1E1E] rounded-xl p-6 hover:border-[#00D1794D] transition-colors duration-200"
            >
              <div className="mb-4">{dapp.icon}</div>
              <h3 className="font-satoshi font-medium text-lg text-white mb-1">
                {dapp.name}
              </h3>
              <p className="font-satoshi text-sm text-[#8A8A8A] mb-3 leading-relaxed">
                {dapp.description}
              </p>
              <span
                className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                  dapp.status === 'Live'
                    ? 'text-[#00D179] bg-[#00D17915]'
                    : 'text-[#555555] bg-[#55555515]'
                }`}
              >
                {dapp.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
