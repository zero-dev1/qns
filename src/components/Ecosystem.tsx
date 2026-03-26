import { motion } from 'framer-motion';
import { ArrowLeftRight, Landmark, Rocket, Gamepad2, Store, CheckSquare } from 'lucide-react';

const dapps = [
  {
    name: 'QFPay',
    description: 'Send QF to any .qf name. As easy as Venmo.',
    icon: ArrowLeftRight,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
  {
    name: 'NucleusX',
    description: 'Trade on the QF DEX with your name, not an address.',
    icon: Landmark,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
  {
    name: 'Quorum',
    description: 'Vote on governance proposals as yourname.qf.',
    icon: CheckSquare,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
  {
    name: 'QFPad',
    description: 'Launch and discover projects with .qf creator profiles.',
    icon: Rocket,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
  {
    name: 'DappStore',
    description: 'Developer profiles and dApp branding with .qf names.',
    icon: Store,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
  {
    name: 'Mini Games',
    description: 'Compete on leaderboards as yourname.qf.',
    icon: Gamepad2,
    status: 'Coming Soon' as const,
    color: '#00D179',
  },
];

export default function Ecosystem() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
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
          One name. Every dApp.
        </motion.h2>

        <motion.p
          className="mx-auto mt-4 max-w-md text-center text-[#666] md:text-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Register once. Recognized everywhere the ecosystem goes.
        </motion.p>

        {/* dApp Grid */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dapps.map((dapp, i) => (
            <motion.div
              key={dapp.name}
              className="group relative rounded-2xl border border-white/[0.06] bg-[#111] p-6 transition-all duration-300 hover:border-[#00D179]/20 hover:bg-[#111]/80"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              {/* Icon */}
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-[#555] transition-colors duration-300 group-hover:bg-[#00D179]/10 group-hover:text-[#00D179]">
                <dapp.icon size={20} />
              </div>

              {/* Name + Status */}
              <div className="flex items-center gap-2.5 mb-2">
                <h3 className="font-semibold text-white">{dapp.name}</h3>
                <span className="text-[10px] uppercase tracking-wider text-[#555] bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {dapp.status}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-[#555] leading-relaxed">{dapp.description}</p>
            </motion.div>
          ))}
        </div>

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
