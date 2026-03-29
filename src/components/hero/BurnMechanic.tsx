import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Flame, Copy, Check } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { hapticTap, hapticBurn } from '../../utils/haptics';
import { getBurnStats, BURN_ADDRESS_EVM } from '../../utils/qns';
import type { BurnStats } from '../../utils/qns';

// ── Counter animation — only used for clean integers ≥ 10 ──

function AnimatedNumber({
  value,
  suffix = '',
  shouldAnimate,
}: {
  value: number;
  suffix?: string;
  shouldAnimate: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || value === 0) {
      setDisplay(0);
      return;
    }

    const duration = 1200;
    const steps = 40;
    const stepDuration = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (current >= steps) {
        setDisplay(value);
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, shouldAnimate]);

  return (
    <span>
      {display.toLocaleString('en-US')}{suffix}
    </span>
  );
}

// ── Format burn amount for display ──

function formatBurnAmount(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString('en-US');
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value > 0) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return '0';
}

export default function BurnMechanic() {
  const { copy } = useCopy();
  const [burnAddressCopied, setBurnAddressCopied] = useState(false);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [loading, setLoading] = useState(true);

  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const hasPlayedHaptic = useRef(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getBurnStats();
        setBurnStats(stats);
      } catch (error) {
        console.error('Failed to load burn stats:', error);
        setBurnStats({
          totalBurned: 0,
          qnsBurned: 0,
          totalRegistrations: 0,
          burnPercent: 5,
          stale: false,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  // Fire haptic when burn stat becomes visible
  useEffect(() => {
    if (isInView && burnStats && burnStats.qnsBurned > 0 && !hasPlayedHaptic.current) {
      hapticBurn();
      hasPlayedHaptic.current = true;
    }
  }, [isInView, burnStats]);

  const handleCopyBurnAddress = () => {
    copy(BURN_ADDRESS_EVM, false);
    hapticTap();
    setBurnAddressCopied(true);
    setTimeout(() => setBurnAddressCopied(false), 2000);
  };

  // Determine if burn amount should use counter or fade-up
  const burnValue = burnStats?.qnsBurned || 0;
  const useCounter = burnValue >= 10 && Number.isInteger(burnValue);
  const isStale = burnStats?.stale === true;
  const burnUnavailable = burnStats?.qnsBurned === 0 && (burnStats?.totalRegistrations ?? 0) > 0 && !isStale;

  return (
    <motion.div
      ref={ref}
      className="mt-12 max-w-[520px] mx-auto"
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div className="bg-[#111] border border-white/[0.06] border-t-[#E5484D]/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,72,77,0.04),transparent_70%)] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-[#E5484D]/10">
              <Flame size={20} className="text-[#E5484D]" />
            </div>
            <h3 className="font-clash text-lg font-semibold text-white">Deflationary by Design</h3>
          </div>

          <p className="text-[#8A8A8A] text-sm mb-6 leading-relaxed">
            Every <span className="text-[#00D179]">.qf</span> registration and renewal burns{' '}
            <span className="text-[#E5484D] font-medium">
              {loading ? '—' : `${burnStats?.burnPercent || 5}%`}
            </span>{' '}
            of the fee permanently. The supply gets scarcer with every name registered and renewed.
          </p>

          {/* ── Stats — horizontal scroll on mobile, 3-col grid on wider ── */}
          <div className="mb-5 min-[380px]:grid min-[380px]:grid-cols-3 min-[380px]:gap-4">
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide min-[380px]:contents"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* ── QNS Burned ── */}
              <div className="snap-start shrink-0 w-[72vw] min-[380px]:w-auto text-center min-[380px]:snap-align-none rounded-xl border border-white/[0.04] p-4 min-[380px]:border-0 min-[380px]:p-0">
                <div className="text-2xl min-[380px]:text-3xl font-bold mb-1">
                  {loading ? (
                    <span className="text-[#E5484D]">—</span>
                  ) : burnUnavailable ? (
                    <span className="text-[#E5484D]" title="Burn data temporarily unavailable">—</span>
                  ) : (
                    <>
                      {useCounter ? (
                        <span className="burn-amount-shimmer">
                          <AnimatedNumber
                            value={burnValue}
                            suffix=""
                            shouldAnimate={isInView}
                          />
                        </span>
                      ) : (
                        <motion.span
                          className={isStale ? 'text-[#E5484D]/50' : 'burn-amount-shimmer'}
                          initial={{ opacity: 0, y: 8 }}
                          animate={isInView ? { opacity: 1, y: 0 } : {}}
                          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                        >
                          {formatBurnAmount(burnValue)}
                        </motion.span>
                      )}
                      <span className="text-[#E5484D]/60 text-xl ml-1">QF</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#555] uppercase tracking-wider">QNS Burned</p>
                {isStale && !loading && (
                  <p className="text-[10px] text-[#333] mt-0.5">last known</p>
                )}
              </div>

              {/* ── Burn Rate ── */}
              <div className="snap-start shrink-0 w-[72vw] min-[380px]:w-auto text-center min-[380px]:snap-align-none rounded-xl border border-white/[0.04] p-4 min-[380px]:border-0 min-[380px]:p-0">
                <div className="text-xl font-bold text-white mb-1">
                  {loading ? '—' : `${burnStats?.burnPercent || 5}%`}
                </div>
                <p className="text-xs text-[#555] uppercase tracking-wider">Burn Rate</p>
              </div>

              {/* ── Names Registered ── */}
              <div className="snap-start shrink-0 w-[72vw] min-[380px]:w-auto text-center min-[380px]:snap-align-none rounded-xl border border-white/[0.04] p-4 min-[380px]:border-0 min-[380px]:p-0">
                <div className="text-xl font-bold text-white mb-1">
                  {loading ? (
                    '—'
                  ) : (
                    <AnimatedNumber
                      value={burnStats?.totalRegistrations || 0}
                      suffix=""
                      shouldAnimate={isInView}
                    />
                  )}
                </div>
                <p className="text-xs text-[#555] uppercase tracking-wider">Names Registered</p>
              </div>
            </div>
          </div>

          {/* ── Burn Address ── */}
          <div className="border-t border-white/[0.04] pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#555]">Burn Address</p>
              <motion.button
                onClick={handleCopyBurnAddress}
                className="flex items-center gap-2 group transition-all duration-200 hover:bg-white/[0.05] rounded-lg p-2 -m-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <code className="text-[#E5484D]/60 font-mono text-xs">
                  0x0000...dEaD
                </code>
                {burnAddressCopied ? (
                  <Check size={14} className="text-[#00D179] flex-shrink-0" />
                ) : (
                  <Copy size={14} className="text-[#8A8A8A] group-hover:text-white flex-shrink-0 transition-colors" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Shimmer keyframe — reuses Pricing's existing @keyframes shimmer ── */}
      <style>{`
        .burn-amount-shimmer {
          background: linear-gradient(
            110deg,
            #E5484D 30%,
            #FF6B6B 50%,
            #E5484D 70%
          );
          background-size: 200% 100%;
          animation: shimmer 4s infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </motion.div>
  );
}
