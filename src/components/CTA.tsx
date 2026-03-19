import { motion } from 'framer-motion';

export default function CTA() {
  const handleScrollToSearch = () => {
    const heroSearchInput = document.querySelector<HTMLInputElement>(
      'input[placeholder="Search for a name"]'
    );

    if (heroSearchInput) {
      heroSearchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        heroSearchInput.focus();
      }, 450);
    }
  };

  return (
    <section className="relative py-32 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,209,121,0.06)_0%,transparent_70%)]" />

      <motion.div
        className="relative z-10 mx-auto max-w-[1120px] px-6"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      >
        <p className="mb-4 text-sm font-medium tracking-[0.3em] text-[#00D179]">
          READY?
        </p>

        <h2 className="font-clash mb-6 text-5xl font-bold text-white md:text-6xl">
          Claim your .qf name
        </h2>

        <p className="mx-auto mb-10 max-w-md text-lg text-gray-400">
          Be among the first to build your identity on QF Network.
        </p>

        <motion.button
          onClick={handleScrollToSearch}
          className="cursor-pointer rounded-full bg-[#00D179] px-8 py-4 text-lg font-semibold text-black transition-colors duration-200 hover:bg-[#00E88A]"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Search Names
        </motion.button>
      </motion.div>
    </section>
  );
}
