import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Twitter,
  Loader2,
  Check,
  Wallet,
  X,
} from 'lucide-react';
import {
  transferNameOnChain,
  getTextRecord,
  resolveForward,
  getNamesOwnedByAddress,
  resolveReverse,
} from '../utils/qns';
import { ss58ToEvmAddress } from '../utils/address';
import { useToast } from '../contexts/ToastContext';
import { hapticSuccess, hapticError, hapticTap } from '../utils/haptics';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../utils/errorHelpers';
import IdentityCard from '../components/IdentityCard';
import Avatar from '../components/Avatar';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

const TEXT_KEYS = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'] as const;






export default function MyNamesPage() {
  const { address, ss58Address, connect, refreshName, providerType } = useWalletStore();
  const { refreshNames } = useNamesStore();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const expandName = searchParams.get('expand');
  const hasAutoExpanded = useRef(false);

  // Compute the correct signer address based on provider type
  const signerAddress = providerType === 'evm' ? address : (ss58Address || address);

  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [textRecords, setTextRecords] = useState<Record<string, Record<string, string>>>({});
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [primaryName, setPrimaryNameState] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [enableTilt, setEnableTilt] = useState(false);


  const loadNames = useCallback(async () => {
    if (!address) return;

    // Pre-fill from the Zustand store if it has names and our local state is empty.
    const storeNames = useNamesStore.getState().ownedNames;
    if (storeNames.length > 0 && names.length === 0) {
      const mapped = storeNames.map((item) => ({
        name: item.name,
        expires: item.expires ?? 0n,
        isPermanent: item.isPermanent ?? (item.expires === 0n),
        registeredAt: item.registeredAt ?? 0n,
      }));
      setNames(mapped);
      for (const item of mapped) {
        loadTextRecords(item.name);
      }
    }

    // Only show the loading spinner if we have nothing to display yet
    const hasLocalNames = names.length > 0 || storeNames.length > 0;
    if (!hasLocalNames) {
      setLoading(true);
    }

    try {
      const ownedNames = await getNamesOwnedByAddress(address);
      if (ownedNames.length > 0) {
        const mappedNames = ownedNames.map((item) => ({
          name: item.name,
          expires: item.expires,
          isPermanent: item.expires === 0n,
          registeredAt: item.registeredAt,
        }));
        setNames(mappedNames);
        for (const item of mappedNames) {
          loadTextRecords(item.name);
        }
      }
      // If chain returns empty but we have optimistic names, do NOT clear.
      // The bgRefresh after 5s will reconcile.
    } catch {
      // Keep whatever we have
    } finally {
      setLoading(false);
    }
  }, [address]);

  const bgRefresh = useCallback(async () => {
    if (!address) return;
    try {
      const ownedNames = await getNamesOwnedByAddress(address);
      if (ownedNames.length > 0) {
        const mappedNames = ownedNames.map((item) => ({
          name: item.name,
          expires: item.expires,
          isPermanent: item.expires === 0n,
          registeredAt: item.registeredAt,
        }));
        setNames(mappedNames);
        for (const item of mappedNames) {
          if (!textRecords[item.name]) {
            loadTextRecords(item.name);
          }
        }
      } else {
        setNames([]);
      }
    } catch {
      // silently ignore — keep existing state
    }
  }, [address]);

  useEffect(() => {
    hasAutoExpanded.current = false;
    loadNames();
  }, [loadNames]);

  // Fetch primary name when address changes
  useEffect(() => {
    if (address) {
      resolveReverse(address).then((name) => {
        setPrimaryNameState(name);
      });
    }
  }, [address]);

  // Auto-expand effect (temporary — commit 3 will wire it to DetailModal)
  useEffect(() => {
    if (expandName && !hasAutoExpanded.current && names.some((n) => n.name === expandName)) {
      hasAutoExpanded.current = true;
      // Will open DetailModal in commit 3. For now, just mark as expanded.
    }
  }, [expandName, names]);

  // After registration navigation, schedule a background refresh
  // to replace optimistic data with real chain data
  useEffect(() => {
    if (expandName && address) {
      const timer = setTimeout(() => bgRefresh(), 3000);
      return () => clearTimeout(timer);
    }
  }, [expandName, address, bgRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleMediaChange = () => setEnableTilt(!mediaQuery.matches);

    handleMediaChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => mediaQuery.removeEventListener('change', handleMediaChange);
    }

    mediaQuery.addListener(handleMediaChange);
    return () => mediaQuery.removeListener(handleMediaChange);
  }, []);

  // Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (transferModal) setTransferModal(null);
      }
    };

    if (transferModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [transferModal]);

  const loadTextRecords = async (name: string) => {
    const records: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      records[key] = await getTextRecord(name, key);
    }
    setTextRecords((prev) => ({ ...prev, [name]: records }));
  };




  // Detail modal handlers (for commit 3)
  const openDetailModal = (_name: string, _tab?: 'overview' | 'edit' | 'manage' | 'share') => {
    // Will open DetailModal in commit 3
    hapticTap();
  };

  // Sort functionality
  const [sortMode, setSortMode] = useState<'primary' | 'alpha' | 'expiry'>('primary');

  const sortedNames = names.sort((a, b) => {
    if (sortMode === 'primary') {
      const aPrimary = primaryName === a.name;
      const bPrimary = primaryName === b.name;
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'alpha') {
      return a.name.localeCompare(b.name);
    }
    // expiry sort
    const aExpiry = a.isPermanent ? 9999999999999n : a.expires;
    const bExpiry = b.isPermanent ? 9999999999999n : b.expires;
    return aExpiry < bExpiry ? -1 : aExpiry > bExpiry ? 1 : 0;
  });

  // Card records mapping for IdentityCard
  const cardRecords = new Map(
    names.map((name) => [
      name.name,
      {
        avatar: textRecords[name.name]?.avatar || '',
        bio: textRecords[name.name]?.bio || '',
        twitter: textRecords[name.name]?.twitter || '',
        telegram: textRecords[name.name]?.telegram || '',
        website: textRecords[name.name]?.url || '',
        email: textRecords[name.name]?.email || '',
      },
    ])
  );



  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-16">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6">

          {/* ── NOT CONNECTED STATE ── */}
          {!address && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-[#111] p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-white/[0.04] flex items-center justify-center">
                  <Wallet size={24} className="text-[#555]" />
                </div>
                <h2 className="font-clash text-xl font-bold text-white mb-2">
                  Connect your wallet
                </h2>
                <p className="text-sm text-[#555] mb-6">
                  Connect to view and manage your .qf identities
                </p>
                <button
                  onClick={() => connect()}
                  className="w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            </motion.div>
          )}

          {/* ── LOADING STATE ── */}
          {address && loading && (
            <div className="py-12">
              {/* Summary bar skeleton */}
              <div className="rounded-xl border border-white/[0.04] bg-[#111] p-4 mb-8 animate-pulse">
                <div className="flex items-center gap-6">
                  <div className="h-4 w-24 rounded bg-white/[0.06]" />
                  <div className="h-4 w-16 rounded bg-white/[0.04]" />
                  <div className="ml-auto h-4 w-32 rounded bg-white/[0.04]" />
                </div>
              </div>
              {/* Card grid skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#111] p-6 animate-pulse">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-full bg-white/[0.06] mb-4" />
                      <div className="h-5 w-28 rounded bg-white/[0.06] mb-2" />
                      <div className="h-3 w-20 rounded bg-white/[0.04] mb-4" />
                      <div className="h-3 w-40 rounded bg-white/[0.03]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {address && !loading && names.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <div className="text-5xl mb-4 opacity-20">✦</div>
              <h2 className="font-clash text-xl font-bold text-white mb-2">
                No names yet
              </h2>
              <p className="text-sm text-[#555] mb-6 text-center max-w-xs">
                Claim your first .qf identity and make it yours
              </p>
              <a
                href="/?search="
                className="px-6 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors"
              >
                Claim your first .qf identity
              </a>
            </motion.div>
          )}

          {/* ── POPULATED STATE ── */}
          {address && !loading && names.length > 0 && (
            <>
              {/* Summary Bar */}
              <div className="rounded-xl border border-white/[0.04] bg-[#111] px-5 py-4 mb-8">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  {/* Wallet */}
                  <div className="flex items-center gap-2 text-xs text-[#555]">
                    <Wallet size={14} />
                    <span className="font-mono">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  </div>

                  {/* Name count */}
                  <div className="text-xs text-[#888]">
                    {names.length} name{names.length !== 1 ? 's' : ''}
                  </div>

                  {/* Primary identity */}
                  {primaryName && (
                    <a
                      href={`/name/${primaryName}`}
                      className="flex items-center gap-2 text-xs text-[#00D179] hover:text-[#00B868] transition-colors"
                    >
                      <Avatar
                        url={cardRecords.get(primaryName)?.avatar}
                        name={primaryName}
                        size={20}
                      />
                      <span className="font-medium">{primaryName}.qf</span>
                    </a>
                  )}

                  {/* Renewal intelligence */}
                  <div className="ml-auto text-xs">
                    {(() => {
                      const annualNames = names.filter((n) => !n.isPermanent && n.expires > 0n);
                      if (annualNames.length === 0) {
                        return <span className="text-[#00D179]">All permanent</span>;
                      }
                      const earliest = annualNames.reduce((a, b) =>
                        a.expires < b.expires ? a : b
                      );
                      const expiryDate = new Date(Number(earliest.expires) * 1000);
                      const nowMs = Date.now();
                      const daysUntil = Math.floor((expiryDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
                      const formatted = expiryDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });
                      return (
                        <span className={daysUntil <= 30 ? 'text-red-400' : 'text-amber-400'}>
                          Next renewal: {formatted}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Sort toolbar */}
              <div className="flex items-center gap-2 mb-5">
                {(['primary', 'alpha', 'expiry'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sortMode === mode
                        ? 'bg-[#00D179]/10 text-[#00D179] border border-[#00D179]/20'
                        : 'bg-white/[0.02] text-[#555] border border-white/[0.04] hover:text-white'
                    }`}
                  >
                    {mode === 'primary' ? 'Primary first' : mode === 'alpha' ? 'A to Z' : 'Expiry'}
                  </button>
                ))}
              </div>

              {/* Identity Card Grid */}
              <AnimatePresence mode="popLayout">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sortedNames.map((item) => {
                    const recs = cardRecords.get(item.name) || {
                      avatar: '', bio: '', twitter: '', telegram: '', website: '', email: '',
                    };
                    return (
                      <IdentityCard
                        key={item.name}
                        name={item}
                        records={recs}
                        isPrimary={primaryName === item.name}
                        enableTilt={enableTilt}
                        onOpenDetail={openDetailModal}
                      />
                    );
                  })}
                </div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
      <Footer />

      {/* ── TRANSFER MODAL ── */}
      <AnimatePresence>
        {transferModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!transferring) {
                setTransferModal(null);
                setTransferSuccess(false);
              }
            }}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/10 via-[#00D179]/5 to-transparent" />
              <div className="relative p-6">
                {!transferSuccess ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-clash text-xl font-bold text-white">
                        Transfer {transferModal}<span className="text-[#00D179]">.qf</span>
                      </h3>
                      <button
                        onClick={() => setTransferModal(null)}
                        className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-xs text-gray-500">Recipient</label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        placeholder="5... (Substrate), 0x... (EVM), or name.qf"
                        className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-white text-base md:text-sm outline-none focus:border-[#00D179]/50 transition-colors duration-200 font-mono placeholder:text-gray-600"
                      />
                    </div>

                    <p className="text-xs text-[#F5A623] mb-4">
                      This action cannot be undone. The new owner will have full control of this name.
                    </p>

                    {transferError && (
                      <p className="text-xs text-[#E5484D] mb-3">{transferError}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          if (!address || !transferModal) return;
                          setTransferError(null);
                          setTransferring(true);

                          const nameToTransfer = transferModal;
                          let recipient = transferRecipient.trim();
                          try {
                            if (recipient.endsWith('.qf')) {
                              const resolved = await resolveForward(recipient);
                              if (!resolved) {
                                setTransferError('Name not found.');
                                setTransferring(false);
                                return;
                              }
                              recipient = resolved;
                            } else if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
                              // Valid EVM address — use as-is
                            } else if (/^5[a-zA-Z0-9]{47}$/.test(recipient) || /^[a-zA-Z0-9]{46,48}$/.test(recipient)) {
                              try {
                                recipient = ss58ToEvmAddress(recipient);
                              } catch {
                                setTransferError('Invalid Substrate address.');
                                setTransferring(false);
                                return;
                              }
                            } else {
                              setTransferError('Enter a .qf name, 0x address, or Substrate address.');
                              setTransferring(false);
                              return;
                            }

                            if (!signerAddress) throw new Error('No wallet connected');
                            const { confirmation } = await transferNameOnChain(nameToTransfer, recipient as `0x${string}`, signerAddress);

                            // Optimistic removal
                            setNames((prev) => prev.filter((item) => item.name !== nameToTransfer));
                            setTransferSuccess(true);
                            hapticSuccess();

                            confirmation.then((result) => {
                              if (result.confirmed) {
                                setTimeout(() => {
                                  refreshNames(address).catch(() => {});
                                  refreshName().catch(() => {});
                                }, 3000);
                                return;
                              }
                              if (result.error === 'not_confirmed') {
                                showToast(`Transfer submitted but unconfirmed. Check shortly.`, 'warning');
                                setTimeout(() => bgRefresh(), 5000);
                                return;
                              }
                              // Check if this is a retryable error
                              if (result.error && isRetryableError(result.error)) {
                                showToast(RETRY_MESSAGE_SHORT, 'warning');
                                hapticError();
                                bgRefresh(); // re-fetch real state
                                return;
                              }
                              // Hard failure — add name back
                              showToast(`Transfer failed: ${result.error}`, 'error');
                              hapticError();
                              bgRefresh(); // re-fetch real state
                            });
                          } catch (err: any) {
                            // Check if this is a retryable error
                            if (isRetryableError(err.message)) {
                              showToast(RETRY_MESSAGE_SHORT, 'warning');
                              hapticError();
                              return;
                            }
                            let userMessage = 'Transaction failed';
                            if (err.message) {
                              const message = err.message.toLowerCase();
                              if (message.includes('not connected') || message.includes('reconnect')) {
                                userMessage = 'Wallet connection lost. Please disconnect and reconnect.';
                              } else if (message.includes('switch metamask') || message.includes('qf network')) {
                                userMessage = 'Please switch MetaMask to QF Network and try again.';
                              } else if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
                                userMessage = 'Transaction rejected';
                              } else if (message.includes('unauthorized') || message.includes('not owner')) {
                                userMessage = 'You are not the owner of this name';
                              } else if (message.includes('insufficient') || message.includes('balance')) {
                                userMessage = 'Insufficient QF balance';
                              }
                            }
                            setTransferError(userMessage);
                            showToast(err.message || 'Transfer failed', 'error');
                            hapticError();
                          } finally {
                            setTransferring(false);
                          }
                        }}
                        disabled={transferring || !transferRecipient.trim()}
                        className="flex-1 py-3 bg-[#E5484D] hover:bg-[#c93d41] text-white font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {transferring && <Loader2 size={16} className="animate-spin" />}
                        {transferring ? 'Transferring...' : 'Transfer'}
                      </button>
                      <button
                        onClick={() => setTransferModal(null)}
                        disabled={transferring}
                        className="text-sm text-gray-500 hover:text-white transition-colors cursor-pointer px-4 py-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00D179]/20 flex items-center justify-center">
                      <Check size={32} className="text-[#00D179]" />
                    </div>
                    <h3 className="font-clash font-medium text-xl text-white mb-2">
                      {transferModal}<span className="text-[#00D179]">.qf</span> transferred!
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Successfully transferred to{' '}
                      {transferRecipient.length > 20
                        ? `${transferRecipient.slice(0, 8)}...${transferRecipient.slice(-6)}`
                        : transferRecipient}
                    </p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          const text = `Just transferred ${transferModal}.qf on @dotqfns powered by @theqfnetwork`;
                          const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                          window.open(url, '_blank');
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                      >
                        <Twitter size={18} />
                        Share on X
                      </button>
                      <button
                        onClick={() => {
                          setTransferModal(null);
                          setTransferSuccess(false);
                        }}
                        className="text-sm text-gray-500 hover:text-white transition-colors duration-200 py-2 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
