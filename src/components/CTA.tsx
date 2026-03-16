import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

export default function CTA() {
  const { elementRef: ctaRef, isVisible: ctaVisible } = useIntersectionObserver();

  const handleScrollToSearch = () => {
    const heroSection = document.querySelector('section');
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={ctaRef}
      className={`py-[100px] px-6 bg-[#0A0A0A] scroll-fade-in ${
        ctaVisible ? 'visible' : ''
      }`}
    >
      <div className="max-w-[1120px] mx-auto text-center">
        <p className="font-satoshi font-medium text-sm text-[#8A8A8A] uppercase tracking-[0.15em] mb-4">
          READY?
        </p>
        <h2 className="font-clash font-medium text-[32px] text-white mb-3">
          Claim your .qf name
        </h2>
        <p className="font-satoshi text-lg text-[#8A8A8A] mb-8 max-w-[480px] mx-auto">
          Be among the first to build your identity on QF Network.
        </p>
        <button
          onClick={handleScrollToSearch}
          className="px-8 py-3 bg-[#00D179] hover:bg-[#00B868] text-black font-bold rounded-xl transition-all duration-200 cursor-pointer"
        >
          Search Names
        </button>
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
