import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { Search, UserCircle, Globe } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Search,
    title: 'Search & claim',
    description:
      'Type any name. See instantly if it\'s available. Register in one transaction, confirmed in seconds, not minutes.',
    detail: 'From 100 QF/year',
    accentFrom: '#00D179',
    accentTo: '#00B868',
  },
  {
    num: '02',
    icon: UserCircle,
    title: 'Build your identity',
    description:
      'Add your avatar, bio, and social links. Your .qf name becomes your on-chain profile that follows you everywhere.',
    detail: 'Avatar · Bio · Socials',
    accentFrom: '#00D179',
    accentTo: '#00E88A',
  },
  {
    num: '03',
    icon: Globe,
    title: 'Use it across QF',
    description:
      'Every dApp on QF Network resolves your name. Send payments, vote in governance, trade on the DEX — all as yourname.qf.',
    detail: 'One name, every dApp',
    accentFrom: '#00D179',
    accentTo: '#00FFB2',
  },
];

/* ── Visual motifs for each step (CSS-animated, no heavy assets) ── */

function SearchMotif({ progress }: { progress: number }) {
  const [badgeVisible, setBadgeVisible] = useState(false);

  // Latch: once progress crosses 0.6, badge stays visible
  useEffect(() => {
    if (progress >= 0.6 && !badgeVisible) {
      setBadgeVisible(true);
    }
  }, [progress, badgeVisible]);

  const typedLength = Math.min(Math.floor(progress * 8), 7);
  const name = 'alice.qf';
  const displayed = name.slice(0, typedLength);
  const cursorVisible = progress > 0.05 && progress < 0.95;

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 font-satoshi text-lg">
        <span className="text-white">{displayed.replace('.qf', '')}</span>
        {displayed.includes('.qf') ? null : displayed.length > 0 && (
          <span className="text-[#00D179]">.qf</span>
        )}
        {displayed.includes('.qf') && (
          <>
            <span className="text-white">{displayed.split('.qf')[0].slice(displayed.replace('.qf', '').length)}</span>
            <span className="text-[#00D179]">.qf</span>
          </>
        )}
        {cursorVisible && (
          <span className="inline-block w-[2px] h-5 bg-[#00D179] ml-0.5 animate-pulse align-middle" />
        )}
      </div>
      {badgeVisible && (
        <motion.div
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#00D179]/20 bg-[#00D179]/5 px-3 py-1.5 text-sm text-[#00D179]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-2 w-2 rounded-full bg-[#00D179]" />
          Available
        </motion.div>
      )}
    </div>
  );
}

