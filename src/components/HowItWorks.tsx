const steps = [
  {
    num: '01',
    heading: 'Claim your name',
    description:
      'Search for any name, pick your duration, and register in a single transaction. Done in seconds.',
  },
  {
    num: '02',
    heading: 'Use it everywhere',
    description:
      'Send messages on QFLink, trade on NucleusX, compete on QFClash — all with yourname.qf instead of a hex address.',
  },
  {
    num: '03',
    heading: 'Own your identity',
    description:
      'Attach your avatar, bio, and social links. Your .qf name is your on-chain profile across the entire QF ecosystem.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-[100px] px-6">
      <div className="max-w-[1120px] mx-auto">
        <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-10 text-center">
          HOW IT WORKS
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-6"
            >
              <span className="font-clash font-medium text-4xl text-[#00D179] block mb-4">
                {step.num}
              </span>
              <h3 className="font-clash font-medium text-2xl text-white mb-2 text-center">
                {step.heading}
              </h3>
              <p className="font-satoshi text-base text-[#8A8A8A] leading-relaxed text-center">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
