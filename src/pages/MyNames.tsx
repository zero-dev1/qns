import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Twitter,
  Loader2,
  Check,
  Copy,
  Star,
  X,
  Github,
  Globe,
  Send,
  Link2,
  FileText,
} from 'lucide-react';
import {
  renewName,
  transferNameOnChain,
  getTextRecord,
  setMultipleTextRecords,
  resolveForward,
  getNamesOwnedByAddress,
  setPrimaryName,
  resolveReverse,
} from '../utils/qns';
import { TEAM_NAMES } from '../utils/badges';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import { hapticSuccess, hapticError, hapticTap } from '../utils/haptics';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

const TEXT_KEYS = ['avatar', 'bio', 'twitter', 'github', 'url', 'telegram'] as const;

const FIELD_ICONS: Record<typeof TEXT_KEYS[number], React.ReactNode> = {
  avatar: <Link2 size={16} />,
  bio: <FileText size={16} />,
  twitter: <Twitter size={16} />,
  github: <Github size={16} />,
  url: <Globe size={16} />,
  telegram: <Send size={16} />,
};

const FIELD_LABELS: Record<typeof TEXT_KEYS[number], string> = {
  avatar: 'Avatar URL',
  bio: 'Bio',
  twitter: 'Twitter',
  github: 'Github',
  url: 'Website',
  telegram: 'Telegram',
};

const PLACEHOLDERS: Record<typeof TEXT_KEYS[number], string> = {
  avatar: 'https://example.com/avatar.png',
  bio: 'Tell the world about yourself',
  twitter: '@dotqfns or https://x.com/dotqfns',
  github: 'username or https://github.com/username',
  url: 'https://example.com',
  telegram: '@username or https://t.me/username',
};

