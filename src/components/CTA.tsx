import { motion } from 'framer-motion';

const exampleNames = ['legend', 'pioneer', 'builder', 'voyager', 'cosmic', 'onchain', 'diamond', 'rocket'];

export default function CTA() {
  const handleScrollToSearch = () => {
    const heroSearchInput = document.querySelector<HTMLInputElement>(
      'input[placeholder="Search for a name"]'
    );
    if (heroSearchInput) {
      heroSearchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => heroSearchInput.focus(), 450);
    }
  };

  return (
    <section className="relative py-32 text-center overflow-hidden">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,209,121,0.05)_0%,transparent_70%)]" />

      <motion.div
        className="relative z-10 mx-auto max-w-[1120px] px-6"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <p className="mb-4 text-xs font-medium tracking-[0.3em] text-[#00D179]">
          DON'T WAIT
        </p>

        <h2 className="font-clash mb-6 text-4xl font-bold text-white md:text-6xl">
          The best names go first
        </h2>

        <p className="mx-auto mb-8 max-w-md text-lg text-[#555]">
          400+ names are already reserved. Thousands more are open — for now.
        </p>

        {/* Floating name examples */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-lg mx-auto">
          {exampleNames.map((name, i) => (
            <motion.span
              key={name}
              className="text-sm px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[#555]"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
            >
              {name}<span className="text-[#00D179]">.qf</span>
            </motion.span>
          ))}
        </div>

        <motion.button
          onClick={handleScrollToSearch}
          className="cursor-pointer rounded-full bg-[#00D179] px-8 py-4 text-lg font-semibold text-black transition-colors duration-200 hover:bg-[#00E88A]"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Claim yours now
        </motion.button>
      </motion.div>
    </section>
  );
}
