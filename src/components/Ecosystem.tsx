import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowLeftRight, Landmark, Rocket, Gamepad2, CheckSquare, Globe } from 'lucide-react';
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
    description: 'Register a .qf name, build your profile, and carry it across every app on QF Network.',
    icon: Globe,
    accentColor: '#00D179',
    status: 'live',
    url: '/',
    featured: true,
  },
  {
    name: 'QFPay',
    tagline: 'Send QF to anyone by name',
    description: 'Instant payments with a 0.1% burn. alice.qf, not 0x7a3b…',
    icon: ArrowLeftRight,
    accentColor: '#3b82f6',
    status: 'soon',
  },
  {
    name: 'Quorum',
    tagline: 'Vote as yourself',
    description: 'Governance with your .qf identity. Propose, vote, shape the network.',
    icon: CheckSquare,
    accentColor: '#8b5cf6',
    status: 'dev',
  },
  {
    name: 'NucleusX',
    tagline: 'Trade under your name',
    description: 'The QF DEX. Swap, provide liquidity, and build reputation as yourname.qf.',
    icon: Landmark,
    accentColor: '#f59e0b',
    status: 'dev',
  },
  {
    name: 'QFPad',
    tagline: 'Launch with a verified identity',
    description: 'Decentralized launchpad for QF projects. Creator profiles powered by .qf names.',
    icon: Rocket,
    accentColor: '#ef4444',
    status: 'dev',
  },
  {
    name: 'Mini Games',
    tagline: 'Compete as yourname.qf',
    description: 'On-chain leaderboards, tournaments, and bragging rights — all tied to your identity.',
    icon: Gamepad2,
    accentColor: '#ec4899',
    status: 'dev',
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
                delay: 0.2 + i * 0.08,
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
                  {app.status === 'live' && app.url && (
                    <a
                      href={app.url}
                      className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-white/80 hover:text-white transition-colors"
                    >
                      Open App
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
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
