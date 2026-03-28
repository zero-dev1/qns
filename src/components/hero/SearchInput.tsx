import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowRight, Check, Shield, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  searching: boolean;
  resultStatus: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
  isSearchFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  showTooltip: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/* ── Typewriter config ── */
const TYPEWRITER_NAMES = ['alice', 'satoshi', 'builder', 'yourname', 'legend', 'onchain'];
const TYPE_SPEED = 90; // ms per character
const PAUSE_DURATION = 1800; // ms at full word
const ERASE_SPEED = 50; // ms per character

export default function SearchInput({
  input,
  onInputChange,
  onSubmit,
  searching,
  resultStatus,
  isSearchFocused,
  onFocus,
  onBlur,
  showTooltip,
  inputRef,
}: SearchInputProps) {
  const [pulseSearchGlow, setPulseSearchGlow] = useState(false);
  const [showClaimRing, setShowClaimRing] = useState(false);

  // ── Typewriter state ──
  const [typewriterText, setTypewriterText] = useState('');
  const [typewriterActive, setTypewriterActive] = useState(true);
  const typewriterIndex = useRef(0);
  const typewriterPhase = useRef<'typing' | 'pausing' | 'erasing'>('typing');
  const typewriterCharIndex = useRef(0);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop typewriter when user focuses or types
  const shouldShowTypewriter = typewriterActive && !isSearchFocused && input.length === 0;

  const stopTypewriter = useCallback(() => {
    setTypewriterActive(false);
    setTypewriterText('');
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current);
      typewriterTimer.current = null;
    }
  }, []);

  // Typewriter loop
  useEffect(() => {
    if (!shouldShowTypewriter) return;

    function tick() {
      const currentName = TYPEWRITER_NAMES[typewriterIndex.current];

      if (typewriterPhase.current === 'typing') {
        typewriterCharIndex.current++;
        setTypewriterText(currentName.slice(0, typewriterCharIndex.current));

        if (typewriterCharIndex.current >= currentName.length) {
          typewriterPhase.current = 'pausing';
          typewriterTimer.current = setTimeout(tick, PAUSE_DURATION);
        } else {
          typewriterTimer.current = setTimeout(tick, TYPE_SPEED);
        }
      } else if (typewriterPhase.current === 'pausing') {
        typewriterPhase.current = 'erasing';
        typewriterTimer.current = setTimeout(tick, ERASE_SPEED);
      } else if (typewriterPhase.current === 'erasing') {
        typewriterCharIndex.current--;
        setTypewriterText(currentName.slice(0, typewriterCharIndex.current));

        if (typewriterCharIndex.current <= 0) {
          typewriterPhase.current = 'typing';
          typewriterIndex.current = (typewriterIndex.current + 1) % TYPEWRITER_NAMES.length;
          typewriterTimer.current = setTimeout(tick, TYPE_SPEED + 200);
        } else {
          typewriterTimer.current = setTimeout(tick, ERASE_SPEED);
        }
      }
    }

    // Start after a brief delay
    typewriterTimer.current = setTimeout(tick, 600);

    return () => {
      if (typewriterTimer.current) clearTimeout(typewriterTimer.current);
    };
  }, [shouldShowTypewriter]);

  // Stop typewriter on focus or input
  useEffect(() => {
    if (isSearchFocused || input.length > 0) {
      stopTypewriter();
    }
  }, [isSearchFocused, input, stopTypewriter]);

  // Handle pulse + claim ring effect when result becomes available
  useEffect(() => {
    if (resultStatus !== 'available') {
      setPulseSearchGlow(false);
      setShowClaimRing(false);
      return;
    }

    setPulseSearchGlow(true);
    setShowClaimRing(true);

    const pulseTimer = setTimeout(() => setPulseSearchGlow(false), 1100);
    const ringTimer = setTimeout(() => setShowClaimRing(false), 900);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(ringTimer);
    };
  }, [resultStatus]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="relative">
        {/* Claim ring — expanding ripple on "available" */}
        <AnimatePresence>
          {showClaimRing && (
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-[#00D179] pointer-events-none z-0"
              initial={{ opacity: 0.4, scale: 1 }}
              animate={{ opacity: 0, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </AnimatePresence>

        <div
          className={`relative z-10 flex items-center bg-[#141414] border rounded-xl transition-all duration-300 ${
            input ? 'border-[#00D179]' : 'border-[#1E1E1E]'
          } ${isSearchFocused ? 'search-bar-focus-glow' : ''} ${
            pulseSearchGlow ? 'search-bar-available-pulse' : ''
          } focus-within:border-[#00D179] search-bar-shell`}
        >
          {/* Typewriter overlay — visible only when no input and not focused */}
          {shouldShowTypewriter && (
            <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-lg font-satoshi">
              <span className="text-[#555]">{typewriterText}</span>
              <span className="inline-block w-[2px] h-5 bg-[#555] ml-0.5 animate-pulse" />
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onInputChange('');
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={onBlur}
            placeholder={shouldShowTypewriter ? '' : 'Search for a name'}
            className="flex-1 bg-transparent outline-none text-white font-satoshi px-5 py-4 text-lg transition-all duration-150"
          />

          {/* Living .qf suffix — slow gradient breathing */}
          <span className="qf-suffix-live font-medium font-satoshi text-lg pr-1 select-none">
            .qf
          </span>

          <motion.button
            type="submit"
            disabled={searching}
            className={`transition-all duration-200 mr-4 cursor-pointer disabled:cursor-not-allowed ${
              resultStatus === 'available'
                ? 'text-[#00D179]'
                : resultStatus === 'reserved'
                  ? 'text-amber-500'
                  : resultStatus === 'taken'
                    ? 'text-[#E5484D]'
                    : 'text-[#00D179] hover:text-[#00B868]'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {searching ? (
              <span className="inline-block w-5 h-5 border-2 border-[#00D179]/30 border-t-[#00D179] rounded-full animate-spin" />
            ) : resultStatus === 'available' ? (
              <Check size={24} strokeWidth={2.5} />
            ) : resultStatus === 'reserved' ? (
              <Shield size={24} strokeWidth={2.5} />
            ) : resultStatus === 'taken' ? (
              <X size={24} strokeWidth={2.5} />
            ) : (
              <ArrowRight size={24} strokeWidth={2.5} />
            )}
          </motion.button>
        </div>

        {/* First Visit Tooltip */}
        {showTooltip && !shouldShowTypewriter && (
          <div className="absolute -bottom-12 left-0 right-0 mx-auto w-max animate-fade-in">
            <div className="bg-[#1E1E1E] text-[#8A8A8A] text-sm px-3 py-2 rounded-lg border border-[#2a2a2a] shadow-lg">
              <span className="animate-pulse">✨ Try searching for your name</span>
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#1E1E1E] border-l border-t border-[#2a2a2a] rotate-45" />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
