import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

export default function Ecosystem() {
  const { elementRef: ecosystemRef, isVisible: ecosystemVisible } = useIntersectionObserver();

  return (
    <section 
      ref={ecosystemRef}
      className={`py-[100px] px-6 scroll-fade-in ${
        ecosystemVisible ? 'visible' : ''
      }`}
    >
      <div className="max-w-[1120px] mx-auto">
        <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-4 text-center">
          MANIFESTO
        </p>
        <h2 className="font-clash font-medium text-[32px] text-white mb-3 text-center">
          The First Pillar
        </h2>
        <p className="font-satoshi text-lg text-[#8A8A8A] max-w-[680px] mx-auto mb-10 text-center leading-relaxed">
          The QF manifesto outlines five non-negotiable pillars of digital life: Identity, Money, Work, Community, and Data. QNS is the first. Your name, your credentials, your continuity. Register once, carry it everywhere the ecosystem goes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-[900px] mx-auto">
          {['Identity', 'Money', 'Work', 'Community', 'Data'].map((pillar, index) => (
            <div
              key={pillar}
              className={`text-center p-6 rounded-xl border transition-all duration-300 ${
                index === 0 
                  ? 'border-[#00D1794D] bg-[#00D17908]' 
                  : 'border-[#333333] bg-[#111111]'
              }`}
            >
              <div className={`text-lg font-clash font-medium mb-2 text-center ${
                index === 0 ? 'text-[#00D179]' : 'text-[#555555]'
              }`}>
                {pillar}
              </div>
              <div className={`text-sm font-satoshi ${
                index === 0 ? 'text-white' : 'text-[#666666]'
              }`}>
                {index === 0 ? 'Now' : `Pillar ${index + 1}`}
              </div>
            </div>
          ))}
        </div>
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
