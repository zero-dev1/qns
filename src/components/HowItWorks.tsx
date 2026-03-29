// src/components/HowItWorks.tsx
import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

// ── Terminal line types ──

interface TerminalLine {
  type: 'command' | 'output' | 'success' | 'loading' | 'detail';
  text: string;
  /** Delay (ms) before this line starts after the previous line finishes */
  delay?: number;
  /** For 'command' type: characters per second for typing effect */
  cps?: number;
  /** Highlight segments: [{text, color}] for mixed-color output lines */
  segments?: { text: string; color?: string }[];
}

const SEQUENCE: TerminalLine[] = [
  // Step 1: Search
  { type: 'command', text: 'search alice.qf', delay: 400, cps: 24 },
  { type: 'success', text: '✓ alice.qf is available', delay: 300 },
  { type: 'detail', text: '  100 QF/year · 1,500 QF forever', delay: 100 },

  // Step 2: Register
  { type: 'command', text: 'register alice.qf --permanent', delay: 800, cps: 22 },
  { type: 'loading', text: '⧗ confirming on QF Network...', delay: 200 },
  { type: 'success', text: '✓ alice.qf registered to 0x7a3...f91', delay: 1200 },
  { type: 'detail', text: '  burned 75 QF to 0x000...dead', delay: 100 },

  // Step 3: Resolve / Use across ecosystem
  { type: 'command', text: 'resolve alice.qf', delay: 800, cps: 26 },
  {
    type: 'output',
    text: '',
    delay: 300,
    segments: [
      { text: '  → ', color: '#555' },
      { text: '0x7a3...f91', color: '#888' },
    ],
  },
  {
    type: 'output',
    text: '',
    delay: 150,
    segments: [
      { text: '  → avatar  ', color: '#555' },
      { text: 'ipfs://Qm...xK4', color: '#888' },
    ],
  },
  {
    type: 'output',
    text: '',
    delay: 150,
    segments: [
      { text: '  → bio     ', color: '#555' },
      { text: '"Building on QF Network"', color: '#888' },
    ],
  },
  {
    type: 'output',
    text: '',
    delay: 150,
    segments: [
      { text: '  → used by ', color: '#555' },
      { text: 'DappStore', color: '#20EAE6' },
      { text: ' · ', color: '#333' },
      { text: 'QFPad', color: '#89FBFE' },
      { text: ' · ', color: '#333' },
      { text: 'NucleusX', color: '#5E3AAE' },
      { text: ' · ', color: '#333' },
      { text: 'Quorum', color: '#6366F1' },
    ],
  },
];

// ── Typed text hook: types out a string character by character ──

function useTypedText(text: string, active: boolean, cps: number = 24) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed('');
      setDone(false);
      return;
    }

    let i = 0;
    setDisplayed('');
    setDone(false);

    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 1000 / cps);

    return () => clearInterval(interval);
  }, [text, active, cps]);

  return { displayed, done };
}

// ── Single terminal line renderer ──

function CommandLine({ text, active, cps }: { text: string; active: boolean; cps: number }) {
  const { displayed, done } = useTypedText(text, active, cps);

  return (
    <div className="flex items-center gap-2 font-mono-addr text-sm">
      <span className="text-[#00D179] select-none shrink-0">{'>'}</span>
      <span className="text-white">
        {displayed}
        {active && !done && (
          <span className="inline-block w-[7px] h-[14px] bg-[#00D179] ml-[1px] align-middle animate-pulse" />
        )}
      </span>
    </div>
  );
}

