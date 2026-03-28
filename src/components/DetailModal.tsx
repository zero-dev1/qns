import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Star, 
  RefreshCw, 
  Share2, 
  Pencil, 
  ArrowRight, 
  Copy, 
  Twitter, 
  Send, 
  Globe, 
  FileText, 
  Loader2, 
  Check, 
  Shield,
  Clock
} from 'lucide-react';
import Avatar from './Avatar';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import { hapticTap, hapticSuccess, hapticError } from '../utils/haptics';
import { TEAM_NAMES, DAPP_LAB_NAMES } from '../utils/badges';

const FIELD_ICONS = {
  avatar: <Globe size={16} />,
  bio: <FileText size={16} />,
  twitter: <Twitter size={16} />,
  telegram: <Send size={16} />,
  website: <Globe size={16} />,
  email: <Send size={16} />,
};

const FIELD_LABELS = {
  avatar: 'Avatar URL',
  bio: 'Bio',
  twitter: 'Twitter',
  telegram: 'Telegram',
  website: 'Website',
  email: 'Email',
};

const PLACEHOLDERS = {
  avatar: 'https://example.com/avatar.png',
  bio: 'Tell the world about yourself',
  twitter: '@username or https://x.com/username',
  telegram: '@username or https://t.me/username',
  website: 'https://example.com',
  email: 'contact@example.com',
};

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

interface DetailModalProps {
  isOpen: boolean;
  name: string;
  defaultTab?: 'overview' | 'edit' | 'manage' | 'share';
  onClose: () => void;
  ownedName: {
    name: string;
    expires: bigint;
    isPermanent: boolean;
    registeredAt: bigint;
  };
  records: {
    avatar: string;
    bio: string;
    twitter: string;
    telegram: string;
    website: string;
    email: string;
  };
  isPrimary: boolean;
  onSaveRecords: (name: string, records: Partial<{
    avatar: string;
    bio: string;
    twitter: string;
    telegram: string;
    website: string;
    email: string;
  }>) => Promise<void>;
  onSetPrimary: (name: string) => Promise<void>;
  onRenew: (name: string, years: number) => Promise<void>;
  onTransfer: (name: string, recipient: string) => Promise<void>;
}

