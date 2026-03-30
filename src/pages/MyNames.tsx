import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Wallet, Copy, Check } from 'lucide-react';
import {
  transferNameOnChain,
  getTextRecord,
  resolveForward,
  getNamesOwnedByAddress,
  setPrimaryName,
  resolveReverse,
  getContractPrices,
  calculatePrice,
} from '../utils/qns';
import { ss58ToEvmAddress } from '../utils/address';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import { hapticSuccess, hapticError, hapticTap } from '../utils/haptics';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../utils/errorHelpers';
import Avatar from '../components/Avatar';
import IdentityCard from '../components/IdentityCard';
import DetailModal from '../components/DetailModal';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

const TEXT_KEYS = ['avatar', 'bio', 'twitter', 'telegram', 'website'] as const;






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
  const [primaryName, setPrimaryNameState] = useState<string | null>(null);
  const [enableTilt, setEnableTilt] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const { copy: copyAddress, copied: addressCopied } = useCopy();
  const [namePrices, setNamePrices] = useState<{
    price3Char: bigint; price4Char: bigint; price5PlusChar: bigint; permanentMultiplier: bigint;
  } | null>(null);
  
  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'edit' | 'manage' | 'share'>('overview');

  useEffect(() => {
    getContractPrices().then(setNamePrices).catch(() => {
      // Use defaults from the module
      import('../utils/qns').then(({ DEFAULT_PRICES }) => setNamePrices(DEFAULT_PRICES));
    });
  }, []);

  // Helper function to calculate renewal price per year based on contract prices
  const getRenewalPricePerYear = (nameStr: string): number => {
    if (!namePrices) {
      // Fallback: use DEFAULT_PRICES logic
      const len = nameStr.length;
      if (len === 3) return 1000;
      if (len === 4) return 300;
      return 100;
    }
    const annual = calculatePrice(nameStr.length, 1, false, namePrices);
    return Number(annual) / 1e18;
  };


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

  // Auto-expand to DetailModal
  useEffect(() => {
    if (expandName && !hasAutoExpanded.current && names.some((n) => n.name === expandName)) {
      hasAutoExpanded.current = true;
      openDetailModal(expandName);
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

  // Fetch wallet balance
  useEffect(() => {
    async function fetchBalance() {
      if (!address) return;
      try {
        // Use existing balance utility from qns utils
        const { getQFBalance } = await import('../utils/qns');
        const bal = await getQFBalance(address);
        setWalletBalance(Number(bal) / 1e18); // Convert from wei to QF tokens
      } catch {
        setWalletBalance(0);
      }
    }
    fetchBalance();
  }, [address]);

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

  
  const loadTextRecords = async (name: string) => {
    const records: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      records[key] = await getTextRecord(name, key);
    }
    setTextRecords((prev) => ({ ...prev, [name]: records }));
  };




  // Detail modal handlers
  const openDetailModal = (name: string, tab?: 'overview' | 'edit' | 'manage' | 'share') => {
    setSelectedName(name);
    setDetailInitialTab(tab || 'overview');
    setDetailModalOpen(true);
    if (!textRecords[name]) {
      loadTextRecords(name);
    }
    hapticTap();
  };

  
  // Detail modal adapter handlers
  const handleSaveRecords = async (name: string, records: Record<string, string>) => {
    if (!address) return;
    
    try {
      const keys: string[] = [];
      const values: string[] = [];
      
      for (const [key, value] of Object.entries(records)) {
        const oldValue = textRecords[name]?.[key] ?? '';
        if (value !== oldValue) {
          keys.push(key);
          values.push(value || '');
        }
      }
      
      if (keys.length > 0) {
        if (!signerAddress) throw new Error('No wallet connected');
        // Direct implementation since handleSaveAll was removed
        const { setMultipleTextRecords } = await import('../utils/qns');
        const { confirmation } = await setMultipleTextRecords(name, keys, values, signerAddress);

        // Optimistic update
        setTextRecords((prev: any) => ({ ...prev, [name]: { ...prev[name], ...records } }));
        hapticTap();

        confirmation.then((result) => {
          if (result.confirmed) return;
          if (result.error === 'not_confirmed') {
            showToast('Profile update submitted but unconfirmed.', 'warning');
            return;
          }
          if (result.error && isRetryableError(result.error)) {
            showToast(RETRY_MESSAGE_SHORT, 'warning');
            loadTextRecords(name);
            hapticError();
            return;
          }
          showToast(`Profile update failed: ${result.error}. Reverting changes.`, 'error');
          loadTextRecords(name);
          hapticError();
        });
      }
    } catch (err: any) {
      if (isRetryableError(err.message)) {
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        hapticError();
        return;
      }
      showToast('Failed to save, please try again', 'error');
      hapticError();
    }
  };

  // QDL: New handlers that match updated DetailModal interface
  const handleSaveRecordsFromModal = async (records: Record<string, string>) => {
    if (!selectedName) return;
    return handleSaveRecords(selectedName, records);
  };

  const handleSetPrimaryFromModalNew = async () => {
    if (!selectedName) return;
    return handleSetPrimaryFromModal(selectedName);
  };

  const handleRenewFromModal = async (years: number) => {
    if (!selectedName) return;
    return handleRenew(selectedName, years);
  };

  const handleTransferFromModalNew = async (to: string) => {
    if (!selectedName) return;
    return handleTransferFromModal(selectedName, to);
  };

  const handleSetPrimaryFromModal = async (name: string) => {
    if (!address) return;
    try {
      if (!signerAddress) throw new Error('No wallet connected');
      const { confirmation } = await setPrimaryName(name, address, signerAddress);

      setPrimaryNameState(name);
      useWalletStore.setState({ qnsName: name, displayName: name });
      hapticSuccess();

      confirmation.then((result) => {
        if (result.confirmed) {
          setTimeout(() => {
            refreshName().catch(() => {}).finally(() => {
              const current = useWalletStore.getState().qnsName;
              if (current !== name) {
                useWalletStore.setState({ qnsName: name, displayName: name });
              }
            });
          }, 5000);
          return;
        }
        if (result.error === 'not_confirmed') {
          showToast('Primary name update submitted but unconfirmed.', 'warning');
          setTimeout(() => refreshName().catch(() => {}), 5000);
          return;
        }
        if (result.error && isRetryableError(result.error)) {
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          refreshName().catch(() => {});
          resolveReverse(address).then(setPrimaryNameState).catch(() => {});
          hapticError();
          return;
        }
        showToast(`Failed to set primary: ${result.error}`, 'error');
        refreshName().catch(() => {});
        resolveReverse(address).then(setPrimaryNameState).catch(() => {});
        hapticError();
      });
    } catch (err: any) {
      if (isRetryableError(err.message)) {
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        hapticError();
        return;
      }
      showToast(err.message || 'Failed to set primary name', 'error');
      hapticError();
    }
  };

  const handleRenew = async (name: string, years: number) => {
    if (!address) return;
    
    try {
      if (!signerAddress) throw new Error('No wallet connected');
      const { renewName } = await import('../utils/qns');
      const { confirmation } = await renewName(name, years, signerAddress);

      // Optimistic update
      setNames((prev) =>
        prev.map((item) => {
          if (item.name !== name || item.isPermanent) return item;
          return { ...item, expires: item.expires + BigInt(years) * 365n * 24n * 60n * 60n };
        })
      );
      hapticSuccess();

      confirmation.then((result) => {
        if (result.confirmed) {
          setTimeout(() => bgRefresh(), 3000);
          return;
        }
        if (result.error === 'not_confirmed') {
          showToast(`Renewal of ${name}.qf submitted but unconfirmed. Please check shortly.`, 'warning');
          setTimeout(() => bgRefresh(), 5000);
          return;
        }
        if (result.error && isRetryableError(result.error)) {
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          hapticError();
          bgRefresh();
          return;
        }
        showToast(`Renewal of ${name}.qf failed: ${result.error}`, 'error');
        hapticError();
        bgRefresh();
      });
    } catch (err: any) {
      if (isRetryableError(err.message)) {
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        hapticError();
        return;
      }
      showToast(err.message || `Failed to renew ${name}`, 'error');
      hapticError();
    }
  };

  const handleTransferFromModal = async (name: string, toAddress: string) => {
    if (!address) return;
    let recipient = toAddress.trim();

    if (recipient.endsWith('.qf')) {
      const resolved = await resolveForward(recipient);
      if (!resolved) { showToast('Name not found', 'error'); return; }
      recipient = resolved;
    } else if (/^5[a-zA-Z0-9]{47}$/.test(recipient) || /^[a-zA-Z0-9]{46,48}$/.test(recipient)) {
      try { recipient = ss58ToEvmAddress(recipient); }
      catch { showToast('Invalid Substrate address', 'error'); return; }
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      showToast('Enter a .qf name, 0x address, or Substrate address', 'error');
      return;
    }

    if (!signerAddress) throw new Error('No wallet connected');
    const { confirmation } = await transferNameOnChain(name, recipient as `0x${string}`, signerAddress);

    setNames((prev) => prev.filter((item) => item.name !== name));
    hapticSuccess();

    confirmation.then((result) => {
      if (result.confirmed) {
        setTimeout(() => { refreshNames(address).catch(() => {}); refreshName().catch(() => {}); }, 3000);
        return;
      }
      if (result.error && isRetryableError(result.error)) {
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        bgRefresh();
        return;
      }
      if (result.error) {
        showToast(`Transfer failed: ${result.error}`, 'error');
        bgRefresh();
      }
    });
  };

  // Sort functionality
  const [sortMode, setSortMode] = useState<'primary' | 'alpha' | 'expiry'>('primary');

  const sortedNames = [...names].sort((a, b) => {
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
        website: textRecords[name.name]?.website || '',
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
  {/* Desktop layout */}
  <div className="hidden sm:flex items-center gap-0">
    {/* Address — copyable */}
    <button
      onClick={() => copyAddress(address || '', false)}
      className="group flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors pr-5"
    >
      <Wallet size={14} />
      <span className="font-mono">
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
      </span>
      {addressCopied ? (
        <Check size={12} className="text-[#00D179]" />
      ) : (
        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>

    {/* Divider */}
    <div className="w-px h-8 bg-white/[0.06]" />

    {/* Name count */}
    <div className="px-5">
      <span className="text-lg font-semibold text-white">{names.length}</span>
      <span className="text-xs text-[#555] ml-1.5">name{names.length !== 1 ? 's' : ''}</span>
    </div>

    {/* Divider */}
    <div className="w-px h-8 bg-white/[0.06]" />

    {/* Primary identity */}
    {primaryName && (
      <>
        <a
          href={`/name/${primaryName}`}
          className="flex items-center gap-2 text-xs text-[#00D179] hover:text-[#00B868] transition-colors px-5"
        >
          <Avatar
            url={cardRecords.get(primaryName)?.avatar}
            name={primaryName}
            size={20}
          />
          <span className="font-medium">{primaryName}.qf</span>
        </a>
        <div className="w-px h-8 bg-white/[0.06]" />
      </>
    )}

    {/* Renewal intelligence */}
    <div className="ml-auto pl-5 text-xs">
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
          <span className={daysUntil <= 30 ? 'text-red-400' : daysUntil <= 90 ? 'text-amber-400' : 'text-[#555]'}>
            Next renewal: {formatted}
          </span>
        );
      })()}
    </div>
  </div>

  {/* Mobile layout — stacked */}
  <div className="sm:hidden space-y-3">
    <div className="flex items-center justify-between">
      <button
        onClick={() => copyAddress(address || '', false)}
        className="flex items-center gap-2 text-xs text-[#555]"
      >
        <Wallet size={14} />
        <span className="font-mono">
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
        </span>
        {addressCopied && <Check size={12} className="text-[#00D179]" />}
      </button>
      <div className="text-right">
        <span className="text-lg font-semibold text-white">{names.length}</span>
        <span className="text-xs text-[#555] ml-1">name{names.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-white/[0.04] pt-3">
      {primaryName ? (
        <a
          href={`/name/${primaryName}`}
          className="flex items-center gap-2 text-xs text-[#00D179]"
        >
          <Avatar
            url={cardRecords.get(primaryName)?.avatar}
            name={primaryName}
            size={18}
          />
          <span className="font-medium">{primaryName}.qf</span>
        </a>
      ) : (
        <span className="text-xs text-[#333]">No primary set</span>
      )}
      <div className="text-xs">
        {(() => {
          const annualNames = names.filter((n) => !n.isPermanent && n.expires > 0n);
          if (annualNames.length === 0) return <span className="text-[#00D179]">All permanent</span>;
          const earliest = annualNames.reduce((a, b) => a.expires < b.expires ? a : b);
          const expiryDate = new Date(Number(earliest.expires) * 1000);
          const daysUntil = Math.floor((expiryDate.getTime() - Date.now()) / 86400000);
          const formatted = expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <span className={daysUntil <= 30 ? 'text-red-400' : daysUntil <= 90 ? 'text-amber-400' : 'text-[#555]'}>
              Renew: {formatted}
            </span>
          );
        })()}
      </div>
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

      {/* ── DETAIL MODAL ── */}
      <AnimatePresence>
        {detailModalOpen && selectedName && (
          <DetailModal
            isOpen={detailModalOpen}
            onClose={() => { setDetailModalOpen(false); setSelectedName(null); }}
            name={selectedName}
            initialTab={detailInitialTab}
            expires={Number(names.find((n) => n.name === selectedName)?.expires || 0)}
            isPermanent={names.find((n) => n.name === selectedName)?.isPermanent || false}
            registeredAt={Number(names.find((n) => n.name === selectedName)?.registeredAt || 0)}
            avatar={textRecords[selectedName]?.avatar}
            bio={textRecords[selectedName]?.bio}
            twitter={textRecords[selectedName]?.twitter}
            telegram={textRecords[selectedName]?.telegram}
            website={textRecords[selectedName]?.website}
            email={textRecords[selectedName]?.email}
            isPrimary={primaryName === selectedName}
            providerType={providerType}
            address={address || ''}
            balance={walletBalance}
            renewalPricePerYear={getRenewalPricePerYear(selectedName)}
            onSaveRecords={handleSaveRecordsFromModal}
            onSetPrimary={handleSetPrimaryFromModalNew}
            onRenew={handleRenewFromModal}
            onTransfer={handleTransferFromModalNew}
          />
        )}
      </AnimatePresence>
    </>
  );
}
