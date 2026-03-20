import { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
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

  // Calculate prices for display
  const getTierPrices = (charLength: 3 | 4 | 5) => {
    if (!prices) return null;
    
    const annual = calculatePrice(charLength, 1, false, prices);
    const permanent = calculatePrice(charLength, 1, true, prices);
    
    return { annual, permanent };
  };

  const price3 = getTierPrices(3);
  const price4 = getTierPrices(4);
  const price5 = getTierPrices(5);

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
      <div className="mx-auto max-w-[1120px]">
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
          className="mx-auto mb-16 max-w-lg text-center text-gray-400 md:text-base"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          All fees paid in QF. <span className="text-[#00D179]">95%</span> funds development, <span className="text-red-500">5%</span> is burned forever.
        </motion.p>

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
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 md:grid-cols-3">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.label}
                className={`group relative overflow-hidden rounded-2xl bg-[#111] p-8 transition-all duration-300 ${
                  tier.highlighted
                    ? 'border border-[#00D179]/30 shadow-[0_0_30px_rgba(0,209,121,0.06)] md:-translate-y-2 hover:border-[#00D179]/50'
                    : 'border border-white/5 hover:border-[#00D179]/20'
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                whileHover={{ y: -4 }}
              >
                {tier.highlighted && (
                  <div className="pricing-shimmer absolute top-4 right-4 rounded-full bg-[#00D179]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179]">
                    MOST POPULAR
                  </div>
                )}

                <p className="mb-6 font-mono text-sm text-[#00D179]">{tier.example}</p>

                <p className="mb-1 text-lg font-semibold text-white">{tier.label}</p>

                <p className="mb-8 text-sm text-gray-500">{tier.range}</p>

                {tier.price ? (
                  <>
                    <div>
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-white">{formatQF(tier.price.annual)}</span>
                        <span className="ml-1 text-lg text-[#00D179]">QF</span>
                      </div>
                      <span className="text-sm text-gray-500">/year</span>
                    </div>

                    <div className="border-t border-white/5 my-6" />

                    <div>
                      <div className="flex items-baseline">
                        <span className="text-xl font-bold text-white">{formatQF(tier.price.permanent)}</span>
                        <span className="ml-1 text-sm text-[#00D179]">QF</span>
                        <span className="ml-1 text-sm text-gray-500"> — own forever</span>
                      </div>
                    </div>

                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="h-10 w-32 rounded bg-[#1E1E1E] animate-pulse" />
                      <div className="h-4 w-40 rounded bg-[#1E1E1E] animate-pulse" />
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <motion.p
          className="mt-12 text-center text-sm text-gray-500"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Multi-year registration available. Renew anytime. 30-day grace period after expiry.
        </motion.p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
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
      `}</style>
    </section>
  );
}
