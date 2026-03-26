import { useEffect, useState } from 'react';
import { ArrowRight, Check, Shield, X } from 'lucide-react';
import { motion } from 'framer-motion';

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

  // Handle pulse effect when result becomes available
  useEffect(() => {
    if (resultStatus !== 'available') {
      setPulseSearchGlow(false);
      return;
    }

    setPulseSearchGlow(true);

    const timer = setTimeout(() => {
      setPulseSearchGlow(false);
    }, 1100);

    return () => clearTimeout(timer);
  }, [resultStatus]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="relative">
        <div
          className={`flex items-center bg-[#141414] border rounded-xl transition-all duration-300 ${
            input ? 'border-[#00D179]' : 'border-[#1E1E1E]'
          } ${isSearchFocused ? 'search-bar-focus-glow' : ''} ${pulseSearchGlow ? 'search-bar-available-pulse' : ''} focus-within:border-[#00D179] search-bar-shell`}
        >
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
            placeholder="Search for a name"
            className="flex-1 bg-transparent outline-none text-white font-satoshi px-5 py-4 text-lg transition-all duration-150"
          />
          <span className="text-[#00D179] font-medium font-satoshi text-lg pr-1">.qf</span>
          <motion.button
            type="submit"
            disabled={searching}
            className={`transition-all duration-200 mr-4 cursor-pointer disabled:cursor-not-allowed ${
              resultStatus === 'available' ? 'text-[#00D179]' :
              resultStatus === 'reserved' ? 'text-amber-500' :
              resultStatus === 'taken' ? 'text-[#E5484D]' :
              'text-[#00D179] hover:text-[#00B868]'
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
  );
}
