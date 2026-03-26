import { motion } from 'framer-motion';
import { Search, UserCircle, Globe } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Search,
    title: 'Search & claim',
    description: 'Type any name. See instantly if it\'s available. Register in one transaction — confirmed in seconds, not minutes.',
    detail: 'From 100 QF/year',
  },
  {
    num: '02',
    icon: UserCircle,
    title: 'Build your identity',
    description: 'Add your avatar, bio, and social links. Your .qf name becomes your on-chain profile that follows you everywhere.',
    detail: 'Avatar · Bio · Socials',
  },
  {
    num: '03',
    icon: Globe,
    title: 'Use it across QF',
    description: 'Every dApp on QF Network resolves your name. Send payments, vote in governance, trade on the DEX — all as yourname.qf.',
    detail: 'One name, every dApp',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1120px] mx-auto px-6">
        <motion.p
          className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          HOW IT WORKS
        </motion.p>

        <motion.h2
          className="font-clash text-center text-4xl font-bold text-white md:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Three steps. Sixty seconds.
        </motion.h2>

        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              className="group relative rounded-2xl border border-white/[0.06] bg-[#111] overflow-hidden transition-all duration-300 hover:border-[#00D179]/20"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              {/* Top accent line */}
              <div className="h-[2px] bg-gradient-to-r from-[#00D179]/40 via-[#00D179]/10 to-transparent" />

              <div className="p-7">
                {/* Step number + Icon row */}
                <div className="flex items-center justify-between mb-6">
                  <span className="font-clash text-4xl font-bold text-[#00D179]/20 group-hover:text-[#00D179]/40 transition-colors duration-300">
                    {step.num}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] text-[#444] group-hover:bg-[#00D179]/10 group-hover:text-[#00D179] transition-all duration-300">
                    <step.icon size={20} />
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-clash font-semibold text-xl text-white mb-3">{step.title}</h3>
                <p className="text-sm text-[#666] leading-relaxed mb-5">{step.description}</p>

                {/* Detail pill */}
                <span className="inline-flex text-[11px] px-3 py-1.5 rounded-full bg-white/[0.03] text-[#555] border border-white/[0.06]">
                  {step.detail}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
