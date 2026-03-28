import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useWalletStore } from '../stores/walletStore';
import {
  validateNameLocal,
  checkAvailability,
  getRegistration,
  truncateAddress,
  getPrice,
  formatQF,
} from '../utils/qns';
import { hapticTap } from '../utils/haptics';
import SearchInput from './hero/SearchInput';
import SearchResults from './hero/SearchResults';
import RegistrationPanel from './hero/RegistrationPanel';
import BurnMechanic from './hero/BurnMechanic';
import type { SearchResult } from '../types/search';

// ── Letter stagger variants ──
const headlineContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03, delayChildren: 0.15 },
  },
};

const letterVariant = {
  hidden: { opacity: 0, y: 30, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, damping: 20, stiffness: 150 },
  },
};

// Floating particles (unchanged from original)
const floatingParticles = [
  { size: 3, left: '10%', top: '24%', delay: '0s', duration: '12s', opacity: 0.08 },
  { size: 3, left: '22%', top: '70%', delay: '2.5s', duration: '15s', opacity: 0.12 },
  { size: 3, left: '44%', top: '16%', delay: '1.25s', duration: '18s', opacity: 0.06 },
  { size: 3, left: '68%', top: '28%', delay: '4s', duration: '20s', opacity: 0.1 },
  { size: 3, left: '82%', top: '74%', delay: '3s', duration: '16s', opacity: 0.09 },
  { size: 3, left: '58%', top: '84%', delay: '5.5s', duration: '14s', opacity: 0.11 },
];

