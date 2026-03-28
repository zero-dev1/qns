import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getContractPrices, formatQF, calculatePrice } from '../utils/qns';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function Pricing() {
  const [prices, setPrices] = useState<{
    price3Char: bigint;
    price4Char: bigint;
    price5PlusChar: bigint;
    permanentMultiplier: bigint;
    fromContract?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [mode, setMode] = useState<'annual' | 'forever'>('annual');

  useEffect(() => {
    setLoading(true);
    setUsingFallback(false);
    getContractPrices()
      .then((result) => {
        setPrices(result);
        setUsingFallback(!result.fromContract);
      })
      .catch(() => {
        setUsingFallback(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const getTierPrices = (charLength: 3 | 4 | 5) => {
    if (!prices) return null;
    const annual = calculatePrice(charLength, 1, false, prices);
    const permanent = calculatePrice(charLength, 1, true, prices);
    return { annual, permanent };
  };

  const price3 = getTierPrices(3);
  const price4 = getTierPrices(4);
  const price5 = getTierPrices(5);

  const isForever = mode === 'forever';

  const tiers = [
    {
      label: 'Premium',
      chars: 3,
      range: '3 characters',
      example: 'ace.qf',
      price: price3,
      highlighted: false,
    },
    {
      label: 'Standard',
      chars: 4,
      range: '4 characters',
      example: 'alex.qf',
      price: price4,
      highlighted: true,
    },
    {
      label: 'Basic',
      chars: 5,
      range: '5+ characters',
      example: 'alice.qf',
      price: price5,
      highlighted: false,
    },
  ];

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-[1120px] px-6">
        <motion.p
          className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          PRICING
        </motion.p>
        <motion.h2
          className="font-clash mb-4 text-center text-3xl font-bold text-white md:text-5xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Simple, transparent pricing
        </motion.h2>
        <motion.p
          className="mx-auto mb-6 max-w-lg text-center text-gray-400 md:text-base"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          All fees paid in QF. <span className="text-[#00D179]">95%</span> funds development, <span className="text-red-500">5%</span> is burned forever.
        </motion.p>

        {/* Annual / Forever toggle */}
        <motion.div
          className="mx-auto mb-12 flex w-fit items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            onClick={() => setMode('annual')}
            className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ${
              mode === 'annual' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {mode === 'annual' && (
              <motion.div
                layoutId="pricing-toggle"
                className="absolute inset-0 rounded-full bg-white/[0.08]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">Annual</span>
          </button>
          <button
            onClick={() => setMode('forever')}
            className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ${
              mode === 'forever' ? 'text-[#00D179]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {mode === 'forever' && (
              <motion.div
                layoutId="pricing-toggle"
                className="absolute inset-0 rounded-full bg-[#00D179]/[0.10] border border-[#00D179]/20"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">Forever</span>
          </button>
        </motion.div>

        {/* Network unavailable warning */}
        {usingFallback && (
          <motion.div
            className="mx-auto max-w-2xl mb-8 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle size={18} />
              <span className="text-sm font-medium">
                Network unavailable. Showing default prices. Some features may be limited.
              </span>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-[#00D179] animate-spin" />
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            {tiers.map((tier, index) => {
              const displayPrice = tier.price
                ? isForever
                  ? tier.price.permanent
                  : tier.price.annual
                : null;

              return (
                <motion.div
                  key={tier.label}
                  className={`group relative overflow-hidden rounded-2xl p-8 transition-all duration-500 ${
                    isForever
                      ? `border bg-gradient-to-b from-[#00D179]/[0.07] via-[#00D179]/[0.03] to-[#111] ${
                          tier.highlighted
                            ? 'border-[#00D179]/40 shadow-[0_0_50px_rgba(0,209,121,0.08)] md:-translate-y-2'
                            : 'border-[#00D179]/20 hover:border-[#00D179]/30 shadow-[0_0_40px_rgba(0,209,121,0.04)]'
                        }`
                      : `bg-[#111] ${
                          tier.highlighted
                            ? 'border border-[#00D179]/30 shadow-[0_0_30px_rgba(0,209,121,0.06)] md:-translate-y-2 hover:border-[#00D179]/50'
                            : 'border border-white/5 hover:border-[#00D179]/20'
                        }`
                  }`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.12 }}
                  whileHover={{ y: -4 }}
                >
                  {isForever && (
                    <div className="absolute inset-0 rounded-2xl pointer-events-none z-0">
                      <div className="absolute inset-0 rounded-2xl pricing-card-shimmer" />
                    </div>
                  )}

                  {/* Hover spotlight */}
                  <div
                    className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
                      isForever
                        ? 'bg-[radial-gradient(600px_circle_at_50%_0%,rgba(0,209,121,0.06),transparent_40%)]'
                        : 'bg-[radial-gradient(600px_circle_at_50%_0%,rgba(255,255,255,0.03),transparent_40%)]'
                    }`}
                  />

                  {/* Badge row — uniform height across all cards */}
                  <div className="flex justify-end items-center h-7 mb-2">
                    {tier.highlighted && (
                      <div className="pricing-shimmer rounded-full bg-[#00D179]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179]">
                        MOST POPULAR
                      </div>
                    )}
                  </div>

                  <p className="font-mono text-sm text-[#00D179] mb-6">
                    {tier.example}
                  </p>
                  <p className="mb-1 text-lg font-semibold text-white">{tier.label}</p>
                  <p className="mb-8 text-sm text-gray-500">{tier.range}</p>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mode}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      {displayPrice !== null ? (
                        <div>
                          <div className="flex items-baseline">
                            <span className="text-4xl font-bold text-white">
                              {formatQF(displayPrice)}
                            </span>
                            <span className="ml-1.5 text-lg text-[#00D179]">QF</span>
                          </div>
                          <span
                            className={`mt-1 block text-sm ${
                              isForever ? 'text-[#00D179]/60' : 'text-gray-500'
                            }`}
                          >
                            {isForever ? 'own forever' : '/year'}
                          </span>

                          {isForever && prices && (
                            <p className="mt-3 text-xs text-gray-500">
                              Equivalent to {Number(prices.permanentMultiplier)} years
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-10 w-32 rounded bg-[#1E1E1E] animate-pulse" />
                          <div className="h-4 w-24 rounded bg-[#1E1E1E] animate-pulse" />
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.p
          className="mt-12 text-center text-sm text-gray-500"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Multi-year registration available at checkout. Renew anytime. 30-day grace period after expiry.
        </motion.p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .pricing-shimmer {
          position: relative;
          overflow: hidden;
        }
        .pricing-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(110deg, transparent 30%, rgba(0, 209, 121, 0.15) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: shimmer 4s infinite;
          pointer-events: none;
        }
        .pricing-card-shimmer {
          background: linear-gradient(
            110deg,
            transparent 20%,
            rgba(0, 209, 121, 0.04) 40%,
            rgba(0, 209, 121, 0.08) 50%,
            rgba(0, 209, 121, 0.04) 60%,
            transparent 80%
          );
          background-size: 200% 100%;
          animation: shimmer 4s infinite;
        }
      `}</style>
    </section>
  );
}
