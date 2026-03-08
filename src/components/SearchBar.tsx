import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowRight, Check, Shield, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { validateNameLocal, checkAvailability, getRegistration, truncateAddress, getPrice, formatUSD } from '../utils/qns';
import { formatEther } from 'viem';

export type SearchResult = {
  status: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
  name: string;
  error?: string;
  owner?: string;
  price?: string;
  priceUsd?: string;
};

interface SearchBarProps {
  onSelect?: (name: string) => void;
  compact?: boolean;
}

export default function SearchBar({ onSelect, compact = false }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult>({ status: 'idle', name: '' });
  const [priceLoading, setPriceLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setPriceLoading(true);
        setResult({ status: 'available', name });
        // Fetch live price from contract
        try {
          console.log('[SearchBar] about to call getPrice, name:', name);
          const priceWei = await getPrice(name, 1, false);
          console.log('[SearchBar] priceWei received:', priceWei, typeof priceWei);
          const priceStr = formatEther(priceWei);
          console.log('[SearchBar] priceStr:', priceStr);
          const usdStr = formatUSD(priceWei);
          setResult({ status: 'available', name, price: priceStr, priceUsd: usdStr });
        } catch (err) {
          // If price fetch fails, still show as available but without price
          setResult({ status: 'available', name });
        } finally {
          setPriceLoading(false);
        }
      } else {
        const reg = await getRegistration(name);
        if (reg) {
          setResult({ status: 'taken', name, owner: reg.owner });
        } else {
          setResult({ status: 'reserved', name });
        }
      }
    } catch (err: any) {
      // Check if it's a validation error from the contract (name too short, etc)
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
        // Network or other errors - don't show as available
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (result.status === 'available' && onSelect) {
      onSelect(result.name);
    }
  };

  return (
    <div className={compact ? 'w-full' : 'w-full max-w-[520px] mx-auto'}>
      <form onSubmit={handleSubmit}>
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
            className={`flex-1 bg-transparent outline-none text-white font-satoshi transition-all duration-150 ${
              compact ? 'px-4 py-3 text-base' : 'px-5 py-4 text-lg'
            }`}
          />
          <span className={`text-[#00D179] font-medium font-satoshi ${compact ? 'text-base' : 'text-lg'} pr-1`}>
            .qf
          </span>
          <button
            type="submit"
            disabled={searching}
            className={`transition-all duration-200 mr-4 cursor-pointer disabled:cursor-not-allowed ${
              result.status === 'available' ? 'text-[#00D179]' :
              result.status === 'reserved' ? 'text-amber-500' :
              result.status === 'taken' ? 'text-[#E5484D]' :
              'text-[#00D179] hover:text-[#00B868]'
            } ${compact ? 'p-1' : 'p-1'}`}
          >
            {searching ? (
              <span className="inline-block w-5 h-5 border-2 border-[#00D179]/30 border-t-[#00D179] rounded-full animate-spin" />
            ) : result.status === 'available' ? (
              <Check size={compact ? 20 : 24} strokeWidth={2.5} />
            ) : result.status === 'reserved' ? (
              <Shield size={compact ? 20 : 24} strokeWidth={2.5} />
            ) : result.status === 'taken' ? (
              <X size={compact ? 20 : 24} strokeWidth={2.5} />
            ) : (
              <ArrowRight size={compact ? 20 : 24} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </form>

      {/* Loading Shimmer - shown while searching */}
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

      {/* Results - shown when not searching and has a result */}
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
                {priceLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : result.price ? (
                  `${result.price} QF / year (${result.priceUsd})`
                ) : (
                  'Loading price...'
                )}
              </div>
              {onSelect && (
                <button
                  onClick={() => onSelect(result.name)}
                  className="w-full py-2.5 bg-black hover:bg-black/80 text-[#00D179] font-bold rounded-lg transition-all duration-200 cursor-pointer"
                >
                  Register
                </button>
              )}
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
                <p className="text-xs text-[#555555] mt-1">
                  Owned by {truncateAddress(result.owner)}
                </p>
              )}
              <Link
                to={`/name/${result.name}`}
                className="inline-flex items-center gap-1 text-xs text-[#00D179] hover:text-[#00B868] mt-2 transition-colors"
              >
                View Profile <ArrowRight size={12} />
              </Link>
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
              <p className="text-xs text-[#555555] mt-1">
                This name is reserved for an ecosystem project.
              </p>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