function LetterReveal({ text, className }: { text: string; className?: string }) {
  return (
    <motion.h1
      className={className}
      variants={headlineContainer}
      initial="hidden"
      animate="visible"
      aria-label={text}
    >
      {text.split('').map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          variants={letterVariant}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.h1>
  );
}

export default function Hero() {
  const [searchParams] = useSearchParams();
  const { refreshName, qnsName, address } = useWalletStore();
  const heroRef = useRef<HTMLElement>(null);

  // ── Scroll parallax ──
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const searchY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const bloomOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const bloomScale = useTransform(scrollYProgress, [0, 0.4], [1, 1.3]);

  // Search state
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult>({ status: 'idle', name: '' });
  const [searchPrice, setSearchPrice] = useState<bigint | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registration state
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Search input focus state for glow effect
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // First visit tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Auto-focus on desktop — but only after typewriter has had time to run
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      // Wait 6 seconds so the typewriter completes at least one full name cycle
      // before pulling focus (which kills the typewriter).
      // If user interacts first, the typewriter stops naturally and this is a no-op.
      const timer = setTimeout(() => {
        // Only focus if user hasn't already interacted with the input
        if (!input && inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Check for search query param on mount AND when it changes (e.g. from CommandPalette)
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      const cleanName = searchParam.toLowerCase().replace(/\.qf$/, '').trim();
      setInput(cleanName);
      setTimeout(() => search(cleanName), 100);
    }
  }, [searchParams]);

  useEffect(() => {
    const hasVisited = localStorage.getItem('qns-has-visited');
    if (!hasVisited) {
      setShowTooltip(true);
      localStorage.setItem('qns-has-visited', 'true');
      
      // Hide tooltip after 5 seconds or when user starts typing
      const timer = setTimeout(() => {
        setShowTooltip(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Search logic
  const search = useCallback(async (value: string) => {
    const name = value.toLowerCase().replace(/\.qf$/, '').trim();
    if (!name) {
      setResult({ status: 'idle', name: '' });
      return;
    }

    const validation = validateNameLocal(name);
    if (!validation.valid) {
      setResult({ status: 'invalid', name, error: validation.error! });
      return;
    }

    setSearching(true);
    setSearchPrice(null);
    try {
      const isAvailable = await checkAvailability(name);
      if (isAvailable) {
        setResult({ status: 'available', name });
        hapticTap();
        // Fetch price asynchronously
        try {
          const priceWei = await getPrice(name, 1, false);
          setSearchPrice(priceWei);
        } catch {
          setSearchPrice(null);
        }
      } else {
        const reg = await getRegistration(name);
        if (reg) {
          setResult({ status: 'taken', name, owner: reg.owner });
          hapticTap();
        } else {
          setResult({ status: 'reserved', name });
          hapticTap();
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message?.toLowerCase() || '';
      const isValidationError =
        errorMessage.includes('too short') ||
        errorMessage.includes('at least 3') ||
        errorMessage.includes('invalid character') ||
        errorMessage.includes('empty') ||
        err?.cause?.reason?.toLowerCase().includes('short');
      
      // Check for network errors
      const isNetworkError = 
        errorMessage.includes('network unavailable') ||
        errorMessage.includes('websocket') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout');

      if (isNetworkError) {
        setResult({ status: 'invalid', name, error: 'Network unavailable. Please check your connection and try again.' });
      } else if (isValidationError) {
        setResult({ status: 'invalid', name, error: err?.cause?.reason || err?.message || 'Invalid name format' });
      } else {
        setResult({ status: 'invalid', name, error: 'Unable to check availability. Please try again.' });
      }
    } finally {
      setSearching(false);
    }
  }, []);

  // Handle input change and hide tooltip
  const handleInputChange = (value: string) => {
    setInput(value);
    if (showTooltip) {
      setShowTooltip(false);
    }
    // If clearing (e.g. ESC), cancel any pending debounced search immediately
    if (!value.trim()) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setResult({ status: 'idle', name: '' });
      setSearchPrice(null);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = input.toLowerCase().replace(/\.qf$/, '').trim();
    if (!name) {
      setResult({ status: 'idle', name: '' });
      setSearchPrice(null);
      return;
    }
    const validation = validateNameLocal(name);
    if (!validation.valid) {
      setResult({ status: 'invalid', name, error: validation.error! });
      setSearchPrice(null);
      return;
    }
    debounceRef.current = setTimeout(() => search(input), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, search]);

  // Registration handlers
  const handleSelectName = (name: string) => {
    setSelectedName(name);
  };

  const handleSearchSubmit = () => {
    if (result.status === 'available') {
      handleSelectName(result.name);
    }
  };

  const handleRegisterSuccess = () => {
    refreshName().catch(() => {});
  };

  const handleBackToSearch = () => {
    setSelectedName(null);
    setInput('');
    setResult({ status: 'idle', name: '' });
    setSearchPrice(null);
  };

  // ── Determine headline ──
  const isConnected = !!address;
  const headlineText = isConnected && qnsName
    ? `Welcome back, ${qnsName}` 
    : 'Your identity on Quantum Fusion';
  const subtitleText = isConnected && qnsName
    ? 'Manage your identity or register another name.'
    : 'Register a .qf name and use it across every dApp on QF Network. Messaging, trading, gaming, and everything in between.';

  return (
    <section ref={heroRef} className="relative px-6 pb-[100px] pt-16 md:pt-24 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10 hero-gradient-bg" />

      {/* Gradient bloom — now scroll-linked */}
      <motion.div
        className="hero-glow absolute top-0 left-1/2 z-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full pointer-events-none"
        style={{ opacity: bloomOpacity, scale: bloomScale }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {floatingParticles.map((particle, i) => (
          <div
            key={i}
            className="floating-particle"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: particle.left,
              top: particle.top,
              opacity: particle.opacity,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <div className="max-w-[1120px] mx-auto text-center relative z-10">
        {/* Headline with letter stagger + scroll parallax */}
        <motion.div style={{ y: headlineY }}>
          <LetterReveal
            text={headlineText}
            className="font-clash font-semibold text-[40px] md:text-[64px] leading-[1.1] text-[#FFFFFF] mb-6"
          />

          {/* Subtitle — fades in after headline */}
          <motion.p
            className="font-satoshi text-lg md:text-xl text-[#8A8A8A] max-w-[560px] mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {isConnected && qnsName ? (
              subtitleText
            ) : (
              <>
                Register a <span className="text-[#00D179]">.qf</span> name and use it across every dApp on QF Network. Messaging, trading, gaming, and everything in between.
              </>
            )}
          </motion.p>
        </motion.div>

        {/* Search + Registration — delayed entrance + scroll parallax */}
        <motion.div
          className="w-full max-w-[520px] mx-auto"
          style={{ y: searchY }}
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait">
            {/* Search Input - shown when no name selected */}
            {!selectedName && (
              <motion.div
                key="search-panel"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <SearchInput
                  input={input}
                  onInputChange={handleInputChange}
                  onSubmit={handleSearchSubmit}
                  searching={searching}
                  resultStatus={result.status}
                  isSearchFocused={isSearchFocused}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  showTooltip={showTooltip}
                  inputRef={inputRef}
                />

                <SearchResults
                  searching={searching}
                  result={result}
                  searchPrice={searchPrice}
                  onSelectName={handleSelectName}
                  formatQF={formatQF}
                  truncateAddress={truncateAddress}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Registration Panel */}
          <AnimatePresence mode="wait">
            {selectedName && (
              <RegistrationPanel
                key="registration-panel"
                selectedName={selectedName}
                onBack={handleBackToSearch}
                onRegisterSuccess={handleRegisterSuccess}
              />
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p
          className="mt-5 text-sm text-[#555555] font-satoshi"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          Be among the first to claim your <span className="text-[#00D179]">.qf</span> name
        </motion.p>

        <BurnMechanic />
      </div>

        
      </section>
  );
}
