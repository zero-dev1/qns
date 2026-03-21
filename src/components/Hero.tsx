import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Shield, X, Twitter, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import {
  validateNameLocal,
  checkAvailability,
  getRegistration,
  truncateAddress,
  getPrice,
  formatQF,
  registerName,
  getQFBalance,
} from '../utils/qns';
import { hapticSuccess, hapticError, hapticTap } from '../utils/haptics';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import Confetti from './Confetti';

export type SearchResult = {
  status: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
  name: string;
  error?: string;
  owner?: string;
};

type TxState = 'idle' | 'pending' | 'success' | 'failed';

type TxErrorType = 'insufficient_balance' | 'generic';

const durations = [
  { label: '1 year', years: 1, permanent: false },
  { label: '2 years', years: 2, permanent: false },
  { label: '5 years', years: 5, permanent: false },
  { label: 'Permanent', years: 1, permanent: true },
];

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { address, ss58Address, connect, refreshName } = useWalletStore();
  const { setOwnedNames, ownedNames: existingStoreNames } = useNamesStore();
  const { showToast } = useToast();
  const { copy } = useCopy();

  // Search state
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult>({ status: 'idle', name: '' });
  const [searchPrice, setSearchPrice] = useState<bigint | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registration state
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [txState, setTxState] = useState<TxState>('idle');
  const [txError, setTxError] = useState<{ type: TxErrorType; message: string } | null>(null);
  const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search input focus state for glow effect
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [pulseSearchGlow, setPulseSearchGlow] = useState(false);

  const duration = durations[selectedDuration];
  
  // Registration price state
  const [regPrice, setRegPrice] = useState<bigint | null>(null);
  const [regPriceLoading, setRegPriceLoading] = useState(false);
  
  // Burn address copy state
  const [burnAddressCopied, setBurnAddressCopied] = useState(false);
  const burnAddress = '0x000000000000000000000000000000000000dEaD';
  
  // Wallet balance state
  const [userBalance, setUserBalance] = useState<bigint | null>(null);
  
  // First visit tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Fetch registration price when selectedName or duration changes
  useEffect(() => {
    if (!selectedName) {
      setRegPrice(null);
      return;
    }
    setRegPriceLoading(true);
    getPrice(selectedName, duration.years, duration.permanent)
      .then(price => setRegPrice(price))
      .catch(() => setRegPrice(null))
      .finally(() => setRegPriceLoading(false));
  }, [selectedName, duration.years, duration.permanent]);

  // Fetch user balance when wallet connects
  useEffect(() => {
    // For substrate wallets, use SS58 address for balance query (required for api.query.system.account)
    // For EVM wallets, this will be null and we'll need separate handling
    if (ss58Address) {
      getQFBalance(ss58Address).then(setUserBalance).catch(() => setUserBalance(null));
    } else {
      setUserBalance(null);
    }
  }, [ss58Address, address]);

  // Check for search query param on mount and trigger search
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      const cleanName = searchParam.toLowerCase().replace(/\.qf$/, '').trim();
      setInput(cleanName);
      // Trigger search after a short delay to ensure state is updated
      setTimeout(() => search(cleanName), 100);
    }
  }, []);
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

  useEffect(() => {
    if (result.status !== 'available') {
      setPulseSearchGlow(false);
      return;
    }

    setPulseSearchGlow(true);

    const timer = setTimeout(() => {
      setPulseSearchGlow(false);
    }, 1100);

    return () => clearTimeout(timer);
  }, [result.status, result.name]);

  // Registration handlers
  const handleSelectName = (name: string) => {
    setSelectedName(name);
    setTxState('idle');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
  };

  const handleRegister = async () => {
    if (!selectedName) return;
    if (!address) {
      await connect();
      return;
    }
    setTxState('pending');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
    try {
      const signerAddress = ss58Address || address;
      await registerName(selectedName, duration.years, duration.permanent, signerAddress);

      // ✅ Show success IMMEDIATELY — do NOT await refreshName
      setTxState('success');
      
      // Optimistically inject the new name into the names store
      // so MyNamesPage shows it immediately when navigated to
      const now = BigInt(Math.floor(Date.now() / 1000));
      const oneYearSecs = 365n * 24n * 60n * 60n;
      const newName = {
        name: selectedName,
        owner: address || '',
        expires: duration.permanent ? 0n : now + (BigInt(duration.years) * oneYearSecs),
        registeredAt: now,
        isPermanent: duration.permanent,
      };
      setOwnedNames([...existingStoreNames, newName]);
      
      hapticSuccess();
      showToast(`Welcome to QF Network, ${selectedName}.qf!`, 'success');

      // Refresh QNS display name in background — never blocks UI
      refreshName().catch(() => {});
    } catch (err: any) {
      const errorMessage = (err?.message || '').toLowerCase();
      const isInsufficientBalance =
        errorMessage.includes('insufficient') ||
        errorMessage.includes('balance') ||
        errorMessage.includes('funds');

      if (isInsufficientBalance && regPrice) {
        setTxError({
          type: 'insufficient_balance',
          message: `Insufficient QF balance. You need ${formatQF(regPrice)} QF to register this name.`,
        });
      } else if (errorMessage.includes('checkmetadatahash') || errorMessage.includes('cannotlookup') || errorMessage.includes('metadata hash')) {
        setTxError({
          type: 'generic',
          message: 'Disable CheckMetadataHash for QF Network in Talisman: Settings → Networks & Tokens → QF Network → uncheck metadata hash. Then reconnect.',
        });
      } else if (errorMessage.includes('wallet not connected') || errorMessage.includes('reconnect')) {
        setTxError({ type: 'generic', message: 'Wallet not connected. Please disconnect and reconnect your wallet.' });
      } else if (errorMessage.includes('rejected by user') || errorMessage.includes('cancelled')) {
        setTxError({ type: 'generic', message: 'Transaction rejected' });
      } else if (errorMessage.includes('not included within')) {
        setTxError({ type: 'generic', message: 'Transaction sent but confirmation timed out. Check the explorer — it may have succeeded. Try refreshing the page.' });
      } else {
        setTxError({ type: 'generic', message: err?.message || 'Transaction failed' });
      }
      setTxState('failed');
      hapticError();

      if (errorDismissTimerRef.current) {
        clearTimeout(errorDismissTimerRef.current);
      }
      errorDismissTimerRef.current = setTimeout(() => {
        setTxError(null);
      }, 8000);
    }
  };

  const handleRetry = () => {
    setTxState('idle');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
  };

  const handleNewSearch = () => {
    setSelectedName(null);
    setTxState('idle');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
    setInput('');
    setResult({ status: 'idle', name: '' });
  };

  const handleSetupProfile = () => {
    if (selectedName) {
      navigate(`/my-names?expand=${selectedName}`);
    }
  };

  const handleShareOnX = () => {
    if (!selectedName) return;
    const text = `Just claimed ${selectedName}.qf on @dotqfns — registered in seconds on QF Network. The fastest name service in crypto.`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://dotqf.xyz/name/${selectedName}`)}`;
    window.open(url, '_blank');
  };


  const priceDisplay = () => {
    if (!selectedName || regPrice === null) return regPriceLoading ? 'Loading price...' : '';
    const qf = formatQF(regPrice);
    if (duration.permanent) {
      return `${qf} QF — own forever`;
    }
    if (duration.years === 1) {
      return `Total: ${qf} QF`;
    }
    // For multi-year, estimate annual based on 1 year price
    const annualPrice = regPrice / BigInt(duration.years);
    return `${formatQF(annualPrice)} QF × ${duration.years} years = ${qf} QF`;
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
                <form onSubmit={(e) => { e.preventDefault(); if (result.status === 'available') handleSelectName(result.name); }}>
                  <div className="relative">
                    <div
                      className={`flex items-center bg-[#141414] border rounded-xl transition-all duration-300 ${
                        input ? 'border-[#00D179]' : 'border-[#1E1E1E]'
                      } ${isSearchFocused ? 'search-bar-focus-glow' : ''} ${pulseSearchGlow ? 'search-bar-available-pulse' : ''} focus-within:border-[#00D179] search-bar-shell`}
                    >
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        placeholder="Search for a name"
                        className="flex-1 bg-transparent outline-none text-white font-satoshi px-5 py-4 text-lg transition-all duration-150"
                      />
                      <span className="text-[#00D179] font-medium font-satoshi text-lg pr-1">.qf</span>
                      <motion.button
                        type="submit"
                        disabled={searching}
                        className={`transition-all duration-200 mr-4 cursor-pointer disabled:cursor-not-allowed ${
                          result.status === 'available' ? 'text-[#00D179]' :
                          result.status === 'reserved' ? 'text-amber-500' :
                          result.status === 'taken' ? 'text-[#E5484D]' :
                          'text-[#00D179] hover:text-[#00B868]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {searching ? (
                          <span className="inline-block w-5 h-5 border-2 border-[#00D179]/30 border-t-[#00D179] rounded-full animate-spin" />
                        ) : result.status === 'available' ? (
                          <Check size={24} strokeWidth={2.5} />
                        ) : result.status === 'reserved' ? (
                          <Shield size={24} strokeWidth={2.5} />
                        ) : result.status === 'taken' ? (
                          <X size={24} strokeWidth={2.5} />
                        ) : (
                          <ArrowRight size={24} strokeWidth={2.5} />
                        )}
                      </motion.button>
                    </div>
                    
                    {/* First Visit Tooltip */}
                    {showTooltip && (
                      <div className="absolute -bottom-12 left-0 right-0 mx-auto w-max animate-fade-in">
                        <div className="bg-[#1E1E1E] text-[#8A8A8A] text-sm px-3 py-2 rounded-lg border border-[#2a2a2a] shadow-lg">
                          <span className="animate-pulse">✨ Try searching for your name</span>
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#1E1E1E] border-l border-t border-[#2a2a2a] rotate-45"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </form>

                {/* Loading Shimmer */}
                {searching && (
                  <div className="mt-3 transition-all duration-150 ease-in-out animate-fade-in">
                    <div className="px-4 py-3 bg-[#141414] rounded-xl border border-[#1E1E1E] overflow-hidden">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#1E1E1E] via-[#2a2a2a] to-[#1E1E1E] animate-shimmer" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 rounded bg-gradient-to-r from-[#1E1E1E] via-[#2a2a2a] to-[#1E1E1E] animate-shimmer" />
                          <div className="h-3 w-48 rounded bg-gradient-to-r from-[#1E1E1E] via-[#2a2a2a] to-[#1E1E1E] animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {!searching && result.status !== 'idle' && (
                  <div className="mt-3 animate-fade-in">
                    {result.status === 'invalid' && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] rounded-xl border border-[#1E1E1E]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E5484D]">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                        <span className="text-sm text-[#E5484D]">{result.error}</span>
                      </div>
                    )}

                    {result.status === 'available' && (
                      <motion.div
                        className="px-4 py-3 bg-[#00D179] rounded-xl space-y-3 transition-all duration-150 ease-in-out"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          boxShadow: [
                            '0 0 0 0 rgba(0, 209, 121, 0.4)',
                            '0 0 0 8px rgba(0, 209, 121, 0)',
                            '0 0 0 0 rgba(0, 209, 121, 0)',
                          ],
                        }}
                        transition={{
                          opacity: { duration: 0.2 },
                          y: { duration: 0.2 },
                          boxShadow: {
                            duration: 1.5,
                            repeat: 0,
                            ease: 'easeOut',
                          },
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span className="text-black font-medium">
                            {result.name}<span className="text-black/90">.qf</span>
                          </span>
                          <span className="text-black/80 text-sm">is available</span>
                        </div>
                        <div className="text-sm text-black/70">
                          {searchPrice !== null
                            ? `${formatQF(searchPrice)} QF / year`
                            : 'Loading price...'}
                        </div>
                        <motion.button
                          onClick={() => handleSelectName(result.name)}
                          className="w-full py-2.5 bg-black hover:bg-black/80 text-[#00D179] font-bold rounded-lg transition-all duration-200 cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Register
                        </motion.button>
                      </motion.div>
                    )}

                    {result.status === 'taken' && (
                      <div className="px-4 py-3 bg-[#141414] rounded-xl border border-[#1E1E1E] transition-all duration-150 ease-in-out">
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#E5484D]">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                          <span className="text-white font-medium">
                            {result.name}<span className="text-[#00D179]">.qf</span>
                          </span>
                          <span className="text-[#8A8A8A] text-sm">is taken</span>
                        </div>
                        {result.owner && (
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-[#555555]">Owned by {truncateAddress(result.owner)}</p>
                            <Link
                              to={`/name/${result.name}`}
                              className="text-xs text-[#00D179] hover:text-[#00B868] transition-colors"
                            >
                              Visit profile →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {result.status === 'reserved' && (
                      <div className="px-4 py-3 bg-[#141414] rounded-xl border border-[#1E1E1E] transition-all duration-150 ease-in-out">
                        <div className="flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span className="text-white font-medium">
                            {result.name}<span className="text-[#00D179]">.qf</span>
                          </span>
                          <span className="text-[#8A8A8A] text-sm">is reserved</span>
                        </div>
                        <p className="text-xs text-[#555555] mt-1">This name is reserved for an ecosystem project.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Registration Panel */}
          <AnimatePresence mode="wait">
            {selectedName && (
              <motion.div
                key="registration-panel"
                className="mt-0 bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                {/* Empty Wallet State */}
                {address && userBalance === 0n && (
                  <div className="mb-4 p-3 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-lg text-[#F5A623] text-sm animate-fade-in">
                    <p>You'll need QF tokens to register a name.</p>
                  </div>
                )}

                {/* Error Toast */}
                {txError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D] text-white text-sm font-medium animate-fade-in">
                    {txError.message}
                  </div>
                )}

                {/* Idle State */}
                {txState === 'idle' && (
                  <div className="transition-all duration-150 ease-in-out">
                    <div className="text-center mb-6">
                      <h2 className="font-clash font-medium text-[36px] text-white">
                        {selectedName}<span className="text-[#00D179]">.qf</span>
                      </h2>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className="text-sm text-[#00D179] font-medium">Available</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 bg-[#0A0A0A] rounded-xl p-1 mb-6">
                      {durations.map((d, i) => (
                        <motion.button
                          key={d.label}
                          onClick={() => setSelectedDuration(i)}
                          className={`py-2.5 font-medium rounded-lg transition-all duration-150 ease-in-out cursor-pointer whitespace-nowrap ${
                            selectedDuration === i
                              ? 'bg-[#00D179] text-black'
                              : 'text-[#8A8A8A] hover:text-white'
                          } ${d.permanent ? 'text-[13px]' : 'text-sm'}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {d.permanent ? 'Forever' : d.label}
                        </motion.button>
                      ))}
                    </div>

                    <p className="text-center text-white font-satoshi font-medium mb-6">
                      {priceDisplay()}
                    </p>

                    <motion.button
                      onClick={handleRegister}
                      disabled={!address || regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance)}
                      className={`w-full py-3.5 font-bold rounded-xl transition-all duration-200 text-base cursor-pointer ${
                        !address || regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance)
                          ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
                          : 'bg-[#00D179] hover:bg-[#00B868] text-black'
                      }`}
                      whileHover={!address || regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance) ? {} : { scale: 1.02 }}
                      whileTap={!address || regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance) ? {} : { scale: 0.98 }}
                    >
                      {!address ? 'Connect Wallet' :
                       regPriceLoading ? 'Loading price...' :
                       regPrice === null ? 'Price unavailable' :
                       (userBalance !== null && regPrice > userBalance) ? 'Not enough QF' :
                       `Register ${selectedName}.qf`}
                    </motion.button>

                    <motion.button
                      onClick={handleNewSearch}
                      className="w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Back to search
                    </motion.button>
                  </div>
                )}

                {/* Pending State */}
                {txState === 'pending' && (
                  <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                    <div className="relative inline-block mb-5">
                      <div className="w-12 h-12 border-[3px] border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#00D179] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <p className="text-white font-satoshi font-medium mb-1">Registering on QF Network</p>
                    <p className="text-[#555555] text-sm font-satoshi">Powered by sub-second blocks</p>
                  </div>
                )}

                {/* Success State */}
                {txState === 'success' && (
                  <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                    <Confetti active={true} />
                    <div className="mb-4">
                      <svg className="mx-auto mb-4 animate-bounce" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <p className="font-clash font-medium text-2xl text-[#00D179] mb-2">
                        Welcome to QF Network, {selectedName}<span className="text-[#00D179]">.qf</span>!
                      </p>
                      <p className="text-[#8A8A8A] text-sm">Your identity is now part of the network</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 mb-4">
                      <motion.button
                        onClick={handleSetupProfile}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-[#00D179] text-[#00D179] font-medium hover:bg-[#00D17915] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Set up your profile
                      </motion.button>
                      <motion.button
                        onClick={handleShareOnX}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E1E1E] text-white font-medium hover:bg-[#2a2a2a] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Twitter size={16} />
                        Share on X
                      </motion.button>
                    </div>

                    <motion.button
                      onClick={handleNewSearch}
                      className="text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Register another name
                    </motion.button>
                  </div>
                )}

                {/* Failed State */}
                {txState === 'failed' && (
                  <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                    <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                    <p className="text-[#E5484D] font-medium mb-2">Transaction rejected</p>
                    <motion.button
                      onClick={handleRetry}
                      className="mt-2 px-6 py-2.5 bg-[#E5484D] hover:bg-[#c93d41] text-white rounded-lg font-medium transition-colors cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Retry
                    </motion.button>
                    <motion.button
                      onClick={handleNewSearch}
                      className="block w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Back to search
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-5 text-sm text-[#555555] font-satoshi">
          Be among the first to claim your <span className="text-[#00D179]">.qf</span> name
        </p>

        {/* Burn Mechanic Section */}
        <motion.div
          className="mt-12 max-w-[520px] mx-auto"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: HERO_EASE }}
        >
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#E5484D]/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M8 11h8"/>
                  <path d="M8 15h6"/>
                </svg>
              </div>
              <h3 className="font-clash text-lg font-semibold text-white">Deflationary by Design</h3>
            </div>
            
            <p className="text-[#8A8A8A] text-sm mb-4 leading-relaxed">
              Every <span className="text-[#00D179]">.qf</span> registration burns <span className="text-[#E5484D] font-medium">5%</span> of the fee permanently. 
              Reducing QF supply with every name claimed.
            </p>
            
            <div className="bg-[#0A0A0A] rounded-xl p-3 border border-[#1E1E1A]">
              <p className="text-[#555555] text-xs mb-1 text-center">Burn Address</p>
              <motion.button
                onClick={() => {
                  copy(burnAddress, false); // Don't show toast for this since we have visual feedback
                  hapticTap();
                  setBurnAddressCopied(true);
                  setTimeout(() => setBurnAddressCopied(false), 2000);
                }}
                className="flex items-center justify-center gap-2 group transition-all duration-200 hover:bg-[#1a1a1a] rounded-lg p-1 -m-1 w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <code className="text-[#00D179] font-mono text-sm text-center">
                  0x0000...dEaD
                </code>
                {burnAddressCopied ? (
                  <Check size={14} className="text-[#00D179] flex-shrink-0" />
                ) : (
                  <Copy size={14} className="text-[#8A8A8A] group-hover:text-[#00D179] flex-shrink-0 transition-colors" />
                )}
              </motion.button>
              {burnAddressCopied && (
                <p className="text-[#00D179] text-xs mt-1 animate-fade-in text-center">Copied!</p>
              )}
            </div>
          </div>
        </motion.div>
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
