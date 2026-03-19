import { motion } from 'framer-motion';

const cards = [
  {
    num: '01',
    title: 'Claim your name',
    description:
      'Search for any name, pick your duration, and register in a single transaction. Done in seconds.',
  },
  {
    num: '02',
    title: 'Set your profile',
    description:
      'Add an avatar, bio, and social links. Your .qf name becomes your onchain identity.',
  },
  {
    num: '03',
    title: 'Use it everywhere',
    description:
      'Every dApp on QF Network recognizes your name. Send, receive, and interact with a name instead of an address.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6 text-center">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-xs tracking-[0.3em] text-[#00D179] uppercase"
        >
          How It Works
        </motion.p>

        {/* Title - use Clash Display font like other sections */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-white mt-4 font-clash"
        >
          Three simple steps
        </motion.h2>

        {/* 3 cards in a row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden text-left hover:border-[#00D179]/20 transition-all duration-300"
            >
              {/* Emerald gradient header band */}
              <div className="h-2 bg-gradient-to-r from-[#00D179]/30 via-[#00D179]/10 to-transparent" />
              <div className="p-8">
                {/* Step number */}
                <span className="text-5xl font-bold text-[#00D179]">
                  {card.num}
                </span>
                {/* Title */}
                <h3 className="text-xl font-semibold text-white mt-4">
                  {card.title}
                </h3>
                {/* Description */}
                <p className="text-gray-400 mt-3 leading-relaxed text-sm">
                  {card.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
