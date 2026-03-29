import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Flame, Copy, Check } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { hapticTap, hapticBurn } from '../../utils/haptics';
import { getBurnStats, BURN_ADDRESS_EVM } from '../../utils/qns';
import type { BurnStats } from '../../utils/qns';

function AnimatedNumber({
  value,
  suffix = '',
  shouldAnimate,
  isBurnStat = false,
}: {
  value: number;
  suffix?: string;
  shouldAnimate: boolean;
  isBurnStat?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const hasPlayedHaptic = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || value === 0) {
      setDisplay(0);
      return;
    }

    if (isBurnStat && !hasPlayedHaptic.current) {
      hapticBurn();
      hasPlayedHaptic.current = true;
    }

    const duration = 1200;
    const steps = 40;
    const stepDuration = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      // No rounding for fractional values — interpolate smoothly
      setDisplay(eased * value);

      if (current >= steps) {
        setDisplay(value);
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, shouldAnimate, isBurnStat]);

  // Format: integers get no decimals above 100, everything else gets up to 6 significant fractional digits
  const formatted = display >= 100
    ? Math.round(display).toLocaleString('en-US')
    : display >= 1
      ? display.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : display > 0
        ? display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
        : '0';

  return (
    <span>
      {formatted}{suffix}
    </span>
  );
}

export default function BurnMechanic() {
  const { copy } = useCopy();
  const [burnAddressCopied, setBurnAddressCopied] = useState(false);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getBurnStats();
        setBurnStats(stats);
      } catch (error) {
        console.error('Failed to load burn stats:', error);
        // Set fallback values
        setBurnStats({
          totalBurned: 0,
          qnsBurned: 0,
          totalRegistrations: 0,
          burnPercent: 5,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const handleCopyBurnAddress = () => {
    copy(BURN_ADDRESS_EVM, false); // Don't show toast for this since we have visual feedback
    hapticTap();
    setBurnAddressCopied(true);
    setTimeout(() => setBurnAddressCopied(false), 2000);
  };

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
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 mb-5 min-[380px]:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl min-[380px]:text-3xl font-bold text-[#E5484D] mb-1">
                {loading ? (
                  '—'
                ) : (
                  <>
                    {burnStats?.qnsBurned === 0 && burnStats?.totalRegistrations > 0 ? (
                      <span title="Burn data temporarily unavailable">—</span>
                    ) : (
                      <AnimatedNumber 
                        value={burnStats?.qnsBurned || 0} 
                        suffix="" 
                        shouldAnimate={isInView}
                        isBurnStat={true}
                      />
                    )}
                    <span className="text-[#E5484D]/60 text-xl ml-1">QF</span>
                  </>
                )}
              </div>
              <p className="text-xs text-[#555] uppercase tracking-wider">QNS Burned</p>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-1">
                {loading ? '—' : `${burnStats?.burnPercent || 5}%`}
              </div>
              <p className="text-xs text-[#555] uppercase tracking-wider">Burn Rate</p>
            </div>
            
            <div className="text-center">
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
          
          {/* Burn Address Section */}
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
    </motion.div>
  );
}
