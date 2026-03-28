import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface Stat {
  label: string;
  value: number | null;
  suffix: string;
  prefix?: string;
}

const staticStats: Omit<Stat, 'value'>[] = [
  { label: 'Identities Claimed', suffix: '', prefix: '' },
  { label: 'Burn Rate', suffix: '%', prefix: '' },
  { label: 'dApps Building', suffix: '', prefix: '' },
  { label: 'Seconds to Register', suffix: '', prefix: '~' },
];

function AnimatedNumber({ value, prefix = '', suffix, shouldAnimate }: { value: number | null; prefix?: string; suffix: string; shouldAnimate: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!shouldAnimate || value === null) return;
    
    const duration = 1200; // ms
    const steps = 40;
    const stepDuration = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      const progress = current / steps;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (current >= steps) {
        setDisplay(value);
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, shouldAnimate]);

  if (value === null) {
    return <span className="animate-pulse text-white/20">—</span>;
  }

  return (
    <span>{prefix}{display}{suffix}</span>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [totalClaimed, setTotalClaimed] = useState<number | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    async function fetchCount() {
      try {
        const { getTotalRegistrations } = await import('../utils/qns');
        const count = await getTotalRegistrations();
        setTotalClaimed(Number(count));
      } catch {
        setFetchFailed(true);
      }
    }
    fetchCount();
  }, []);

  // Combine dynamic and static stats
  const stats: Stat[] = [
    { ...staticStats[0], value: fetchFailed ? 0 : totalClaimed },
    { ...staticStats[1], value: 5 },
    { ...staticStats[2], value: 9 },
    { ...staticStats[3], value: 6 },
  ];

  return (
    <section ref={ref} className="py-16 border-y border-white/[0.04]">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-0 md:divide-x md:divide-white/[0.06]">
          {stats.map((stat: Stat, i: number) => (
            <motion.div
              key={stat.label}
              className="text-center md:px-6"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-clash text-3xl font-bold text-white md:text-4xl">
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  shouldAnimate={isInView}
                />
              </p>
              <p className="mt-1 text-sm text-[#555]">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
