const dapps = [
  {
    name: 'QFLink',
    description: 'Message anyone by their .qf name. No more copying hex addresses.',
    status: 'Live' as const,
    color: '#0991B2',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <path d="M16 20l8-4 8 4v8l-8 4-8-4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M24 16v16M16 20l8 4 8-4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: 'QFClash',
    description: 'Player profiles and leaderboards powered by .qf identity.',
    status: 'Coming Soon' as const,
    color: '#FF3131',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <rect x="14" y="12" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="24" y="16" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M19 22h4M29 26h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'NucleusX',
    description: 'Send and receive tokens to yourname.qf on the QF DEX.',
    status: 'Coming Soon' as const,
    color: '#B311FF',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'QFPad',
    description: 'Project discovery and creator profiles with .qf names.',
    status: 'Coming Soon' as const,
    color: '#A4F7FD',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <rect x="17" y="16" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 21h6M21 25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: '52F',
    description: 'Holder identity and leaderboard profiles for the deflationary engine.',
    status: 'Coming Soon' as const,
    color: '#C9A74C',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600" fontFamily="system-ui">52!</text>
      </svg>
    ),
  },
  {
    name: 'QF dApp Store',
    description: 'Developer profiles and dApp branding with .qf names.',
    status: 'Coming Soon' as const,
    color: '#1FE2DC',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-current">
        <rect width="48" height="48" rx="12" fill="currentColor" fillOpacity="0.15" />
        <rect x="16" y="16" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M22 16v16M16 22h16" stroke="currentColor" strokeWidth="1.5" />
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
          QNS is the identity layer for QF Network. Register once, recognized everywhere.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dapps.map((dapp) => {
            const isLightColor = dapp.color === '#A4F7FD';
            return (
              <div
                key={dapp.name}
                className="group border rounded-xl p-6 transition-all duration-300 ease"
                style={{
                  borderColor: `${dapp.color}4D`, // ~30% opacity
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = dapp.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${dapp.color}4D`;
                }}
              >
                <div
                  className="mb-4 transition-all duration-300 ease"
                  style={{ color: dapp.color }}
                >
                  <div className="transition-all duration-300 ease group-hover:[&>svg]:text-white">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                      className="transition-all duration-300 ease"
                      style={{
                        color: dapp.color,
                      }}
                    >
                      <rect
                        width="48"
                        height="48"
                        rx="12"
                        fill={dapp.color}
                        fillOpacity="0.15"
                        className="transition-all duration-300 ease group-hover:fill-opacity-100"
                      />
                      {dapp.name === 'QFLink' && (
                        <>
                          <path d="M16 20l8-4 8 4v8l-8 4-8-4z" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" fill="none" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <path d="M24 16v16M16 20l8 4 8-4" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <path d="M16 20l8-4 8 4v8l-8 4-8-4z" stroke="currentColor" strokeWidth="1.5" fill="none" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <path d="M24 16v16M16 20l8 4 8-4" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                        </>
                      )}
                      {dapp.name === 'QFClash' && (
                        <>
                          <rect x="14" y="12" width="10" height="14" rx="1" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <rect x="24" y="16" width="10" height="14" rx="1" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <path d="M19 22h4M29 26h4" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <rect x="14" y="12" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <rect x="24" y="16" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <path d="M19 22h4M29 26h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300 ease group-hover:opacity-0" />
                        </>
                      )}
                      {dapp.name === 'NucleusX' && (
                        <>
                          <circle cx="24" cy="24" r="7" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <circle cx="24" cy="24" r="2" fill={isLightColor ? 'black' : 'white'} className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <circle cx="24" cy="24" r="2" fill="currentColor" className="transition-all duration-300 ease group-hover:opacity-0" />
                        </>
                      )}
                      {dapp.name === 'QFPad' && (
                        <>
                          <rect x="17" y="16" width="14" height="16" rx="2" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <path d="M21 21h6M21 25h4" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <rect x="17" y="16" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <path d="M21 21h6M21 25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-300 ease group-hover:opacity-0" />
                        </>
                      )}
                      {dapp.name === '52F' && (
                        <>
                          <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill={isLightColor ? 'black' : 'white'} fontSize="14" fontWeight="600" fontFamily="system-ui" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100">52!</text>
                          <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="600" fontFamily="system-ui" className="transition-all duration-300 ease group-hover:opacity-0">52!</text>
                        </>
                      )}
                      {dapp.name === 'QF dApp Store' && (
                        <>
                          <rect x="16" y="16" width="16" height="16" rx="3" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <path d="M22 16v16M16 22h16" stroke={isLightColor ? 'black' : 'white'} strokeWidth="1.5" className="transition-all duration-300 ease opacity-0 group-hover:opacity-100" />
                          <rect x="16" y="16" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                          <path d="M22 16v16M16 22h16" stroke="currentColor" strokeWidth="1.5" className="transition-all duration-300 ease group-hover:opacity-0" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
