import { useState, useEffect } from 'react';
import { getContractPrices, formatQF, calculatePrice } from '../utils/qns';
import { Loader2 } from 'lucide-react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

export default function Pricing() {
  const { elementRef: sectionRef, isVisible: sectionVisible } = useIntersectionObserver();

  const [prices, setPrices] = useState<{
    price3Char: bigint;
    price4Char: bigint;
    price5PlusChar: bigint;
    permanentMultiplier: bigint;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getContractPrices()
      .then(setPrices)
      .catch(console.error)
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
      example: 'ace.qf',
      price: price3,
      highlighted: false,
    },
    {
      label: 'Standard',
      chars: 4,
      example: 'alex.qf',
      price: price4,
      highlighted: true,
    },
    {
      label: 'Basic',
      chars: 5,
      example: 'alice.qf',
      price: price5,
      highlighted: false,
    },
  ];

  return (
    <section
      ref={sectionRef}
      className={`py-[100px] px-6 scroll-fade-in ${
        sectionVisible ? 'visible' : ''
      }`}
    >
      <div className="max-w-[1120px] mx-auto">
        <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-4 text-center">
          PRICING
        </p>
        <h2 className="font-clash font-medium text-[32px] text-white mb-3 text-center">
          Simple, transparent pricing
        </h2>
        <p className="font-satoshi text-lg text-[#8A8A8A] mb-10 text-center">
          All fees paid in QF. 95% funds development, 5% is burned forever.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-[#00D179] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.label}
                className={`relative rounded-2xl border transition-all duration-300 bg-[#0A0A0A] text-center ${
                  tier.highlighted
                    ? 'border-[#00D179] bg-[#00D17908] scale-105'
                    : 'border-[#1E1E1E] hover:border-[#333333]'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-[#00D179] text-black text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                
                <div className="p-8">
                  <p className="font-clash font-semibold text-xl text-white mb-1">
                    {tier.label}
                  </p>
                  
                  <p className="text-[#8A8A8A] text-sm mb-4">
                    {tier.chars} characters
                  </p>
                  
                  <p className="text-[#00D179] text-lg mb-6">
                    {tier.example}
                  </p>

                  {tier.price ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-3xl font-bold text-white">{formatQF(tier.price.annual)}</span>
                          <span className="text-[#00D179] font-medium">QF</span>
                        </div>
                        <p className="text-[#555555] text-sm mt-1">/ year</p>
                      </div>
                      
                      <div className="h-px bg-[#1E1E1E] w-full" />
                      
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-xl font-semibold text-white">{formatQF(tier.price.permanent)}</span>
                        <span className="text-[#00D179] font-medium">QF</span>
                        <span className="text-[#555555] text-sm ml-1">— own forever</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-7 bg-[#1E1E1E] rounded animate-pulse"></div>
                      <div className="h-px bg-[#1E1E1E]"></div>
                      <div className="h-5 bg-[#1E1E1E] rounded animate-pulse w-3/4 mx-auto"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center mt-8 text-sm text-[#555555] font-satoshi">
          Multi-year registration available. Renew anytime. 30-day grace period after expiry.
        </p>
      </div>

      <style>{`
        .scroll-fade-in {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .scroll-fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </section>
  );
}
