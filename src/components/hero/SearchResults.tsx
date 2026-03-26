import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface SearchResultsProps {
  searching: boolean;
  result: {
    status: 'available' | 'taken' | 'reserved' | 'invalid' | 'idle';
    name: string;
    error?: string;
    owner?: string;
  };
  searchPrice: bigint | null;
  onSelectName: (name: string) => void;
  formatQF: (value: bigint) => string;
  truncateAddress: (addr: string) => string;
}

export default function SearchResults({
  searching,
  result,
  searchPrice,
  onSelectName,
  formatQF,
  truncateAddress,
}: SearchResultsProps) {
  if (searching) {
    return (
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
    );
  }

  if (result.status === 'idle') {
    return null;
  }

  return (
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
            onClick={() => onSelectName(result.name)}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
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
  );
}