function OutputLine({ line }: { line: TerminalLine }) {
  if (line.segments) {
    return (
      <div className="font-mono-addr text-sm">
        {line.segments.map((seg, i) => (
          <span key={i} style={{ color: seg.color || '#888' }}>
            {seg.text}
          </span>
        ))}
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    success: '#00D179',
    detail: '#444',
    loading: '#666',
    output: '#888',
  };

  return (
    <div className="font-mono-addr text-sm" style={{ color: colorMap[line.type] || '#888' }}>
      {line.type === 'loading' ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border border-[#333] border-t-[#00D179] rounded-full animate-spin" />
          <span>{line.text.replace('⧗ ', '')}</span>
        </span>
      ) : (
        line.text
      )}
    </div>
  );
}

// ── Main component ──

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  // Phase state machine for smooth loop transitions
  type Phase = 'typing' | 'idle' | 'clearing' | 'restarting';
  const [phase, setPhase] = useState<Phase>('typing');
  const [visibleCount, setVisibleCount] = useState(0);
  const [activeTypingIndex, setActiveTypingIndex] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);

  // Sequential line reveal engine
  useEffect(() => {
    if (!isInView || phase !== 'typing') return;

    let cancelled = false;
    let currentIndex = 0;

    // Reset state for this run
    setVisibleCount(0);
    setActiveTypingIndex(null);

    const showNext = () => {
      if (cancelled || currentIndex >= SEQUENCE.length) return;

      const line = SEQUENCE[currentIndex];
      const delay = currentIndex === 0 ? (line.delay || 0) : (line.delay || 200);

      setTimeout(() => {
        if (cancelled) return;

        const idx = currentIndex;
        currentIndex++;
        setVisibleCount(currentIndex);

        if (line.type === 'command') {
          setActiveTypingIndex(idx);
          const typingDuration = (line.text.length / (line.cps || 24)) * 1000 + 100;
          setTimeout(() => {
            if (cancelled) return;
            setActiveTypingIndex(null);
            showNext();
          }, typingDuration);
        } else if (line.type === 'loading') {
          setTimeout(() => {
            if (!cancelled) showNext();
          }, 800);
        } else {
          showNext();
        }
      }, delay);
    };

    showNext();

    return () => {
      cancelled = true;
    };
  }, [isInView, runKey, phase]);

  // After all lines shown → transition to idle phase
  useEffect(() => {
    if (visibleCount >= SEQUENCE.length && phase === 'typing') {
      const t = setTimeout(() => setPhase('idle'), 500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, phase]);


  // Idle → wait 3s → start clearing
  useEffect(() => {
    if (phase !== 'idle') return;
    const t = setTimeout(() => setPhase('clearing'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // Clearing → wait for fade-out (400ms) → reset lines while invisible → restart
  useEffect(() => {
    if (phase !== 'clearing') return;
    const t = setTimeout(() => {
      setVisibleCount(0);
      setActiveTypingIndex(null);
      setRunKey((k) => k + 1);
      setPhase('restarting');
    }, 400);
    return () => clearTimeout(t);
  }, [phase]);

  // Restarting → brief pause while invisible → begin typing again
  useEffect(() => {
    if (phase !== 'restarting') return;
    const t = setTimeout(() => setPhase('typing'), 150);
    return () => clearTimeout(t);
  }, [phase]);

  // Hide loading line once its successor (success line) is visible
  const shouldHideLoading = (index: number) => {
    if (SEQUENCE[index]?.type !== 'loading') return false;
    return visibleCount > index + 1;
  };

  return (
    <section ref={sectionRef} className="py-24 md:py-32">
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
          className="font-clash text-center text-4xl font-bold text-white md:text-5xl mb-16 md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Three steps. One identity.
        </motion.h2>

        {/* Terminal container */}
        <motion.div
          className="mx-auto max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <div className="terminal-container relative rounded-2xl border border-white/[0.06] bg-[#0c0c0c] overflow-hidden">
            {/* Subtle noise overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.015]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Top bar — minimal window chrome */}
            <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/[0.04]">
              <div className="w-[7px] h-[7px] rounded-full bg-white/[0.06]" />
              <div className="w-[7px] h-[7px] rounded-full bg-white/[0.06]" />
              <div className="w-[7px] h-[7px] rounded-full bg-white/[0.06]" />
              <span className="ml-3 text-[10px] text-[#333] font-mono-addr tracking-wide select-none">
                qns
              </span>
            </div>

            {/* Terminal body — all lines always in DOM, visibility controlled by opacity */}
            <motion.div
              className="p-5 md:p-6 overflow-hidden"
              animate={{ opacity: phase === 'clearing' ? 0 : 1 }}
              transition={{ duration: phase === 'clearing' ? 0.4 : 0.2, ease: 'easeInOut' }}
            >
              {SEQUENCE.map((line, i) => {
                const isVisible = i < visibleCount && !shouldHideLoading(i);
                const isLoadingCollapsed = shouldHideLoading(i);

                return (
                  <div
                    key={i}
                    className={isLoadingCollapsed ? '' : 'mb-2'}
                    style={isLoadingCollapsed ? { height: 0, overflow: 'hidden' } : undefined}
                  >
                    <motion.div
                      animate={{
                        opacity: isVisible ? 1 : 0,
                        y: isVisible ? 0 : 6,
                      }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      {line.type === 'command' ? (
                        <CommandLine
                          text={line.text}
                          active={activeTypingIndex === i}
                          cps={line.cps || 24}
                        />
                      ) : (
                        <OutputLine line={line} />
                      )}
                    </motion.div>
                  </div>
                );
              })}

              {/* Idle cursor — always in DOM, fades in/out */}
              <motion.div
                className="flex items-center gap-2 font-mono-addr text-sm pt-2"
                animate={{ opacity: phase === 'idle' ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <span className="text-[#00D179] select-none">{'>'}</span>
                <span className="inline-block w-[7px] h-[14px] bg-[#00D179]/60 animate-pulse" />
              </motion.div>
            </motion.div>
          </div>

          {/* Subtle ambient glow behind terminal */}
          <div className="absolute inset-0 -z-10 mx-auto max-w-2xl">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-[0.04]"
              style={{
                background: 'radial-gradient(ellipse, rgba(0,209,121,1) 0%, transparent 70%)',
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