// Inline SVG icons for action buttons
const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14L21 3" />
  </svg>
);

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const TransferIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Avatar component
const Avatar = ({ url, name, size = 40 }: { url?: string; name: string; size?: number }) => {
  const initial = name.charAt(0).toUpperCase();
  
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          // On error, show initial instead
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  
  return (
    <div
      className="rounded-full bg-[#2A2A2A] flex items-center justify-center text-white font-semibold text-sm"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
};

export default function MyNamesPage() {
  const { address, connect, refreshName } = useWalletStore();
  const { refreshNames } = useNamesStore();
  const { showToast } = useToast();
  const { copy } = useCopy();
  const [searchParams] = useSearchParams();
  const expandName = searchParams.get('expand');

  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [textRecords, setTextRecords] = useState<Record<string, Record<string, string>>>({});
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [renewingName, setRenewingName] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [primaryName, setPrimaryNameState] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [renewError, setRenewError] = useState<string | null>(null);

  // Edit modal state (replaces inline expansion)
  const [editModalName, setEditModalName] = useState<string | null>(null);
  const [isEditModalClosing, setIsEditModalClosing] = useState(false);

  // Share modal state
  const [shareModalName, setShareModalName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadNames = useCallback(async () => {
    if (!address) return;
    setLoading(true);
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
        
        // Fetch profile data for all names
        for (const item of mappedNames) {
          loadTextRecords(item.name);
        }
      } else {
        setNames([]);
      }
    } catch {
      setNames([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
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

  // Auto-open edit modal if URL param is set
  useEffect(() => {
    if (expandName && names.some((n) => n.name === expandName)) {
      openEditModal(expandName);
    }
  }, [expandName, names]);

  // Escape key to close edit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editModalName) {
        closeEditModal();
      }
    };

    if (editModalName) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [editModalName]);

  const loadTextRecords = async (name: string) => {
    const records: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      records[key] = await getTextRecord(name, key);
    }
    setTextRecords((prev) => ({ ...prev, [name]: records }));
    setEditValues((prev) => ({ ...prev, [name]: { ...records } }));
  };

  const openEditModal = (name: string) => {
    setEditModalName(name);
    setIsEditModalClosing(false);
    if (!textRecords[name]) {
      loadTextRecords(name);
    }
    hapticTap();
  };

  const closeEditModal = () => {
    setIsEditModalClosing(true);
    setTimeout(() => {
      setEditModalName(null);
      setIsEditModalClosing(false);
    }, 150);
    hapticTap();
  };

  const handleCancelEditing = () => {
    closeEditModal();
  };

  const handleSaveAll = async (name: string) => {
    if (!address) return;
    setSavingAll(true);
    hapticTap();
    
    try {
      // Collect all changed fields
      const keys: string[] = [];
      const values: string[] = [];
      
      for (const key of TEXT_KEYS) {
        const newValue = editValues[name]?.[key] ?? '';
        const oldValue = textRecords[name]?.[key] ?? '';
        
        if (newValue !== oldValue) {
          keys.push(key);
          values.push(newValue);
        }
      }
      
      // Call setMultipleTexts if there are changes
      if (keys.length > 0) {
        await setMultipleTextRecords(name, keys, values, address);
      }
      
      // Update saved text records
      setTextRecords((prev) => ({
        ...prev,
        [name]: { ...(editValues[name] || {}) },
      }));
      
      showToast('Profile updated successfully', 'success');
      hapticSuccess();
      closeEditModal();
    } catch (err: any) {
      console.error('Profile update failed:', err);
      showToast('Failed to save, please try again', 'error');
      hapticError();
    } finally {
      setSavingAll(false);
    }
  };

  const handleSetPrimary = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) return;
    setSettingPrimary(name);
    try {
      await setPrimaryName(name, address);
      setPrimaryNameState(name);
      await refreshName();
    } catch (err: any) {
      console.error('Set primary failed:', err);
    } finally {
      setSettingPrimary(null);
    }
  };

  const handleRenew = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) return;
    setRenewingName(name);
    setRenewError(null);
    try {
      await renewName(name, 1, address);
      await loadNames();
    } catch (err: any) {
      console.error('Renewal failed:', err);
      
      let userMessage = 'Transaction rejected';
      
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
          userMessage = 'Insufficient QF balance';
        } else if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        }
      }
      
      setRenewError(`Failed to renew ${name}: ${userMessage}`);
    } finally {
      setRenewingName(null);
    }
  };

  const handleShare = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://dotqf.xyz/name/${name}`;
    copy(url, false);
    hapticTap();
    showToast('Link copied to clipboard', 'success');
  };

  const handleTransferClick = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferModal(name);
    setTransferRecipient('');
    setTransferError(null);
  };

  const handleEditClick = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openEditModal(name);
  };

  const handleTransfer = async () => {
    if (!address || !transferModal) return;
    setTransferError(null);
    setTransferring(true);

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
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        setTransferError('Enter a valid .qf name or wallet address.');
        setTransferring(false);
        return;
      }

      await transferNameOnChain(transferModal, recipient as `0x${string}`, address);
      setTransferModal(null);
      setTransferRecipient('');
      await loadNames();
      // Refresh names in store so wallet dropdown reflects the transfer
      await refreshNames(address);
    } catch (err: any) {
      console.error('Transfer failed:', err);
      
      let userMessage = 'Transaction rejected';
      
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        } else if (message.includes('unauthorized') || message.includes('not owner')) {
          userMessage = 'You are not the owner of this name';
        }
      }
      
      setTransferError(userMessage);
    } finally {
      setTransferring(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareModalName) return;
    const url = `https://dotqf.xyz/name/${shareModalName}`;
    copy(url, false);
    hapticTap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    if (!shareModalName) return;
    const profileUrl = `https://dotqf.xyz/name/${shareModalName}`;
    const text = `Check out my .qf identity on @dotqfns`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
  };

  const isTeamMember = (name: string) => TEAM_NAMES.includes(name.toLowerCase());

  const getStatusDisplay = (item: OwnedName) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const thirtyDays = 30n * 24n * 60n * 60n;
    const isExpiringSoon = item.expires > 0n && item.expires - now < thirtyDays;
    const isTeam = isTeamMember(item.name);

    if (item.isPermanent) {
      return (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className="text-[#00D179]"><ShieldIcon /></span>
          <span className="text-[#00D179]">Permanent</span>
          {isTeam && (
            <>
              <span className="text-[#555555]">·</span>
              <span className="text-[#C9A74C]">Team</span>
            </>
          )}
        </div>
      );
    }

    if (isExpiringSoon) {
      const date = new Date(Number(item.expires) * 1000);
      const expiryText = `Expires ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      return (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className="text-[#F5A623]"><AlertIcon /></span>
          <span className="text-white">{expiryText}</span>
          {isTeam && (
            <>
              <span className="text-[#555555]">·</span>
              <span className="text-[#C9A74C]">Team</span>
            </>
          )}
        </div>
      );
    }

    const date = new Date(Number(item.expires) * 1000);
    const expiryText = `Expires ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    return (
      <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
        <span className="text-[#00D179]"><ClockIcon /></span>
        <span className="text-white">{expiryText}</span>
        {isTeam && (
          <>
            <span className="text-[#555555]">·</span>
            <span className="text-[#C9A74C]">Team</span>
          </>
        )}
      </div>
    );
  };

  const getSelectedNameData = (): OwnedName | undefined => {
    return names.find((n) => n.name === editModalName);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#1E1E1E]">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-clash font-semibold text-xl text-white tracking-tight hover:opacity-80 transition-opacity"
          >
            QNS<span className="text-[#00D179]">.</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-6">
        <div className="max-w-[1120px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-2">
                MY NAMES
              </p>
              <h1 className="font-clash font-semibold text-3xl text-white">
                Your <span className="text-[#00D179]">.qf</span> names
              </h1>
            </div>
          </div>

          {!address && (
            <div className="text-center py-20 animate-fade-in">
              <p className="text-[#8A8A8A] mb-6 font-satoshi text-lg">
                Connect your wallet to manage your names
              </p>
              <button
                onClick={connect}
                className="px-8 py-3 rounded-xl border border-[#00D179] text-white font-medium hover:bg-[#00D17915] transition-all duration-200 cursor-pointer"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {address && loading && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 text-[#00D179] animate-spin mx-auto" />
            </div>
          )}

          {address && !loading && names.length === 0 && (
            <div className="text-center py-20 animate-fade-in">
              <p className="text-[#8A8A8A] mb-6 font-satoshi text-lg">
                You don't have any <span className="text-[#00D179]">.qf</span> names yet
              </p>
              <Link
                to="/"
                className="px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-bold transition-colors duration-200 inline-block"
              >
                Register your first name
              </Link>
            </div>
          )}

          {address && !loading && names.length > 0 && (
            <>
              {renewError && (
                <div className="mb-4 p-4 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-xl text-[#E5484D]">
                  {renewError}
                </div>
              )}
              {/* Grid layout: 2 columns on desktop, 1 on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {names.map((item, index) => {
                  const bio = textRecords[item.name]?.bio ?? '';
                  const avatarUrl = textRecords[item.name]?.avatar ?? '';
                  
                  return (
                    <div
                      key={item.name}
                      onClick={() => openEditModal(item.name)}
                      className="bg-[#141414] rounded-[12px] p-5 border border-[#2A2A2A] cursor-pointer hover:border-[#00D179] active:border-[#00FF88] active:opacity-95 md:hover:border-[#00D179] transition-all duration-150 ease-out opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                    >
                      {/* Collapsed Card Layout - now the only layout */}
                      <div className="flex flex-col gap-3">
                        {/* Top row: Avatar + Name/Status */}
                        <div className="flex items-start gap-3">
                          <Avatar url={avatarUrl} name={item.name} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-satoshi font-bold text-lg text-white truncate">
                                {item.name}<span className="text-[#00D179]">.qf</span>
                              </h3>
                              {primaryName === item.name && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#00D179] bg-[#00D17915] px-1.5 py-0.5 rounded-full shrink-0">
                                  <Star size={8} fill="currentColor" />
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              {getStatusDisplay(item)}
                            </div>
                          </div>
                        </div>

                        {/* Bio line */}
                        <p className="text-sm text-[#8A8A8A] truncate">
                          {bio || <span className="text-[#555555] italic">No bio set</span>}
                        </p>

                        {/* Action buttons row */}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          {/* Primary - only show if not primary, amber color */}
                          {primaryName !== item.name && (
                            <button
                              onClick={(e) => handleSetPrimary(item.name, e)}
                              disabled={settingPrimary === item.name}
                              className="flex flex-col items-center gap-1 group cursor-pointer disabled:opacity-50"
                            >
                              <div className="w-9 h-9 rounded-full border border-[#C9A74C] text-[#C9A74C] flex items-center justify-center transition-all duration-200 group-hover:bg-[#C9A74C15]">
                                {settingPrimary === item.name ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <StarIcon />
                                )}
                              </div>
                              <span className="text-[10px] text-[#8A8A8A]">Primary</span>
                            </button>
                          )}

                          {/* Renew - emerald color, only for non-permanent */}
                          {!item.isPermanent && (
                            <button
                              onClick={(e) => handleRenew(item.name, e)}
                              disabled={renewingName === item.name}
                              className="flex flex-col items-center gap-1 group cursor-pointer disabled:opacity-50"
                            >
                              <div className="w-9 h-9 rounded-full border border-[#00D179] text-[#00D179] flex items-center justify-center transition-all duration-200 group-hover:bg-[#00D17915]">
                                {renewingName === item.name ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <RefreshIcon />
                                )}
                              </div>
                              <span className="text-[10px] text-[#8A8A8A]">Renew</span>
                            </button>
                          )}

                          {/* Share - default style */}
                          <button
                            onClick={(e) => handleShare(item.name, e)}
                            className="flex flex-col items-center gap-1 group cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-full border border-[#2A2A2A] text-[#8A8A8A] flex items-center justify-center transition-all duration-200 group-hover:border-[#00D179] group-hover:text-white">
                              <ShareIcon />
                            </div>
                            <span className="text-[10px] text-[#8A8A8A]">Share</span>
                          </button>

                          {/* Edit - emerald style, opens modal */}
                          <button
                            onClick={(e) => handleEditClick(item.name, e)}
                            className="flex flex-col items-center gap-1 group cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-full border border-[#00D179] text-[#00D179] flex items-center justify-center transition-all duration-200 group-hover:bg-[#00D17915]">
                              <PencilIcon />
                            </div>
                            <span className="text-[10px] text-[#8A8A8A]">Edit</span>
                          </button>

                          {/* Transfer - default style */}
                          <button
                            onClick={(e) => handleTransferClick(item.name, e)}
                            className="flex flex-col items-center gap-1 group cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-full border border-[#2A2A2A] text-[#8A8A8A] flex items-center justify-center transition-all duration-200 group-hover:border-[#00D179] group-hover:text-white">
                              <TransferIcon />
                            </div>
                            <span className="text-[10px] text-[#8A8A8A]">Transfer</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Edit Profile Modal */}
      {editModalName && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${isEditModalClosing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={closeEditModal}
        >
          <div
            className={`bg-[#111111] rounded-[16px] p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto mx-4 ${isEditModalClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with X button */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <Avatar 
                  url={textRecords[editModalName]?.avatar ?? ''} 
                  name={editModalName} 
                  size={48} 
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-satoshi font-bold text-xl text-white">
                      {editModalName}<span className="text-[#00D179]">.qf</span>
                    </h3>
                    {primaryName === editModalName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#00D179] bg-[#00D17915] px-1.5 py-0.5 rounded-full shrink-0">
                        <Star size={8} fill="currentColor" />
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    {getSelectedNameData() && getStatusDisplay(getSelectedNameData()!)}
                  </div>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-[#1E1E1E] transition-all duration-200 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-3 mb-6">
              {/* Primary - only show if not primary, amber color */}
              {primaryName !== editModalName && (
                <button
                  onClick={(e) => handleSetPrimary(editModalName, e)}
                  disabled={settingPrimary === editModalName}
                  className="flex flex-col items-center gap-1 group cursor-pointer disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full border border-[#C9A74C] text-[#C9A74C] flex items-center justify-center transition-all duration-200 group-hover:bg-[#C9A74C15]">
                    {settingPrimary === editModalName ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <StarIcon />
                    )}
                  </div>
                  <span className="text-[10px] text-[#8A8A8A]">Primary</span>
                </button>
              )}

              {/* Renew - emerald color, only for non-permanent */}
              {getSelectedNameData() && !getSelectedNameData()!.isPermanent && (
                <button
                  onClick={(e) => handleRenew(editModalName, e)}
                  disabled={renewingName === editModalName}
                  className="flex flex-col items-center gap-1 group cursor-pointer disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full border border-[#00D179] text-[#00D179] flex items-center justify-center transition-all duration-200 group-hover:bg-[#00D17915]">
                    {renewingName === editModalName ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshIcon />
                    )}
                  </div>
                  <span className="text-[10px] text-[#8A8A8A]">Renew</span>
                </button>
              )}

              {/* Share - default style */}
              <button
                onClick={(e) => handleShare(editModalName, e)}
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full border border-[#2A2A2A] text-[#8A8A8A] flex items-center justify-center transition-all duration-200 group-hover:border-[#00D179] group-hover:text-white">
                  <ShareIcon />
                </div>
                <span className="text-[10px] text-[#8A8A8A]">Share</span>
              </button>

              {/* Edit - emerald active style */}
              <button
                className="flex flex-col items-center gap-1 cursor-default"
              >
                <div className="w-9 h-9 rounded-full border border-[#00D179] bg-[#00D17915] text-[#00D179] flex items-center justify-center">
                  <PencilIcon />
                </div>
                <span className="text-[10px] text-[#8A8A8A]">Edit</span>
              </button>

              {/* Transfer - default style */}
              <button
                onClick={(e) => handleTransferClick(editModalName, e)}
                className="flex flex-col items-center gap-1 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full border border-[#2A2A2A] text-[#8A8A8A] flex items-center justify-center transition-all duration-200 group-hover:border-[#00D179] group-hover:text-white">
                  <TransferIcon />
                </div>
                <span className="text-[10px] text-[#8A8A8A]">Transfer</span>
              </button>
            </div>

            {/* Profile Edit Fields */}
            <div className="border-t border-[#1E1E1E] pt-6">
              <div className="space-y-4">
                {TEXT_KEYS.map((key) => (
                  <div key={key} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-[#8A8A8A]">
                      <span>{FIELD_ICONS[key]}</span>
                      <span className="capitalize">{FIELD_LABELS[key]}</span>
                    </label>
                    <input
                      type="text"
                      value={editValues[editModalName]?.[key] ?? ''}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [editModalName]: {
                            ...prev[editModalName],
                            [key]: e.target.value,
                          },
                        }))
                      }
                      placeholder={PLACEHOLDERS[key]}
                      className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#00D179] transition-colors duration-200 placeholder:text-[#555555]"
                    />
                  </div>
                ))}
              </div>

              {/* Cancel and Save All buttons */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleCancelEditing}
                  disabled={savingAll}
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-[#555555] text-[#8A8A8A] hover:text-white hover:border-[#8A8A8A] transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveAll(editModalName)}
                  disabled={savingAll}
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingAll ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save All'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl p-6 max-w-md w-full transition-all duration-150 ease-in-out animate-fade-in">
            <h3 className="font-clash font-medium text-xl text-white mb-1">
              Transfer {transferModal}<span className="text-[#00D179]">.qf</span>
            </h3>
            <p className="text-sm text-[#8A8A8A] mb-4">Transfer to another wallet</p>

            <input
              type="text"
              value={transferRecipient}
              onChange={(e) => setTransferRecipient(e.target.value)}
              placeholder="0x... or name.qf"
              className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-[#00D179] transition-colors duration-200 font-mono mb-3"
            />

            <p className="text-xs text-[#F5A623] mb-4">
              This action cannot be undone. The new owner will have full control of this name.
            </p>

            {transferError && <p className="text-xs text-[#E5484D] mb-3">{transferError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleTransfer}
                disabled={transferring || !transferRecipient.trim()}
                className="flex-1 py-2.5 bg-[#E5484D] hover:bg-[#c93d41] text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {transferring ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                onClick={() => setTransferModal(null)}
                className="text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6 max-w-sm w-full animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-clash font-medium text-xl text-white">
                {shareModalName}<span className="text-[#00D179]">.qf</span>
              </h3>
              <button
                onClick={() => setShareModalName(null)}
                className="p-2 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-[#1E1E1E] transition-all duration-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-colors duration-200 cursor-pointer"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleShareX}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1E1E1E] text-white hover:bg-[#1E1E1E] transition-colors duration-200 cursor-pointer"
              >
                <Twitter size={18} />
                Share on X
              </button>
            </div>
          </div>
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
        
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-modal-in {
          animation: modal-in 0.2s ease-out forwards;
        }
        
        @keyframes modal-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        
        .animate-modal-out {
          animation: modal-out 0.15s ease-in forwards;
        }
        
        @keyframes modal-backdrop-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-modal-backdrop-in {
          animation: modal-backdrop-in 0.2s ease-out forwards;
        }
        
        @keyframes modal-backdrop-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        
        .animate-modal-backdrop-out {
          animation: modal-backdrop-out 0.15s ease-in forwards;
        }
      `}</style>
    </div>
  );
}
