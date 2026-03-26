import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface Stat {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
}

const stats: Stat[] = [
  { label: 'Names Reserved', value: 400, suffix: '+' },
  { label: 'Burn Rate', value: 5, suffix: '%', prefix: '' },
  { label: 'dApps Integrating', value: 6, suffix: '+' },
  { label: 'Seconds to Register', value: 6, suffix: '', prefix: '~' },
];

function AnimatedNumber({ value, prefix = '', suffix, shouldAnimate }: { value: number; prefix?: string; suffix: string; shouldAnimate: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!shouldAnimate) return;
    
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

  return (
    <span>{prefix}{display}{suffix}</span>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section ref={ref} className="py-16 border-y border-white/[0.04]">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-0 md:divide-x md:divide-white/[0.06]">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center md:px-6"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.1 }}
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
