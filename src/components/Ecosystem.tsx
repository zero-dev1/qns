import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowLeftRight,
  LayoutGrid,
  Landmark,
  Rocket,
  CheckSquare,
  Globe,
  Wrench,
  MessageCircle,
  Swords,
  Brush,
  Sparkles,
} from 'lucide-react';
import SpotlightGrid from './SpotlightGrid';
import SpotlightCard from './SpotlightCard';
import PulseDot from './PulseDot';

type AppStatus = 'live' | 'soon' | 'dev';

interface EcosystemApp {
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  status: AppStatus;
  url?: string;
  featured?: boolean;
}

const apps: EcosystemApp[] = [
  {
    name: 'QNS',
    tagline: 'Your on-chain identity',
    description:
      'Register a .qf name, build your profile, and carry it across every app on QF Network.',
    icon: Globe,
    accentColor: '#00D179',
    status: 'live',
    url: '/',
    featured: true,
  },
  {
    name: 'QFPay',
    tagline: 'Send QF to anyone by name',
    description:
      'Instant payments to any .qf name with a 0.1% burn. Send to alice.qf, not 0x7a3b.',
    icon: ArrowLeftRight,
    accentColor: '#0040FF',
    status: 'soon',
  },
  {
    name: 'DappStore',
    tagline: 'One login. Every app.',
    description:
      'The central hub for decentralised apps on QF Network. Your .qf name carries across every app, no re-registration needed.',
    icon: LayoutGrid,
    accentColor: '#20EAE6',
    status: 'dev',
  },
  {
    name: 'NucleusX',
    tagline: 'Trade under your name',
    description:
      'The QF DEX. Swap, provide liquidity, and build your trading reputation as yourname.qf.',
    icon: Landmark,
    accentColor: '#5E3AAE',
    status: 'dev',
  },
  {
    name: 'QFPad',
    tagline: 'Launch with a verified identity',
    description:
      'Decentralized launchpad for QF projects. Creator credibility built into your .qf profile.',
    icon: Rocket,
    accentColor: '#89FBFE',
    status: 'dev',
  },
  {
    name: 'QFTools',
    tagline: 'Names, not addresses',
    description:
      'Explore blocks and transactions with .qf names resolved everywhere. See who is doing what, not which hex string.',
    icon: Wrench,
    accentColor: '#A1A1AA',
    status: 'dev',
  },
  {
    name: 'Quorum',
    tagline: 'Vote as yourself',
    description:
      'Governance with your .qf identity. Propose, vote, shape the network.',
    icon: CheckSquare,
    accentColor: '#6366F1',
    status: 'dev',
  },
  {
    name: 'QFLink',
    tagline: 'Message anyone by name',
    description:
      'Send messages to alice.qf, not an address. Token-gated pods, direct messages, fully on-chain. No server, just the chain.',
    icon: MessageCircle,
    accentColor: '#0991B2',
    status: 'dev',
  },
  {
    name: 'PROVD',
    tagline: 'Compete as yourself',
    description:
      '1v1 strategy card game tied to your .qf identity. Every move on-chain, every win under your name. Stake QF if you dare.',
    icon: Swords,
    accentColor: '#FF3131',
    status: 'dev',
  },
  {
    name: 'QF Scribble',
    tagline: 'Draw under your name',
    description:
      'Collaborative pixel canvas on QF Network. Every brushstroke tied to your .qf identity. No hex addresses, just names.',
    icon: Brush,
    accentColor: '#D3B76E',
    status: 'dev' as AppStatus,
  },
];

function StatusBadge({ status }: { status: AppStatus }) {
  if (status === 'live') {
    return (
      <div className="flex items-center gap-1.5 text-[#00D179]">
        <PulseDot color="bg-[#00D179]" />
        <span className="text-[11px] font-medium tracking-wide">Live</span>
      </div>
    );
  }

  const isImminent = status === 'soon';

  return (
    <div className="flex items-center gap-1.5 text-white/40">
      <PulseDot color={isImminent ? 'bg-amber-400' : 'bg-blue-400'} />
      <span className="text-[11px] font-medium tracking-wide">
        {isImminent ? 'Launching this week' : 'In development'}
      </span>
    </div>
  );
}

export default function Ecosystem() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
        {/* Section header */}
        <motion.p
          className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          ECOSYSTEM
        </motion.p>

        <motion.h2
          className="font-clash text-center text-4xl font-bold text-white md:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          One network. Everything connected.
        </motion.h2>

        <motion.p
          className="mx-auto mt-4 max-w-lg text-center text-[#666] md:text-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00D179] to-[#00B868]">.qf</span> identity works across every app in the ecosystem.
        </motion.p>

        {/* Bento Grid with Spotlight */}
        <SpotlightGrid className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, i) => (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: 0.2 + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={app.featured ? 'sm:col-span-2' : ''}
            >
              <SpotlightCard glowColor={app.accentColor} className="h-full">
                <div className={`p-6 ${app.featured ? 'md:p-8' : ''}`}>
                  {/* Icon + Status row */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300"
                      style={{
                        backgroundColor: `${app.accentColor}10`,
                        color: app.status === 'live' ? app.accentColor : '#555',
                      }}
                    >
                      <app.icon size={20} />
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  {/* Name */}
                  <h3 className="font-clash font-semibold text-xl text-white mb-1">{app.name}</h3>

                  {/* Tagline — the identity hook */}
                  <p className="text-sm font-medium mb-3" style={{ color: app.accentColor }}>
                    {app.tagline}
                  </p>

                  {/* Description */}
                  <p className={`text-sm text-[#666] leading-relaxed ${app.status !== 'live' ? 'opacity-70' : ''}`}>
                    {app.description}
                  </p>

                  {/* CTA — only for live apps */}
                  {app.status === 'live' && (
                    <button
                      onClick={() => {
                        const searchInput = document.querySelector<HTMLInputElement>(
                          '[data-search-input]'
                        );
                        if (searchInput) {
                          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          setTimeout(() => searchInput.focus(), 500);
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-[#00D179]/70 hover:text-[#00D179] transition-colors cursor-pointer"
                    >
                      You're here
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </SpotlightCard>
            </motion.div>
          ))}

          {/* "And many more" — final card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: 0.2 + apps.length * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <SpotlightCard glowColor="#00D179" className="h-full">
              <div className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D179]/10 mb-4">
                  <Sparkles size={20} className="text-[#00D179]" />
                </div>
                <h3 className="font-clash font-semibold text-xl text-white mb-2">
                  And many more
                </h3>
                <p className="text-sm text-[#666] leading-relaxed max-w-[240px]">
                  The QF ecosystem is growing. Every app resolves your .qf name from day one.
                </p>
              </div>
            </SpotlightCard>
          </motion.div>
        </SpotlightGrid>

        {/* Bottom message */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-sm text-[#444]">
            Built by{' '}
            <span className="text-[#666]">Dapp Labs</span>
            <span className="text-[#333] mx-1.5">·</span>
            An independent builders collective on QF Network
          </p>
        </motion.div>
      </div>
    </section>
  );
}
