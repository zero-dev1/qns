import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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


// Floating particles config
const floatingParticles = [
  { size: 3, left: '10%', top: '24%', delay: '0s', duration: '12s', opacity: 0.08 },
  { size: 3, left: '22%', top: '70%', delay: '2.5s', duration: '15s', opacity: 0.12 },
  { size: 3, left: '44%', top: '16%', delay: '1.25s', duration: '18s', opacity: 0.06 },
  { size: 3, left: '68%', top: '28%', delay: '4s', duration: '20s', opacity: 0.1 },
  { size: 3, left: '82%', top: '74%', delay: '3s', duration: '16s', opacity: 0.09 },
  { size: 3, left: '58%', top: '84%', delay: '5.5s', duration: '14s', opacity: 0.11 },
];

const HERO_EASE = [0.25, 0.4, 0.25, 1] as const;

export default function Hero() {
  const [searchParams] = useSearchParams();
  const { refreshName } = useWalletStore();

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
  
  // Auto-focus search input on desktop (pointer: fine = mouse/trackpad)
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
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

  return (
    <section className="relative px-6 pb-[100px] pt-16 md:pt-24">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10 hero-gradient-bg" />

      <div className="hero-glow absolute top-0 left-1/2 z-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full pointer-events-none" />

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

      <motion.div
        className="max-w-[1120px] mx-auto text-center relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <motion.h1
          className="font-clash font-semibold text-[40px] md:text-[64px] leading-[1.1] text-[#FFFFFF] mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: HERO_EASE }}
        >
          Your identity on Quantum Fusion
        </motion.h1>

        <motion.p
          className="font-satoshi text-lg md:text-xl text-[#8A8A8A] max-w-[560px] mx-auto mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8, ease: HERO_EASE }}
        >
          Register a <span className="text-[#00D179]">.qf</span> name and use it across every dApp — messaging, trading, gaming, and everything built on QF Network.
        </motion.p>

        <motion.div
          className="w-full max-w-[520px] mx-auto"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: HERO_EASE }}
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

        <p className="mt-5 text-sm text-[#555555] font-satoshi">
          Be among the first to claim your <span className="text-[#00D179]">.qf</span> name
        </p>

        {/* Burn Mechanic Section */}
        <BurnMechanic />
      </motion.div>

        
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out forwards;
        }
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }

        .hero-gradient-bg {
          position: absolute;
          background: linear-gradient(180deg, rgba(10, 10, 10, 0.98) 0%, rgba(10, 10, 10, 1) 100%);
        }

        .hero-glow {
          background: radial-gradient(ellipse, rgba(0,209,121,0.07) 0%, transparent 70%);
          animation: heroGlow 8s ease-in-out infinite;
        }

        @keyframes heroGlow {
          0%,
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.7;
          }
          50% {
            transform: translateX(-50%) scale(1.15);
            opacity: 1;
          }
        }

        .search-bar-shell {
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .search-bar-focus-glow {
          box-shadow: 0 0 20px rgba(0,209,121,0.12), 0 0 60px rgba(0,209,121,0.04);
        }

        .search-bar-available-pulse {
          animation: search-bar-pulse 0.9s ease-out 1;
        }

        @keyframes search-bar-pulse {
          0% {
            box-shadow: 0 0 20px rgba(0,209,121,0.12), 0 0 60px rgba(0,209,121,0.04);
          }
          50% {
            box-shadow: 0 0 28px rgba(0,209,121,0.2), 0 0 84px rgba(0,209,121,0.08);
          }
          100% {
            box-shadow: 0 0 20px rgba(0,209,121,0.12), 0 0 60px rgba(0,209,121,0.04);
          }
        }

        .floating-particle {
          position: absolute;
          background: #00D179;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(0, 209, 121, 0.04);
          animation-name: float-particle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          pointer-events: none;
        }

        @keyframes float-particle {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: translate3d(6px, -22px, 0);
            opacity: 0.85;
          }
          100% {
            transform: translate3d(-8px, -52px, 0);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
