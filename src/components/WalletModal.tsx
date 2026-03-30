import { useRef, useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

// Simple mobile detection helper
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);


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

const MetaMaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.5 3.5L13 9l1.5-3.5L20.5 3.5z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.5 3.5L11 9.1 9.5 5.5 3.5 3.5z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17.5 16.5L15.5 19.5 20 21l1.5-4.5-4 0z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.5 16.5L4 21l4.5-1.5-2-3H2.5z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.5 10.5l-1.5 2 5 .5-.5-5.5-3 3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.5 10.5l3-3-.5 5.5 5-.5-1.5-2h-6z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);



interface WalletOption {
  id: 'talisman' | 'subwallet' | 'metamask';
  name: string;
  icon: React.ReactNode;
  description?: string;
}

export default function WalletModal() {
  const { 
    connecting, 
    connectWallet,
    connectMetaMask,
    showWalletModal,
    setShowWalletModal,
    walletError,
    clearWalletError
  } = useWalletStore();
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Get wallet options based on platform
  const getWalletOptions = (): WalletOption[] => {
    if (isMobile()) {
      return [
        {
          id: 'metamask',
          name: 'MetaMask',
          icon: <MetaMaskIcon />,
          description: 'Recommended — fastest experience',
        },
        {
          id: 'subwallet',
          name: 'SubWallet',
          icon: <SubWalletIcon />,
          description: 'Substrate wallet for QF Network',
        },
      ];
    }

    return [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: <MetaMaskIcon />,
        description: 'Recommended — fastest experience',
      },
      {
        id: 'talisman',
        name: 'Talisman',
        icon: <TalismanIcon />,
        description: 'Substrate wallet for QF Network',
      },
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

  // Auto-focus modal backdrop for ESC key handling
  useEffect(() => {
    if (showWalletModal) {
      // Small delay to let animation start
      const timer = setTimeout(() => {
        const backdrop = document.querySelector('[data-wallet-modal-backdrop]') as HTMLElement;
        backdrop?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showWalletModal]);

  const handleWalletSelect = async (walletType: 'talisman' | 'subwallet' | 'metamask') => {
    try {
      clearWalletError();
      if (walletType === 'metamask') {
        await connectMetaMask();
      } else {
        await connectWallet(walletType);
      }

      // Mobile override: if a substrate wallet fails on mobile,
      // tell the user to open in the wallet's built-in browser
      if (walletType !== 'metamask') {
        const currentError = useWalletStore.getState().walletError;
        if (currentError && isMobile()) {
          useWalletStore.getState().clearWalletError();
          useWalletStore.setState({
            walletError: "Open this dApp inside SubWallet's built-in browser to connect on mobile.",
          });
        }
      }
    } catch {
      // Error handled in store
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
          onKeyDown={(e) => { if (e.key === 'Escape') setShowWalletModal(false); }}
          tabIndex={-1}
          data-wallet-modal-backdrop
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
                    {wallet.description && (
                      <p className="text-xs text-[#8A8A8A] mt-0.5">{wallet.description}</p>
                    )}
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
                {isMobile() ? (
                  <>
                    Using SubWallet?{' '}
                    <a
                      href="#"
                      className="text-[#00D179] hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open('https://www.subwallet.app/', '_blank');
                      }}
                    >
                      Open in SubWallet browser
                    </a>
                    {' '}for Substrate features
                  </>
                ) : (
                  <>
                    Need a Substrate wallet?{' '}
                    <a
                      href="#"
                      className="text-[#00D179] hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open('https://talisman.xyz', '_blank');
                      }}
                    >
                      Get Talisman
                    </a>
                    {' '}for advanced QF Network features
                  </>
                )}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
