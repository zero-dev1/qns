import { motion } from 'framer-motion';
import { Banknote, Database, UserRound, Users, Wrench } from 'lucide-react';

const pillars = [
  { title: 'Identity', icon: UserRound, active: true },
  { title: 'Money', icon: Banknote, active: false },
  { title: 'Work', icon: Wrench, active: false },
  { title: 'Community', icon: Users, active: false },
  { title: 'Data', icon: Database, active: false },
];

export default function Ecosystem() {
  return (
    <section className="py-24 overflow-x-clip">
      <div className="mx-auto max-w-[1120px]">
        <motion.p
          className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          MANIFESTO
        </motion.p>

        <motion.h2
          className="font-clash text-center text-4xl font-bold text-white md:text-5xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          The First Pillar
        </motion.h2>

        <div className="scrollbar-hide mx-auto mt-16 flex w-full max-w-full justify-start gap-4 overflow-x-auto overflow-y-hidden px-6 md:justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 40, scaleY: 0.8 }}
              whileInView={{ opacity: 1, y: 0, scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              style={{ transformOrigin: 'bottom' }}
            >
              <div
                className={`flex h-64 w-24 flex-col items-center justify-end rounded-2xl pb-6 transition-all duration-300 md:h-80 md:w-32 ${
                  pillar.active
                    ? 'border border-[#00D179]/30 bg-gradient-to-b from-[#00D179]/20 via-[#00D179]/10 to-[#00D179]/5'
                    : 'border border-white/10 bg-transparent hover:border-white/20'
                }`}
              >
                <pillar.icon
                  size={20}
                  className={pillar.active ? 'text-[#00D179]' : 'text-gray-600'}
                />
              </div>

              <p className={`mt-3 text-sm ${pillar.active ? 'font-semibold text-[#00D179]' : 'font-medium text-gray-500'}`}>
                {pillar.title}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mx-auto mt-12 max-w-lg px-6 text-center text-gray-400"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          QNS is the first pillar. Your name, your credentials, your continuity. Register once, carry it everywhere the ecosystem goes.
        </motion.p>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
