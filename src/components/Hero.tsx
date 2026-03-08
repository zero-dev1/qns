import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Shield, X, Twitter } from 'lucide-react';
import { useWalletStore } from '../stores/walletStore';
import {
  validateNameLocal,
  checkAvailability,
  getRegistration,
  truncateAddress,
  getPrice,
  formatQF,
  formatUSD,
  registerName,
} from '../utils/qns';

export type SearchResult = {
  status: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
  name: string;
  error?: string;
  owner?: string;
};

type TxState = 'idle' | 'pending' | 'success' | 'failed';

const durations = [
  { label: '1 year', years: 1, permanent: false },
  { label: '2 years', years: 2, permanent: false },
  { label: '5 years', years: 5, permanent: false },
  { label: 'Permanent', years: 1, permanent: true },
];

export default function Hero() {
  const navigate = useNavigate();
  const { address, connect, refreshName } = useWalletStore();

  // Search state
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult>({ status: 'idle', name: '' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registration state
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [txState, setTxState] = useState<TxState>('idle');

  const duration = durations[selectedDuration];
  const price = selectedName ? getPrice(selectedName, duration.years, duration.permanent) : 0n;

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
    try {
      const isAvailable = await checkAvailability(name);
      if (isAvailable) {
        setResult({ status: 'available', name });
      } else {
        const reg = await getRegistration(name);
        if (reg) {
          setResult({ status: 'taken', name, owner: reg.owner });
        } else {
          setResult({ status: 'reserved', name });
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

      if (isValidationError) {
        setResult({ status: 'invalid', name, error: err?.cause?.reason || err?.message || 'Invalid name format' });
      } else {
        setResult({ status: 'invalid', name, error: 'Unable to check availability. Please try again.' });
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = input.toLowerCase().replace(/\.qf$/, '').trim();
    if (!name) {
      setResult({ status: 'idle', name: '' });
      return;
    }
    const validation = validateNameLocal(name);
    if (!validation.valid) {
      setResult({ status: 'invalid', name, error: validation.error! });
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
    setTxState('idle');
  };

  const handleRegister = async () => {
    if (!selectedName) return;
    if (!address) {
      await connect();
      return;
    }
    setTxState('pending');
    try {
      await registerName(selectedName, duration.years, duration.permanent, address);
      setTxState('success');
      await refreshName();
    } catch {
      setTxState('failed');
    }
  };

  const handleRetry = () => {
    setTxState('idle');
  };

  const handleNewSearch = () => {
    setSelectedName(null);
    setTxState('idle');
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
    const text = `Just claimed ${selectedName}.qf on @QFNetwork 🟢 #QNS #QuantumFusion`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const priceDisplay = () => {
    if (!selectedName) return '';
    const qf = formatQF(price);
    const usd = formatUSD(price);
    if (duration.permanent) {
      return `${qf} QF (${usd}) — own forever`;
    }
    if (duration.years === 1) {
      return `Total: ${qf} QF (${usd})`;
    }
    const annualPrice = getPrice(selectedName, 1, false);
    return `${formatQF(annualPrice)} QF × ${duration.years} years = ${qf} QF (${usd})`;
  };

  return (
    <section className="pt-[160px] pb-[100px] px-6">
      <div className="max-w-[1120px] mx-auto text-center">
        <h1 className="font-clash font-semibold text-[40px] md:text-[64px] leading-[1.1] text-[#FFFFFF] mb-6">
          Your identity on Quantum Fusion
        </h1>
        <p className="font-satoshi text-lg md:text-xl text-[#8A8A8A] max-w-[560px] mx-auto mb-10">
          Register a <span className="text-[#00D179]">.qf</span> name and use it across every dApp — messaging, trading, gaming, and everything built on QF Network.
        </p>

        <div className="w-full max-w-[520px] mx-auto">
          {/* Search Input - shown when no name selected */}
          {!selectedName && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); if (result.status === 'available') handleSelectName(result.name); }}>
                <div
                  className={`flex items-center bg-[#141414] border rounded-xl transition-all duration-200 ${
                    input ? 'border-[#00D179]' : 'border-[#1E1E1E]'
                  } focus-within:border-[#00D179]`}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search for a name"
                    className="flex-1 bg-transparent outline-none text-white font-satoshi px-5 py-4 text-lg transition-all duration-150"
                  />
                  <span className="text-[#00D179] font-medium font-satoshi text-lg pr-1">.qf</span>
                  <button
                    type="submit"
                    disabled={searching}
                    className={`transition-all duration-200 mr-4 cursor-pointer disabled:cursor-not-allowed ${
                      result.status === 'available' ? 'text-[#00D179]' :
                      result.status === 'reserved' ? 'text-amber-500' :
                      result.status === 'taken' ? 'text-[#E5484D]' :
                      'text-[#00D179] hover:text-[#00B868]'
                    }`}
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
                  </button>
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
                    <div className="px-4 py-3 bg-[#00D179] rounded-xl space-y-3 transition-all duration-150 ease-in-out">
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className="text-black font-medium">
                          {result.name}<span className="text-black/90">.qf</span>
                        </span>
                        <span className="text-black/80 text-sm">is available</span>
                      </div>
                      <div className="text-sm text-black/70">
                        {(() => {
                          const price = getPrice(result.name, 1, false);
                          return `${formatQF(price)} QF / year (${formatUSD(price)})`;
                        })()}
                      </div>
                      <button
                        onClick={() => handleSelectName(result.name)}
                        className="w-full py-2.5 bg-black hover:bg-black/80 text-[#00D179] font-bold rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        Register
                      </button>
                    </div>
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
                        <p className="text-xs text-[#555555] mt-1">Owned by {truncateAddress(result.owner)}</p>
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
            </>
          )}
          
          {/* Registration Panel */}
          {selectedName && (
            <div className="mt-0 bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 transition-all duration-150 ease-in-out animate-fade-in">
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
                      <button
                        key={d.label}
                        onClick={() => setSelectedDuration(i)}
                        className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ease-in-out cursor-pointer ${
                          selectedDuration === i
                            ? 'bg-[#00D179] text-white'
                            : 'text-[#8A8A8A] hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-white font-satoshi font-medium mb-6">
                    {priceDisplay()}
                  </p>

                  <button
                    onClick={handleRegister}
                    className="w-full py-3.5 bg-[#00D179] hover:bg-[#00B868] text-white font-bold rounded-xl transition-all duration-200 text-base cursor-pointer"
                  >
                    {address ? `Register ${selectedName}.qf` : 'Connect Wallet'}
                  </button>

                  <button
                    onClick={handleNewSearch}
                    className="w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                  >
                    Back to search
                  </button>
                </div>
              )}

              {/* Pending State */}
              {txState === 'pending' && (
                <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                  <div className="inline-block w-8 h-8 border-3 border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin mb-4" />
                  <p className="text-[#8A8A8A] font-satoshi">Confirming transaction...</p>
                </div>
              )}

              {/* Success State */}
              {txState === 'success' && (
                <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                  <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <p className="font-clash font-medium text-2xl text-[#00D179] mb-2">
                    {selectedName}<span className="text-[#00D179]">.qf</span> is yours!
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 mb-4">
                    <button
                      onClick={handleSetupProfile}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-[#00D179] text-[#00D179] font-medium hover:bg-[#00D17915] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      Set up your profile
                    </button>
                    <button
                      onClick={handleShareOnX}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E1E1E] text-white font-medium hover:bg-[#2a2a2a] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Twitter size={16} />
                      Share on X
                    </button>
                  </div>

                  <button
                    onClick={handleNewSearch}
                    className="text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                  >
                    Register another name
                  </button>
                </div>
              )}

              {/* Failed State */}
              {txState === 'failed' && (
                <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
                  <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  <p className="text-[#E5484D] font-medium mb-2">Transaction failed. Try again.</p>
                  <button
                    onClick={handleRetry}
                    className="mt-2 px-6 py-2.5 bg-[#E5484D] hover:bg-[#c93d41] text-white rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleNewSearch}
                    className="block w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                  >
                    Back to search
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-sm text-[#555555] font-satoshi">
          Be among the first to claim your <span className="text-[#00D179]">.qf</span> name
        </p>
      </div>

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
      `}</style>
    </section>
  );
}