function ProfileMotif({ progress }: { progress: number }) {
  // Avatar circle draws itself via SVG stroke-dashoffset
  const circumference = 2 * Math.PI * 30; // r=30
  const avatarDrawProgress = Math.min(progress / 0.25, 1); // 0→25% of step progress
  const strokeDashoffset = circumference * (1 - avatarDrawProgress);

  // Name types in after avatar is drawn
  const nameProgress = Math.max(0, (progress - 0.25) / 0.2); // 25%→45%
  const fullName = 'alice';
  const typedName = fullName.slice(0, Math.floor(nameProgress * fullName.length));
  const showQfSuffix = nameProgress >= 1;

  // Bio fades in word by word
  const bioProgress = Math.max(0, (progress - 0.5) / 0.2); // 50%→70%
  const bioWords = ['Building', 'on', 'QF', 'Network'];
  const visibleWordCount = Math.floor(bioProgress * (bioWords.length + 1));

  // Socials appear
  const showSocials = progress > 0.75;

  return (
    <div className="relative w-full max-w-[260px] mx-auto rounded-2xl border border-white/[0.06] bg-[#111] p-6 overflow-hidden">
      {/* Avatar circle — SVG draw animation */}
      <div className="flex justify-center mb-4">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
            {/* Background ring */}
            <circle
              cx="32" cy="32" r="30"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="2"
            />
            {/* Animated draw ring */}
            <circle
              cx="32" cy="32" r="30"
              fill="none"
              stroke="#00D179"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.1s linear',
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              }}
            />
          </svg>
          {/* Avatar letter — fades in when circle completes */}
          <div
            className={`absolute inset-0 flex items-center justify-center text-[#00D179] text-2xl font-clash font-bold transition-opacity duration-500 ${
              avatarDrawProgress >= 1 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            A
          </div>
        </div>
      </div>

      {/* Name — typewriter style */}
      <div className="text-center h-7">
        <span className="font-clash font-semibold text-lg text-white">
          {typedName}
        </span>
        {showQfSuffix && (
          <span className="font-clash font-semibold text-lg text-[#00D179]">.qf</span>
        )}
        {nameProgress > 0 && nameProgress < 1 && (
          <span className="inline-block w-[2px] h-5 bg-[#00D179] ml-0.5 animate-pulse align-middle" />
        )}
      </div>

      {/* Bio — word by word */}
      <div className="mt-3 text-center text-sm h-5">
        {bioWords.map((word, i) => (
          <span
            key={i}
            className={`transition-opacity duration-300 ${
              i < visibleWordCount ? 'text-[#666] opacity-100' : 'opacity-0'
            }`}
          >
            {word}{i < bioWords.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>

      {/* Social row */}
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

function EcosystemMotif({ progress }: { progress: number }) {
  // App logos lighting up in a constellation
  const apps = [
    { name: 'QFPay', color: '#0040FF', x: 20, y: 30 },
    { name: 'Quorum', color: '#6366F1', x: 75, y: 15 },
    { name: 'NucleusX', color: '#5E3AAE', x: 50, y: 65 },
    { name: 'QFLink', color: '#0991B2', x: 10, y: 70 },
    { name: 'PROVD', color: '#FF3131', x: 85, y: 60 },
  ];

  const litCount = Math.floor(progress * (apps.length + 1));

  return (
    <div className="relative w-full max-w-[280px] mx-auto h-[180px]">
      {/* Center node — your .qf identity */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div
          className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            progress > 0.05
              ? 'border-[#00D179] bg-[#00D179]/10 shadow-[0_0_20px_rgba(0,209,121,0.2)]'
              : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <span className="text-[#00D179] text-xs font-bold font-clash">.qf</span>
        </div>
      </div>

      {/* Orbiting app nodes + connecting lines */}
      {apps.map((app, i) => {
        const isLit = i < litCount;
        return (
          <div key={app.name}>
            {/* Connecting line from center — animated stroke */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <line
                x1="50%"
                y1="50%"
                x2={`${app.x}%`}
                y2={`${app.y}%`}
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
            {/* Node */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
              style={{ left: `${app.x}%`, top: `${app.y}%` }}
            >
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-[9px] font-bold font-clash transition-all duration-500`}
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

