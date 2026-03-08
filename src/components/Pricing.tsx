const tiers = [
  {
    label: 'Standard',
    chars: '4 characters',
    example: 'alex',
    annual: '300 QF',
    annualUsd: '~$3 / year',
    permanent: '4,500 QF',
    permanentUsd: '~$45 one-time',
    highlighted: false,
  },
  {
    label: 'Basic',
    chars: '5+ characters',
    example: 'alice',
    annual: '100 QF',
    annualUsd: '~$1 / year',
    permanent: '1,500 QF',
    permanentUsd: '~$15 one-time',
    highlighted: true,
  },
  {
    label: 'Premium',
    chars: '3 characters',
    example: 'ace',
    annual: '1,000 QF',
    annualUsd: '~$10 / year',
    permanent: '15,000 QF',
    permanentUsd: '~$150 one-time',
    highlighted: false,
  },
];

export default function Pricing() {
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              className={`relative rounded-xl p-8 md:p-10 border text-center ${
                tier.highlighted ? 'bg-[#0D1512] border-[#00D179]' : 'border-[#1E1E1E]'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-white bg-[#00D179] px-3 py-1 rounded-full">
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

              <p className="font-clash font-medium text-[32px] text-white">
                {tier.annual}
              </p>
              <p className="font-satoshi text-sm mb-8 text-[#555555]">
                {tier.annualUsd}
              </p>

              <div className="border-t border-[#1E1E1E] pt-6">
                <p className="font-satoshi font-medium text-white">
                  {tier.permanent}
                </p>
                <p className="font-satoshi text-sm text-[#555555]">
                  {tier.permanentUsd}
                </p>
                <p className="font-satoshi text-xs mt-1 text-[#8A8A8A]">
                  Own forever
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm text-[#555555] font-satoshi">
          Multi-year registration available. Renew anytime. 30-day grace period after expiry.
        </p>
      </div>
    </section>
  );
}
