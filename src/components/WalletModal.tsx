import { useRef, useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';


// Simple icon components for wallet logos
const TalismanIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
  </svg>
);

const SubWalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </svg>
);



interface WalletOption {
  id: 'talisman' | 'subwallet';
  name: string;
  icon: React.ReactNode;
}

export default function WalletModal() {
  const { 
    connecting, 
    connectWallet,
    showWalletModal,
    setShowWalletModal,
    walletError,
    clearWalletError
  } = useWalletStore();
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Get wallet options based on WALLET_MODE
  const getWalletOptions = (): WalletOption[] => {
    return [
      { id: 'talisman', name: 'Talisman', icon: <TalismanIcon /> },
      { id: 'subwallet', name: 'SubWallet', icon: <SubWalletIcon /> }
    ];
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowWalletModal(false);
      }
    };
    
    if (showWalletModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletModal, setShowWalletModal]);

  const handleWalletSelect = async (walletType: 'talisman' | 'subwallet') => {
    try {
      // Clear any previous errors
      clearWalletError();
      
      // Connect wallet - this will:
      // 1. Connect and get accounts
      // 2. Resolve QNS name (reverse lookup)
      // 3. Update UI state
      // 4. Close the modal (done in store on success)
      await connectWallet(walletType);
      
      // Modal is automatically closed by the store on success
      // If there's an error, the modal stays open and shows the error
    } catch (err: any) {
      // Error is already handled in the store
      // Modal stays open so user sees the error
          }
  };

  const walletOptions = getWalletOptions();

  return (
    <AnimatePresence>
      {showWalletModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowWalletModal(false)}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-5 border-b border-white/5">
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/10 via-[#00D179]/5 to-transparent" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h2 className="font-clash text-xl font-semibold text-white">Connect Wallet</h2>
                  <p className="mt-1 text-sm text-[#8A8A8A]">Select your preferred wallet</p>
                </div>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Wallet Options */}
            <div className="p-4 space-y-2">
              {/* Error Message */}
              {walletError && (
                <div className="mb-4 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 p-4">
                  <p className="text-sm text-[#E5484D] font-medium">{walletError}</p>
                </div>
              )}
              
              {/* Connecting State */}
              {connecting && (
                <div className="mb-4 rounded-xl bg-[#00D179]/10 border border-[#00D179]/30 p-4">
                  <p className="text-sm text-[#00D179] font-medium">Waiting for authorization...</p>
                  <p className="text-xs text-[#8A8A8A] mt-1">Please check your wallet extension</p>
                </div>
              )}
              
              {walletOptions.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleWalletSelect(wallet.id)}
                  disabled={connecting}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-4 text-white transition-all hover:border-[#00D179]/30 hover:bg-[#00D179]/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#8A8A8A] group-hover:text-[#00D179] group-hover:bg-[#00D179]/10 transition-colors">
                    {wallet.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-medium">{wallet.name}</span>
                  </div>
                  <div className="text-[#8A8A8A] group-hover:text-[#00D179] transition-colors">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
              <p className="text-xs text-center text-[#8A8A8A]">
                New to QF Network?{' '}
                <a 
                  href="#" 
                  className="text-[#00D179] hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://talisman.xyz', '_blank');
                  }}
                >
                  Get a wallet
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