/* ── Progress indicator (vertical bar with 3 nodes) ── */
function StepProgress({ activeStep }: { activeStep: number }) {
  return (
    <div className="hidden md:flex flex-col items-center gap-0 absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col items-center">
          {/* Node */}
          <div
            className={`h-3 w-3 rounded-full border-2 transition-all duration-500 ${
              i <= activeStep
                ? 'border-[#00D179] bg-[#00D179] shadow-[0_0_8px_rgba(0,209,121,0.4)]'
                : 'border-white/[0.1] bg-transparent'
            }`}
          />
          {/* Connector (not after last) */}
          {i < 2 && (
            <div className="w-px h-16 bg-white/[0.06] relative">
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

/* ── Mobile step indicator (horizontal dots) ── */
function MobileStepDots({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex md:hidden justify-center gap-2 mb-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === activeStep ? 'w-6 bg-[#00D179]' : 'w-1.5 bg-white/[0.1]'
          }`}
        />
      ))}
    </div>
  );
}

/* Helper: extracts a plain number from a MotionValue for the motif components */
function MotifWrapper({
  progress,
  children,
}: {
  progress: any;
  children: (p: number) => React.ReactNode;
}) {
  const [p, setP] = useState(0);

  useEffect(() => {
    const unsubscribe = progress.on('change', (v: number) => {
      setP(Math.max(0, Math.min(1, v)));
    });
    return unsubscribe;
  }, [progress]);

  return <>{children(p)}</>;
}

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // ── Fade zones for the entire sticky theater ──
  const theaterOpacity = useTransform(
    scrollYProgress,
    [0, 0.04, 0.92, 1],
    [0, 1, 1, 0]
  );

  // ── Step opacities — clean handoffs, zero overlap ──
  const step0Opacity = useTransform(scrollYProgress, [0.04, 0.08, 0.27, 0.30], [0, 1, 1, 0]);
  const step1Opacity = useTransform(scrollYProgress, [0.32, 0.35, 0.58, 0.61], [0, 1, 1, 0]);
  const step2Opacity = useTransform(scrollYProgress, [0.63, 0.66, 0.88, 0.92], [0, 1, 1, 0]);

  // ── Header fade-out as step 1 takes over ──
  const headerOpacity = useTransform(scrollYProgress, [0.04, 0.08, 0.15, 0.20], [0, 1, 1, 0]);

  // ── Motif progress — aligned to each step's visible range ──
  const step0Progress = useTransform(scrollYProgress, [0.08, 0.27], [0, 1]);
  const step1Progress = useTransform(scrollYProgress, [0.35, 0.58], [0, 1]);
  const step2Progress = useTransform(scrollYProgress, [0.66, 0.88], [0, 1]);

  // ── Active step for progress indicator ──
  const activeStep = useTransform(scrollYProgress, (v) => {
    if (v < 0.31) return 0;
    if (v < 0.62) return 1;
    return 2;
  });

  // Sync currentStep state with motion value
  useMotionValueEvent(activeStep, 'change', (v) => {
    setCurrentStep(v);
  });

  const motifs = [SearchMotif, ProfileMotif, EcosystemMotif];
  const progresses = [step0Progress, step1Progress, step2Progress];
  const opacities = [step0Opacity, step1Opacity, step2Opacity];

  return (
    <section>
      {/* Tall scroll container — 300vh gives each step ~100vh of scroll */}
      <div ref={containerRef} className="relative" style={{ height: '300vh' }}>
        {/* Sticky viewport */}
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <motion.div
            className="max-w-[1120px] mx-auto px-6 w-full relative"
            style={{ opacity: theaterOpacity }}
          >
            {/* Section header — fades out as step 1 progresses */}
            <motion.div
              className="absolute top-0 left-6 right-6 -mt-24 md:-mt-20"
              style={{ opacity: headerOpacity }}
            >
              <p className="mb-4 text-center text-xs font-medium tracking-[0.3em] text-[#00D179]">
                HOW IT WORKS
              </p>
              <h2 className="font-clash text-center text-4xl font-bold text-white md:text-5xl">
                Three steps. Sixty seconds.
              </h2>
            </motion.div>

            {/* Mobile step dots */}
            <MobileStepDots activeStep={currentStep} />

            {/* Step progress indicator — desktop */}
            <StepProgress activeStep={currentStep} />

            {/* Step panels — stacked, crossfading */}
            <div className="relative min-h-[400px] flex items-center">
              {steps.map((step, i) => {
                const Motif = motifs[i];
                return (
                  <motion.div
                    key={step.num}
                    className="absolute inset-0 flex items-center"
                    style={{ opacity: opacities[i] }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center w-full">
                      {/* Visual motif */}
                      <div className="flex justify-center order-1 md:order-1">
                        <MotifWrapper progress={progresses[i]}>
                          {(p: number) => <Motif progress={p} />}
                        </MotifWrapper>
                      </div>

                      {/* Copy */}
                      <div className="order-2 md:order-2">
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
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