export default function DetailModal({
  isOpen,
  name,
  defaultTab = 'overview',
  onClose,
  ownedName,
  records,
  isPrimary,
  onSaveRecords,
  onSetPrimary,
  onRenew,
  onTransfer,
}: DetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'manage' | 'share'>(defaultTab);
  const [editValues, setEditValues] = useState(records);
  const [saving, setSaving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferError, setTransferError] = useState('');
  const [copied, setCopied] = useState(false);
  const { copy } = useCopy();
  const { showToast } = useToast();

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setEditValues(records);
      setTransferRecipient('');
      setTransferError('');
    }
  }, [isOpen, defaultTab, records]);

  // Update editValues when records change
  useEffect(() => {
    setEditValues(records);
  }, [records]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveRecords(name, editValues);
      showToast('Profile updated successfully', 'success');
      hapticSuccess();
    } catch (error: any) {
      showToast(error.message || 'Failed to save', 'error');
      hapticError();
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    if (isPrimary) return;
    setSettingPrimary(true);
    try {
      await onSetPrimary(name);
      showToast('Primary name updated', 'success');
      hapticSuccess();
    } catch (error: any) {
      showToast(error.message || 'Failed to set primary', 'error');
      hapticError();
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleRenew = async (years: number) => {
    setRenewing(true);
    try {
      await onRenew(name, years);
      showToast(`Name renewed for ${years} year${years > 1 ? 's' : ''}`, 'success');
      hapticSuccess();
    } catch (error: any) {
      showToast(error.message || 'Failed to renew', 'error');
      hapticError();
    } finally {
      setRenewing(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferRecipient.trim()) {
      setTransferError('Please enter a recipient address');
      return;
    }
    setTransferring(true);
    setTransferError('');
    try {
      await onTransfer(name, transferRecipient.trim());
      showToast('Name transferred successfully', 'success');
      hapticSuccess();
      onClose();
    } catch (error: any) {
      setTransferError(error.message || 'Failed to transfer');
      hapticError();
    } finally {
      setTransferring(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `https://dotqf.xyz/name/${name}`;
    await copy(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    hapticTap();
  };

  const handleShareOnX = () => {
    const text = `Check out my .qf identity on @dotqfns`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://dotqf.xyz/name/${name}`)}`;
    window.open(url, '_blank');
  };

  const hasChanges = JSON.stringify(editValues) !== JSON.stringify(records);

  // Status calculations
  const now = BigInt(Math.floor(Date.now() / 1000));
  const thirtyDays = 30n * 24n * 60n * 60n;
  const isExpiringSoon = !ownedName.isPermanent && ownedName.expires > 0n && (ownedName.expires - now) < thirtyDays;
  
  const isTeam = TEAM_NAMES.includes(name.toLowerCase());
  const isDappLab = DAPP_LAB_NAMES.includes(name.toLowerCase());

  const expiryText = !ownedName.isPermanent && ownedName.expires > 0n
    ? new Date(Number(ownedName.expires) * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      variants={modalBackdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
    >
      <motion.div
        className="relative mx-4 max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[24px] border border-white/10 bg-[#111111] shadow-2xl shadow-[#00D179]/10"
        variants={modalContentVariants}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent" />
        <div className="relative px-6 pb-6 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
          
          {/* Modal Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full border border-white/10 bg-[#0A0A0A] p-1 shadow-lg shadow-black/20">
                <Avatar url={records.avatar} name={name} size={56} />
              </div>
              <div className="pt-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="min-w-0 truncate font-clash text-xl md:text-2xl font-bold text-white whitespace-nowrap">
                    <span className="whitespace-nowrap">
                      {name}<span className="text-[#00D179]">.qf</span>
                    </span>
                    {isPrimary && <span className="primary-dot ml-2" />}
                  </h3>
                  {isPrimary && (
                    <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-[#00D179]/20 bg-[#00D179]/10 px-2 py-1 text-[10px] font-medium text-[#00D179]">
                      <Star size={8} fill="currentColor" />
                      <span className="whitespace-nowrap">Primary</span>
                    </span>
                  )}
                  {ownedName.isPermanent && (
                    <span className="hidden sm:inline-flex flex-shrink-0 rounded-full border border-[#00D179]/20 bg-[#00D179]/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8DF0BA] whitespace-nowrap">
                      Permanent
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  {ownedName.isPermanent ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#00D179]">
                      <Shield size={12} />
                      <span>This name is permanently registered. No renewal needed.</span>
                    </div>
                  ) : expiryText ? (
                    <div className={`flex items-center gap-1.5 text-xs ${isExpiringSoon ? 'text-red-400' : 'text-gray-500'}`}>
                      <Clock size={12} />
                      <span>Expires {expiryText}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#8A8A8A] transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 flex items-center gap-1 rounded-xl border border-white/5 bg-[#0C0C0C] p-1">
            {[
              { id: 'overview', label: 'Overview', icon: <Star size={16} /> },
              { id: 'edit', label: 'Edit', icon: <Pencil size={16} /> },
              { id: 'manage', label: 'Manage', icon: <RefreshCw size={16} /> },
              { id: 'share', label: 'Share', icon: <Share2 size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#00D179]/10 text-[#00D179]'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {ownedName.isPermanent && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
                      <Shield size={12} /> Permanent
                    </span>
                  )}
                  {isTeam && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
                      <Shield size={12} /> Team
                    </span>
                  )}
                  {isDappLab && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
                      <Shield size={12} /> dApp Lab
                    </span>
                  )}
                </div>

                {/* Profile Info */}
                <div className="space-y-4">
                  {records.bio && (
                    <div>
                      <h4 className="text-xs font-medium text-[#333] mb-2">Bio</h4>
                      <p className="text-sm text-gray-300">{records.bio}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {records.twitter && (
                      <div>
                        <h4 className="text-xs font-medium text-[#333] mb-1">Twitter</h4>
                        <p className="text-sm text-gray-300">{records.twitter}</p>
                      </div>
                    )}
                    {records.telegram && (
                      <div>
                        <h4 className="text-xs font-medium text-[#333] mb-1">Telegram</h4>
                        <p className="text-sm text-gray-300">{records.telegram}</p>
                      </div>
                    )}
                    {records.website && (
                      <div>
                        <h4 className="text-xs font-medium text-[#333] mb-1">Website</h4>
                        <p className="text-sm text-gray-300">{records.website}</p>
                      </div>
                    )}
                    {records.email && (
                      <div>
                        <h4 className="text-xs font-medium text-[#333] mb-1">Email</h4>
                        <p className="text-sm text-gray-300">{records.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                  <div className="flex items-start justify-between gap-2">
                    {!isPrimary && (
                      <button
                        onClick={handleSetPrimary}
                        disabled={settingPrimary}
                        className="group flex flex-1 flex-col items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                          {settingPrimary ? (
                            <Loader2 size={22} className="animate-spin text-[#00D179]" />
                          ) : (
                            <Star size={22} />
                          )}
                        </div>
                        <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Primary</span>
                      </button>
                    )}

                    {!ownedName.isPermanent && (
                      <button
                        onClick={() => handleRenew(1)}
                        disabled={renewing}
                        className="group flex flex-1 flex-col items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                          {renewing ? (
                            <Loader2 size={22} className="animate-spin text-[#00D179]" />
                          ) : (
                            <RefreshCw size={22} />
                          )}
                        </div>
                        <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Renew</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab('share')}
                      className="group flex flex-1 flex-col items-center gap-2 cursor-pointer"
                    >
                      <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                        <Share2 size={22} />
                      </div>
                      <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Share</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('manage')}
                      className="group flex flex-1 flex-col items-center gap-2 cursor-pointer"
                    >
                      <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                        <ArrowRight size={22} />
                      </div>
                      <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Transfer</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Tab */}
            {activeTab === 'edit' && (
              <div className="space-y-4">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-[#8A8A8A]">
                      <span>{FIELD_ICONS[key as keyof typeof FIELD_ICONS]}</span>
                      <span className="capitalize">{label}</span>
                    </label>
                    <input
                      type="text"
                      value={editValues[key as keyof typeof editValues]}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={PLACEHOLDERS[key as keyof typeof PLACEHOLDERS]}
                      className="w-full rounded-xl border border-white/5 bg-[#090909] px-4 py-3 text-base md:text-sm text-white outline-none transition-colors duration-200 focus:border-[#00D179]/40 placeholder:text-[#555555]"
                    />
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-[#8A8A8A] transition-all duration-200 hover:border-white/20 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00D179] px-4 py-3 text-sm font-medium text-black transition-all duration-200 hover:bg-[#00B868] cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Manage Tab */}
            {activeTab === 'manage' && (
              <div className="space-y-6">
                {/* Primary Name */}
                {!isPrimary && (
                  <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Set as Primary</h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Make this your primary .qf identity that appears across the QF Network
                    </p>
                    <button
                      onClick={handleSetPrimary}
                      disabled={settingPrimary}
                      className="w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {settingPrimary ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Setting Primary...
                        </>
                      ) : (
                        'Set as Primary'
                      )}
                    </button>
                  </div>
                )}

                {/* Renewal */}
                {!ownedName.isPermanent && (
                  <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Renewal</h4>
                    <div className="space-y-3">
                      <button
                        onClick={() => handleRenew(1)}
                        disabled={renewing}
                        className="w-full py-3 rounded-xl border border-white/10 text-white font-medium text-sm transition-colors hover:bg-white/5 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {renewing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Renewing...
                          </>
                        ) : (
                          'Renew for 1 Year'
                        )}
                      </button>
                      <button
                        onClick={() => handleRenew(3)}
                        disabled={renewing}
                        className="w-full py-3 rounded-xl border border-white/10 text-white font-medium text-sm transition-colors hover:bg-white/5 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {renewing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Renewing...
                          </>
                        ) : (
                          'Renew for 3 Years'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Transfer */}
                <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                  <h4 className="text-sm font-medium text-white mb-3">Transfer</h4>
                  <p className="text-xs text-[#F5A623] mb-4">
                    This action cannot be undone. The new owner will have full control of this name.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      placeholder="Enter recipient address"
                      className="w-full rounded-xl border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white outline-none transition-colors duration-200 focus:border-[#00D179]/40 placeholder:text-[#555555]"
                    />
                    {transferError && (
                      <p className="text-xs text-[#E5484D]">{transferError}</p>
                    )}
                    <button
                      onClick={handleTransfer}
                      disabled={transferring || !transferRecipient.trim()}
                      className="w-full py-3 bg-[#E5484D] hover:bg-[#c93d41] text-white font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {transferring ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Transferring...
                        </>
                      ) : (
                        'Transfer Name'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Share Tab */}
            {activeTab === 'share' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                    <Avatar url={records.avatar} name={name} size={80} />
                  </div>
                  <h3 className="font-clash text-2xl font-bold text-white mb-2">
                    {name}<span className="text-[#00D179]">.qf</span>
                  </h3>
                  <p className="text-sm text-gray-500">Share your on-chain identity</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={handleShareOnX}
                    className="w-full py-3 rounded-xl border border-white/10 text-white font-medium transition-colors hover:bg-white/5 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Twitter size={18} />
                    Share on X
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
