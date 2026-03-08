import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWalletStore } from '../stores/walletStore';
import { Copy, LogOut, Wallet } from 'lucide-react';
import { getQFBalance, formatQF, getNamesOwnedByAddress } from '../utils/qns';

export default function Navbar() {
  const { address, displayName, qnsName, connecting, connect, disconnect } = useWalletStore();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [ownedNames, setOwnedNames] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch balance and names when dropdown opens
  useEffect(() => {
    if (dropdownOpen && address) {
      getQFBalance(address).then(setBalance);
      getNamesOwnedByAddress(address).then((names) => {
        setOwnedNames(names.map((n) => n.name));
      });
    }
  }, [dropdownOpen, address]);

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

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setDropdownOpen(false);
  };

  const displayedNames = ownedNames.slice(0, 3);
  const hasMoreNames = ownedNames.length > 3;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#1E1E1E]">
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

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#141414] border border-[#1E1E1E] rounded-[12px] shadow-2xl transition-all duration-150 ease-in-out overflow-hidden origin-top animate-dropdown-in">
                  {/* Header - Display Name with Clash Display */}
                  <div className="px-4 py-4 border-b border-[#1E1E1E]">
                    <p className="text-[#8A8A8A] text-xs mb-1">Your Name</p>
                    <p className="font-clash font-semibold text-xl text-white">
                      {qnsName ? (
                        <span>
                          {qnsName}<span className="text-[#00D179]">.qf</span>
                        </span>
                      ) : (
                        <span className="text-[#8A8A8A] text-base font-satoshi font-normal">No primary name set</span>
                      )}
                    </p>
                  </div>

                  {/* Wallet Address with Copy */}
                  <div className="px-4 py-3 border-b border-[#1E1E1E]">
                    <p className="text-[#8A8A8A] text-xs mb-1">Wallet Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-white text-sm font-mono bg-[#0A0A0A] px-2 py-1.5 rounded-lg flex-1 truncate">
                        {address}
                      </code>
                      <button
                        onClick={copyAddress}
                        className="p-1.5 text-[#8A8A8A] hover:text-[#00D179] transition-colors cursor-pointer"
                        title="Copy address"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  {/* QF Balance */}
                  <div className="px-4 py-3 border-b border-[#1E1E1E]">
                    <p className="text-[#8A8A8A] text-xs mb-1">Balance</p>
                    <p className="text-white font-medium">
                      {balance !== null ? (
                        <span className="flex items-center gap-2">
                          <Wallet size={16} className="text-[#00D179]" />
                          {formatQF(balance)} QF
                        </span>
                      ) : (
                        <span className="text-[#8A8A8A]">Loading...</span>
                      )}
                    </p>
                  </div>

                  {/* Owned Names List - Max 3 with View All */}
                  {ownedNames.length > 0 && (
                    <div className="px-4 py-3 border-b border-[#1E1E1E]">
                      <p className="text-[#8A8A8A] text-xs mb-2">
                        Your Names ({ownedNames.length})
                      </p>
                      <div className="space-y-1">
                        {displayedNames.map((name) => (
                          <Link
                            key={name}
                            to={`/my-names?expand=${name}`}
                            className="block text-white text-sm py-1.5 px-2 rounded-lg bg-[#0A0A0A] hover:bg-[#1E1E1E] transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            {name}<span className="text-[#00D179]">.qf</span>
                          </Link>
                        ))}
                        {hasMoreNames && (
                          <Link
                            to="/my-names"
                            className="block text-sm text-[#00D179] hover:text-[#00B868] py-1.5 px-2 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            View all →
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disconnect Button */}
                  <div className="p-3">
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#E5484D]/10 hover:bg-[#E5484D]/20 text-[#E5484D] font-medium transition-colors cursor-pointer"
                    >
                      <LogOut size={16} />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
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
      <style>{`
        @keyframes dropdown-in {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-dropdown-in {
          animation: dropdown-in 0.15s ease-out forwards;
        }
      `}</style>
    </nav>
  );
}
