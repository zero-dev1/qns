import { useState, useEffect } from 'react';
import { getContractPrices, formatQF, formatUSD, calculatePrice } from '../utils/qns';
import { Loader2 } from 'lucide-react';

export default function Pricing() {
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
      chars: '3 characters',
      example: 'ace',
      prices: price3,
      highlighted: false,
    },
    {
      label: 'Standard',
      chars: '4 characters',
      example: 'alex',
      prices: price4,
      highlighted: true,
    },
    {
      label: 'Basic',
      chars: '5+ characters',
      example: 'alice',
      prices: price5,
      highlighted: false,
    },
  ];

  return (
    <section className="py-[100px] px-6">
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
                className={`relative rounded-xl p-8 md:p-10 border text-center ${
                  tier.highlighted ? 'bg-[#0D1512] border-[#00D179]' : 'border-[#1E1E1E]'
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-black bg-[#00D179] px-3 py-1 rounded-full">
                    Most popular
                  </span>
                )}

                <p className="font-satoshi font-medium text-sm mb-1 text-[#8A8A8A]">
                  {tier.label}
                </p>
                <p className="font-satoshi text-xs mb-6 text-[#555555]">
                  {tier.chars}
                </p>

                <p className="font-satoshi font-medium text-white mb-8">
                  {tier.example}<span className="text-[#00D179]">.qf</span>
                </p>

                {tier.prices ? (
                  <>
                    <p className="font-clash font-medium text-[32px] text-white">
                      {formatQF(tier.prices.annual)} <span className="text-lg text-[#00D179]">QF</span>
                    </p>
                    <p className="font-satoshi text-sm mb-8 text-[#555555]">
                      {formatUSD(tier.prices.annual)} / year
                    </p>

                    <div className="border-t border-[#1E1E1E] pt-6">
                      <p className="font-clash font-medium text-xl text-white">
                        {formatQF(tier.prices.permanent)} <span className="text-lg text-[#00D179]">QF</span>
                      </p>
                      <p className="font-satoshi text-sm text-[#555555]">
                        {formatUSD(tier.prices.permanent)} — own forever
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-[#8A8A8A]">Loading...</p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center mt-8 text-sm text-[#555555] font-satoshi">
          Multi-year registration available. Renew anytime. 30-day grace period after expiry.
        </p>
      </div>
    </section>
  );
}
