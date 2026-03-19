import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, LogOut, Wallet, X, Info } from 'lucide-react';
import { getSubstrateQFBalance, formatQF } from '../utils/qns';
import { useCopy } from '../hooks/useCopy';
import { truncateAddress } from '../utils/address';

export default function Navbar() {
  const { 
    address, 
    ss58Address,
    displayName, 
    qnsName, 
    connecting, 
    connect, 
    disconnect
  } = useWalletStore();
  const ownedNames = useNamesStore((state) => state.ownedNames);
  const refreshNames = useNamesStore((state) => state.refreshNames);
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { copy, copied } = useCopy();

  // Stable callback for refreshNames to avoid useEffect re-runs
  const doRefreshNames = useCallback((addr: `0x${string}`) => {
    refreshNames(addr);
  }, [refreshNames]);

  // Fetch balance and names when dropdown opens or address changes
  useEffect(() => {
    if (dropdownOpen && address) {
      // For substrate wallets, fetch substrate balance
      if (ss58Address) {
        getSubstrateQFBalance(ss58Address).then(setBalance);
      } else {
        // For EVM wallets, fetch EVM balance
        import('../utils/qns').then(({ getQFBalance }) => {
          getQFBalance(address).then(setBalance);
        });
      }
      doRefreshNames(address);
    }
  }, [dropdownOpen, address, ss58Address, doRefreshNames]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const copyAddress = (addr: string | null) => {
    if (addr) {
      copy(addr, false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
    setShowAccountInfo(false);
  };

  // Memoize name list derivation to prevent unnecessary re-reers
  const ownedNameStrings = ownedNames.map((n) => n.name);
  const displayedNames = ownedNameStrings.slice(0, 3);
  const hasMoreNames = ownedNameStrings.length > 3;

  // Close dropdown and show account info
  const handleShowAccountInfo = () => {
    setDropdownOpen(false);
    setShowAccountInfo(true);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-md">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-clash font-semibold text-xl text-white tracking-tight hover:opacity-80 transition-opacity"
          >
            QNS<span className="text-[#00D179]">.</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              to="/my-names"
              className="hidden sm:block text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
            >
              My Names
            </Link>

            {address ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="px-4 py-2 rounded-xl border border-[#00D179] text-white text-sm font-medium hover:bg-[#00D17915] transition-all duration-200 cursor-pointer"
                >
                  {qnsName ? (
                    <span>
                      {qnsName}<span className="text-[#00D179]">.qf</span>
                    </span>
                  ) : (
                    displayName
                  )}
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/50 backdrop-blur-xl"
                    >
                      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-[#00D179]/15 via-[#00D179]/5 to-transparent" />

                      <div className="relative px-4 pb-4 pt-5">
                        <p className="mb-1 text-xs text-[#8A8A8A]">Your Name</p>
                        <div className="font-clash text-xl font-bold text-white">
                          {qnsName ? (
                            <span>
                              {qnsName}<span className="text-[#00D179]">.qf</span>
                            </span>
                          ) : (
                            <span className="font-satoshi text-base font-normal text-[#8A8A8A]">No primary name set</span>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-white/5 px-4 py-4">
                        <p className="mb-2 text-xs text-[#8A8A8A]">Wallet Address</p>
                        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                          <code className="min-w-0 flex-1 truncate text-sm font-mono text-gray-400">
                            {ss58Address || address}
                          </code>
                          <button
                            onClick={() => copyAddress(ss58Address || address)}
                            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/5 hover:text-[#00D179] cursor-pointer"
                            title="Copy address"
                          >
                            <Copy size={14} />
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        {ss58Address && (
                          <p className="mt-2 text-xs text-[#8A8A8A]">
                            EVM: {truncateAddress(address || '')}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/5 px-4 py-4">
                        <p className="mb-2 text-xs text-[#8A8A8A]">Balance</p>
                        {balance !== null ? (
                          <div className="flex items-center gap-2 text-white">
                            <Wallet size={16} className="text-[#00D179]" />
                            <span className="text-lg font-semibold">{formatQF(balance)}</span>
                            <span className="text-sm text-gray-500">QF</span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#8A8A8A]">Loading...</span>
                        )}
                      </div>

                      {ss58Address && (
                        <div className="border-t border-white/5 px-4 py-3">
                          <button
                            onClick={handleShowAccountInfo}
                            className="flex w-full items-center gap-2 text-sm text-[#00D179] hover:text-[#00B868] transition-colors cursor-pointer"
                          >
                            <Info size={16} />
                            <span>View Account Details</span>
                          </button>
                        </div>
                      )}

                      {ownedNames.length > 0 && (
                        <div className="border-t border-white/5 px-4 py-4">
                          <p className="mb-3 text-xs text-[#8A8A8A]">Your Names ({ownedNames.length})</p>
                          <div className="space-y-2">
                            {displayedNames.map((name) => {
                              const isPrimaryName = qnsName === name;

                              return (
                                <Link
                                  key={name}
                                  to={`/my-names?expand=${name}`}
                                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-sm text-[#00D179] transition-colors hover:bg-white/10 cursor-pointer"
                                  onClick={() => setDropdownOpen(false)}
                                >
                                  <span>
                                    {name}<span className="text-[#00D179]">.qf</span>
                                  </span>
                                  {isPrimaryName && <span className="h-2 w-2 rounded-full bg-[#00D179]" />}
                                </Link>
                              );
                            })}
                            {hasMoreNames && (
                              <Link
                                to="/my-names"
                                className="block rounded-xl bg-white/5 px-4 py-2.5 text-sm text-[#00D179] transition-colors hover:bg-white/10"
                                onClick={() => setDropdownOpen(false)}
                              >
                                View all →
                              </Link>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="border-t border-white/5 p-4">
                        <button
                          onClick={handleDisconnect}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-3 text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer"
                        >
                          <LogOut size={16} />
                          Disconnect
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="px-4 py-2 rounded-xl border border-[#00D179] text-white text-sm font-medium hover:bg-[#00D17915] transition-all duration-200 disabled:opacity-50 cursor-pointer"
              >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Account Info Modal */}
      <AnimatePresence>
        {showAccountInfo && ss58Address && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAccountInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-white/5">
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/10 via-[#00D179]/5 to-transparent" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h2 className="font-clash text-xl font-semibold text-white">Account Details</h2>
                    <p className="mt-1 text-sm text-[#8A8A8A]">Your QF Network addresses</p>
                  </div>
                  <button
                    onClick={() => setShowAccountInfo(false)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Address Info */}
              <div className="p-6 space-y-6">
                {/* Substrate Address */}
                <div>
                  <p className="mb-2 text-xs text-[#8A8A8A]">Your QF Address (Substrate)</p>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <code className="min-w-0 flex-1 break-all text-sm font-mono text-gray-400">
                      {ss58Address}
                    </code>
                    <button
                      onClick={() => copyAddress(ss58Address)}
                      className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/5 hover:text-[#00D179] cursor-pointer border border-white/10"
                      title="Copy Substrate address"
                    >
                      <Copy size={14} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* EVM Address */}
                {address && (
                  <div>
                    <p className="mb-2 text-xs text-[#8A8A8A]">Your Derived EVM Address</p>
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                      <code className="min-w-0 flex-1 break-all text-sm font-mono text-gray-400">
                        {address}
                      </code>
                      <button
                        onClick={() => copyAddress(address)}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/5 hover:text-[#00D179] cursor-pointer border border-white/10"
                        title="Copy EVM address"
                      >
                        <Copy size={14} />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Note */}
                <div className="rounded-xl bg-[#00D179]/5 border border-[#00D179]/20 p-4">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-[#00D179] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-300">
                        <span className="text-[#00D179] font-medium">Important:</span> Save your EVM address — you'll need it when MetaMask support launches.
                      </p>
                      <p className="text-xs text-[#8A8A8A] mt-2">
                        Your Substrate address is your primary address. The EVM address is derived from it and can receive tokens from Ethereum-compatible wallets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                <button
                  onClick={() => setShowAccountInfo(false)}
                  className="w-full py-2.5 rounded-xl bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
