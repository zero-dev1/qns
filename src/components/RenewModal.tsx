import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useWalletStore } from '../stores/walletStore';
import { calculatePrice, getQFBalance, getSubstrateQFBalance, getContractPrices, formatQF } from '../utils/qns';

interface RenewModalProps {
  name: string;
  currentExpiry: bigint;
  nameLength: number;
  onClose: () => void;
  onConfirm: (years: number) => void;
}

const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.15,
    },
  },
};

export default function RenewModal({ name, currentExpiry, nameLength, onClose, onConfirm }: RenewModalProps) {
  const [selectedYears, setSelectedYears] = useState(1);
  const [prices, setPrices] = useState({
    price3Char: 0n,
    price4Char: 0n,
    price5PlusChar: 0n,
    permanentMultiplier: 0n,
  });
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const { address, ss58Address } = useWalletStore();

  const gasBuffer = 500000000000000000n; // 0.5 QF

  useEffect(() => {
    const loadData = async () => {
      if (!address || !ss58Address) return;
      
      try {
        const [contractPrices] = await Promise.all([
          getContractPrices(),
        ]);

        // Fetch balance: SS58-first (Substrate native), EVM fallback
        let balance = 0n;
        try {
          if (ss58Address) {
            const substrateBal = await getSubstrateQFBalance(ss58Address);
            if (substrateBal > 0n) {
              balance = substrateBal;
            } else if (address) {
              balance = await getQFBalance(address);
            }
          } else if (address) {
            balance = await getQFBalance(address);
          }
        } catch {
          balance = 0n;
        }
        
        setPrices({
          price3Char: contractPrices.price3Char,
          price4Char: contractPrices.price4Char,
          price5PlusChar: contractPrices.price5PlusChar,
          permanentMultiplier: contractPrices.permanentMultiplier,
        });
        setUserBalance(balance);
        
        // Select the most expensive option the user can afford, or nothing if they can't afford any
        const options = [5, 3, 2, 1];
        let selected = 0; // 0 means nothing selected
        for (const years of options) {
          const cost = calculatePrice(nameLength, years, false, contractPrices);
          if (balance >= cost + gasBuffer) {
            selected = years;
            break;
          }
        }
        setSelectedYears(selected);
      } catch (error) {
        console.error('Failed to load renewal data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [address, ss58Address, nameLength]);

  const canAffordOption = (years: number) => {
    const cost = calculatePrice(nameLength, years, false, prices);
    return userBalance >= cost + gasBuffer;
  };

  const canAffordSelected = selectedYears > 0 && canAffordOption(selectedYears);

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getNewExpiry = (years: number) => {
    return currentExpiry + BigInt(years) * 365n * 24n * 60n * 60n;
  };

  if (loading) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        initial={modalBackdropVariants.hidden}
        animate={modalBackdropVariants.visible}
        exit={modalBackdropVariants.exit}
      >
        <motion.div
          className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] shadow-2xl shadow-[#00D179]/10 p-6"
          initial={modalContentVariants.hidden}
          animate={modalContentVariants.visible}
          exit={modalContentVariants.exit}
        >
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-[#00D179] animate-spin" />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      initial={modalBackdropVariants.hidden}
      animate={modalBackdropVariants.visible}
      exit={modalBackdropVariants.exit}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] shadow-2xl shadow-[#00D179]/10"
        initial={modalContentVariants.hidden}
        animate={modalContentVariants.visible}
        exit={modalContentVariants.exit}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/10 via-[#00D179]/5 to-transparent" />
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-clash text-xl font-bold text-white">
              Renew {name}<span className="text-[#00D179]">.qf</span>
            </h3>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Current expiry display */}
          <div className="mb-6 p-4 rounded-xl border border-white/5 bg-[#0C0C0C]">
            <div className="text-sm text-gray-500 mb-1">Current expiry</div>
            <div className="text-white font-medium">{formatDate(currentExpiry)}</div>
          </div>

          {/* Duration options */}
          <div className="space-y-3 mb-6">
            {[1, 2, 3, 5].map((years) => {
              const cost = calculatePrice(nameLength, years, false, prices);
              const canAfford = canAffordOption(years);
              const newExpiry = getNewExpiry(years);
              
              return (
                <button
                  key={years}
                  onClick={() => canAfford && setSelectedYears(years)}
                  disabled={!canAfford}
                  className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                    selectedYears === years && canAfford
                      ? 'border-[#00D179]/50 bg-[#00D179]/5'
                      : canAfford
                      ? 'border-white/10 bg-[#0C0C0C] hover:border-[#00D179]/30 hover:bg-[#00D179]/5'
                      : 'border-white/5 bg-[#0C0C0C] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                        selectedYears === years && canAfford
                          ? 'border-[#00D179] bg-[#00D179]'
                          : canAfford
                          ? 'border-gray-500 bg-transparent'
                          : 'border-gray-600 bg-gray-800'
                      }`}>
                        {selectedYears === years && canAfford && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${
                        selectedYears === years && canAfford ? 'text-[#00D179]' : canAfford ? 'text-white' : 'text-gray-600'
                      }`}>
                        {years} Year{years > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        selectedYears === years && canAfford ? 'text-[#00D179]' : canAfford ? 'text-white' : 'text-gray-600'
                      }`}>
                        {formatQF(cost)} QF
                      </div>
                      {!canAfford && (
                        <div className="text-xs text-gray-600 mt-1">Insufficient balance</div>
                      )}
                    </div>
                  </div>
                  {selectedYears === years && canAfford && (
                    <div className="text-xs text-[#00D179] mt-2">
                      New expiry: {formatDate(newExpiry)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <button
            onClick={() => {
              if (!canAffordSelected) return;
              onConfirm(selectedYears);
            }}
            disabled={!canAffordSelected}
            className={`w-full py-3 font-bold rounded-xl transition-colors ${
              canAffordSelected
                ? 'bg-[#00D179] hover:bg-[#00B868] text-black cursor-pointer'
                : 'bg-[#00D179]/50 text-black/50 cursor-not-allowed'
            }`}
          >
            Confirm Renewal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
