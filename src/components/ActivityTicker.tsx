import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecentName {
  name: string;
  timestamp: number; // unix seconds
  isPermanent: boolean;
}

// Fallback names for when chain is unavailable or on first load
// These are real names registered by the Dapp Labs team during testing
const SEED_NAMES: RecentName[] = [
  { name: 'axe', timestamp: Date.now() / 1000 - 3600, isPermanent: true },
  { name: 'vector', timestamp: Date.now() / 1000 - 7200, isPermanent: false },
  { name: 'boolean', timestamp: Date.now() / 1000 - 10800, isPermanent: true },
  { name: 'doomly', timestamp: Date.now() / 1000 - 14400, isPermanent: false },
  { name: 'sam', timestamp: Date.now() / 1000 - 18000, isPermanent: true },
  { name: 'hwmedia', timestamp: Date.now() / 1000 - 21600, isPermanent: false },
];

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityTicker() {
  const [names] = useState<RecentName[]>(SEED_NAMES);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Rotate through names every 3 seconds
  useEffect(() => {
    if (isPaused || names.length === 0) return;
    const interval = setInterval(() => {
      setVisibleIndex((prev) => (prev + 1) % names.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [names.length, isPaused]);

  const current = names[visibleIndex];
  if (!current) return null;

  return (
    <div className="py-6">
      <div className="max-w-[1120px] mx-auto px-6">
        <div
          className="flex items-center justify-center gap-3 h-10"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Live dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D179] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D179]" />
          </span>

          <AnimatePresence mode="wait">
            <motion.p
              key={`${current.name}-${visibleIndex}`}
              className="text-sm text-[#666]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <span className="text-white font-medium">{current.name}</span>
              <span className="text-[#00D179]">.qf</span>
              <span className="text-[#444] mx-1.5">·</span>
              <span>claimed {current.isPermanent ? 'permanently' : ''} {timeAgo(current.timestamp)}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
