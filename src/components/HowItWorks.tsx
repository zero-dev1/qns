// src/components/HowItWorks.tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// ── Step data ──

const steps = [
  {
    num: '01',
    title: 'Search & claim',
    description:
      "Type any name. See instantly if it's available. Register in one transaction, confirmed in seconds, not minutes.",
    detail: 'From 100 QF/year',
  },
  {
    num: '02',
    title: 'Build your identity',
    description:
      'Add your avatar, bio, and social links. Your .qf name becomes your on-chain profile that follows you everywhere.',
    detail: 'Avatar · Bio · Socials',
  },
  {
    num: '03',
    title: 'Use it across QF',
    description:
      'Every dApp on QF Network resolves your name. Send payments, vote in governance, trade on the DEX. All as yourname.qf.',
    detail: 'One name, every dApp',
  },
];

// ── Motifs (time-based entrance animations) ──

function SearchMotif({ active }: { active: boolean }) {
  const [typedLength, setTypedLength] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const name = 'alice.qf';

  useEffect(() => {
    if (!active) {
      setTypedLength(0);
      setShowBadge(false);
      return;
    }

    let charIndex = 0;
    const typeInterval = setInterval(() => {
      charIndex++;
      setTypedLength(charIndex);
      if (charIndex >= name.length) {
        clearInterval(typeInterval);
        setTimeout(() => setShowBadge(true), 300);
      }
    }, 100);

    return () => clearInterval(typeInterval);
  }, [active]);

  const displayed = name.slice(0, typedLength);
  const textPart = displayed.replace('.qf', '');
  const hasSuffix = displayed.includes('.qf');
  const isTyping = active && typedLength > 0 && typedLength < name.length;

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 font-satoshi text-lg">
        <span className="text-white">{textPart}</span>
        {(hasSuffix || typedLength > 0) && (
          <span className="text-[#00D179]">.qf</span>
        )}
        {isTyping && (
          <span className="inline-block w-[2px] h-5 bg-[#00D179] ml-0.5 animate-pulse align-middle" />
        )}
      </div>

      <AnimatePresence>
        {showBadge && (
          <motion.div
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#00D179]/20 bg-[#00D179]/5 px-3 py-1.5 text-sm text-[#00D179]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-2 w-2 rounded-full bg-[#00D179]" />
            Available
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMotif({ active }: { active: boolean }) {
  const circumference = 2 * Math.PI * 30;
  const [drawProgress, setDrawProgress] = useState(0);
  const [typedName, setTypedName] = useState('');
  const [visibleWords, setVisibleWords] = useState(0);
  const [showSocials, setShowSocials] = useState(false);

  const fullName = 'alice';
  const bioWords = ['Building', 'on', 'QF', 'Network'];

  useEffect(() => {
    if (!active) {
      setDrawProgress(0);
      setTypedName('');
      setVisibleWords(0);
      setShowSocials(false);
      return;
    }

    // Phase 1: Draw avatar circle (0–600ms)
    let frame = 0;
    const drawInterval = setInterval(() => {
      frame++;
      setDrawProgress(Math.min(frame / 20, 1));
      if (frame >= 20) clearInterval(drawInterval);
    }, 30);

    // Phase 2: Type name (700–1200ms)
    const nameTimeout = setTimeout(() => {
      let ci = 0;
      const nameInterval = setInterval(() => {
        ci++;
        setTypedName(fullName.slice(0, ci));
        if (ci >= fullName.length) clearInterval(nameInterval);
      }, 90);
    }, 700);

    // Phase 3: Bio words (1400–2200ms)
    const bioTimeout = setTimeout(() => {
      let wi = 0;
      const bioInterval = setInterval(() => {
        wi++;
        setVisibleWords(wi);
        if (wi >= bioWords.length) clearInterval(bioInterval);
      }, 200);
    }, 1400);

    // Phase 4: Socials (2400ms)
    const socialTimeout = setTimeout(() => setShowSocials(true), 2400);

    return () => {
      clearInterval(drawInterval);
      clearTimeout(nameTimeout);
      clearTimeout(bioTimeout);
      clearTimeout(socialTimeout);
    };
  }, [active]);

  const strokeDashoffset = circumference * (1 - drawProgress);
  const showQfSuffix = typedName.length >= fullName.length;
  const isTypingName = active && typedName.length > 0 && typedName.length < fullName.length;

  return (
    <div className="relative w-full max-w-[260px] mx-auto rounded-2xl border border-white/[0.06] bg-[#111] p-6 overflow-hidden">
      {/* Avatar circle */}
      <div className="flex justify-center mb-4">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
            <circle
              cx="32" cy="32" r="30"
              fill="none"
              stroke="#00D179"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          </svg>
          <div
            className={`absolute inset-0 flex items-center justify-center text-[#00D179] text-2xl font-clash font-bold transition-opacity duration-500 ${
              drawProgress >= 1 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            A
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="text-center h-7">
        <span className="font-clash font-semibold text-lg text-white">{typedName}</span>
        {showQfSuffix && <span className="font-clash font-semibold text-lg text-[#00D179]">.qf</span>}
        {isTypingName && (
          <span className="inline-block w-[2px] h-5 bg-[#00D179] ml-0.5 animate-pulse align-middle" />
        )}
      </div>

      {/* Bio */}
      <div className="mt-3 text-center text-sm h-5">
        {bioWords.map((word, i) => (
          <span
            key={i}
            className={`transition-opacity duration-300 ${
              i < visibleWords ? 'text-[#666] opacity-100' : 'opacity-0'
            }`}
          >
            {word}{i < bioWords.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>

      {/* Socials */}
      <div
        className={`mt-4 flex justify-center gap-3 transition-all duration-500 ${
          showSocials ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {['X', 'GH', 'TG'].map((s) => (
          <div
            key={s}
            className="h-7 w-7 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[10px] text-[#555]"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function EcosystemMotif({ active }: { active: boolean }) {
  const [litCount, setLitCount] = useState(0);

  const apps = [
    { name: 'QFPay', color: '#0040FF', x: 20, y: 30 },
    { name: 'Quorum', color: '#6366F1', x: 75, y: 15 },
    { name: 'NucleusX', color: '#5E3AAE', x: 50, y: 65 },
    { name: 'QFLink', color: '#0991B2', x: 10, y: 70 },
    { name: 'PROVD', color: '#FF3131', x: 85, y: 60 },
  ];

  useEffect(() => {
    if (!active) {
      setLitCount(0);
      return;
    }

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setLitCount(count);
      if (count >= apps.length) clearInterval(interval);
    }, 350);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="relative w-full max-w-[280px] mx-auto h-[180px]">
      {/* Center .qf node */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div
          className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            active
              ? 'border-[#00D179] bg-[#00D179]/10 shadow-[0_0_20px_rgba(0,209,121,0.2)]'
              : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <span className="text-[#00D179] text-xs font-bold font-clash">.qf</span>
        </div>
      </div>

      {/* App nodes + connecting lines */}
      {apps.map((app, i) => {
        const isLit = i < litCount;
        return (
          <div key={app.name}>
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              <line
                x1="50%" y1="50%"
                x2={`${app.x}%`} y2={`${app.y}%`}
                stroke={isLit ? app.color : 'rgba(255,255,255,0.03)'}
                strokeWidth="1"
                strokeDasharray="200"
                strokeDashoffset={isLit ? '0' : '200'}
                style={{
                  transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.5s ease',
                  opacity: isLit ? 0.4 : 0.15,
                }}
              />
            </svg>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
              style={{ left: `${app.x}%`, top: `${app.y}%` }}
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-[9px] font-bold font-clash transition-all duration-500"
                style={{
                  borderColor: isLit ? app.color : 'rgba(255,255,255,0.04)',
                  borderWidth: '1px',
                  backgroundColor: isLit ? `${app.color}15` : 'rgba(255,255,255,0.02)',
                  color: isLit ? app.color : '#333',
                  boxShadow: isLit ? `0 0 16px ${app.color}20` : 'none',
                }}
              >
                {app.name.slice(0, 2)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Motif array for index lookup ──
const motifs = [SearchMotif, ProfileMotif, EcosystemMotif];

// ── Step Progress Indicator (vertical, in sticky column) ──

function StepProgress({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex flex-col items-center gap-0">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className={`h-3 w-3 rounded-full border-2 transition-all duration-500 ${
              i <= activeStep
                ? 'border-[#00D179] bg-[#00D179] shadow-[0_0_8px_rgba(0,209,121,0.4)]'
                : 'border-white/[0.1] bg-transparent'
            }`}
          />
          {i < 2 && (
            <div className="w-px h-12 bg-white/[0.06] relative">
              <div
                className="absolute top-0 left-0 w-full bg-[#00D179] transition-all duration-700"
                style={{ height: i < activeStep ? '100%' : '0%' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step block (used in the scrolling right column) ──

function StepBlock({
  step,
  index,
  onInView,
}: {
  step: (typeof steps)[0];
  index: number;
  onInView: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.5 });

  useEffect(() => {
    if (isInView) onInView(index);
  }, [isInView, index, onInView]);

  return (
    <div
      ref={ref}
      className="flex items-center"
      style={{ minHeight: '70vh' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Mobile motif (shown only on mobile, inline above copy) */}
        <div className="md:hidden flex justify-center mb-8">
          {(() => {
            const Motif = motifs[index];
            return <Motif active={isInView} />;
          })()}
        </div>

        <span className="font-clash text-5xl font-bold text-[#00D179]/15 block mb-4">
          {step.num}
        </span>
        <h3 className="font-clash font-semibold text-2xl md:text-3xl text-white mb-4">
          {step.title}
        </h3>
        <p className="text-[#666] leading-relaxed mb-5 max-w-md">
          {step.description}
        </p>
        <span className="inline-flex text-[11px] px-3 py-1.5 rounded-full bg-white/[0.03] text-[#555] border border-white/[0.06]">
          {step.detail}
        </span>
      </motion.div>
    </div>
  );
}

// ── Main Component ──

export default function HowItWorks() {
  const [currentStep, setCurrentStep] = useState(0);

  const handleStepInView = useCallback((index: number) => {
    setCurrentStep(index);
  }, []);

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
        {/* Section header */}
        <motion.p
          className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          HOW IT WORKS
        </motion.p>
        <motion.h2
          className="font-clash text-center text-4xl font-bold text-white md:text-5xl mb-16 md:mb-24"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Three steps. Sixty seconds.
        </motion.h2>

        {/* Two-column layout: sticky left + scrolling right (desktop) */}
        {/* Single column on mobile */}
        <div className="md:grid md:grid-cols-2 md:gap-16 lg:gap-24">
          {/* Left column — sticky on desktop, hidden on mobile */}
          <div className="hidden md:block">
            <div className="sticky top-32">
              <div className="flex items-start gap-8">
                {/* Step progress indicator */}
                <StepProgress activeStep={currentStep} />

                {/* Active motif */}
                <div className="flex-1 flex justify-center items-center min-h-[280px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {(() => {
                        const Motif = motifs[currentStep];
                        return <Motif active={true} />;
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — scrolling step blocks */}
          <div>
            {steps.map((step, i) => (
              <StepBlock
                key={step.num}
                step={step}
                index={i}
                onInView={handleStepInView}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
