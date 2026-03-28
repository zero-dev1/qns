import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Eye, 
  Pencil, 
  Settings, 
  Share2, 
  Loader2, 
  Check, 
  Copy, 
  Twitter, 
  Send, 
  Globe, 
  Mail, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { calculatePrice, getQFBalance, getSubstrateQFBalance, getContractPrices, formatQF, namehash } from '../utils/qns';
import { useCopy } from '../hooks/useCopy';
import { hapticTap, hapticSuccess } from '../utils/haptics';
import { TEAM_NAMES, DAPP_LAB_NAMES } from '../utils/badges';

interface OwnedName {
  name: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
}

interface DetailModalProps {
  name: string;
  isOpen: boolean;
  defaultTab?: 'overview' | 'edit' | 'manage' | 'share';
  onClose: () => void;
  // Data
  ownedName: OwnedName;
  records: Record<string, string>;
  isPrimary: boolean;
  // Handlers
  onSaveRecords: (name: string, records: Record<string, string>) => Promise<void>;
  onSetPrimary: (name: string) => Promise<void>;
  onRenew: (name: string, years: number) => Promise<void>;
  onTransfer: (name: string, toAddress: string) => Promise<void>;
  // Wallet
  providerType: 'evm' | 'substrate';
  address: string;
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

const tabs = [
  { key: 'overview', label: 'Overview', icon: <Eye size={14} /> },
  { key: 'edit', label: 'Edit', icon: <Pencil size={14} /> },
  { key: 'manage', label: 'Manage', icon: <Settings size={14} /> },
  { key: 'share', label: 'Share', icon: <Share2 size={14} /> },
];

const TEXT_RECORD_KEYS = [
  { key: 'avatar', icon: <ImageIcon size={16} />, label: 'Avatar URL', placeholder: 'https://example.com/avatar.png' },
  { key: 'bio', icon: <FileText size={16} />, label: 'Bio', placeholder: 'A short bio...' },
  { key: 'twitter', icon: <Twitter size={16} />, label: 'X (Twitter)', placeholder: '@handle or URL' },
  { key: 'telegram', icon: <Send size={16} />, label: 'Telegram', placeholder: '@handle or URL' },
  { key: 'website', icon: <Globe size={16} />, label: 'Website', placeholder: 'https://yoursite.com' },
  { key: 'email', icon: <Mail size={16} />, label: 'Email', placeholder: 'you@example.com' },
];

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function DetailModal({ 
  name, 
  isOpen, 
  defaultTab = 'overview', 
  onClose, 
  ownedName, 
  records, 
  isPrimary,
  onSaveRecords,
  onSetPrimary,
  onRenew,
  onTransfer,
  providerType,
  address
}: DetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'manage' | 'share'>(defaultTab);
  const [editValues, setEditValues] = useState<Record<string, string>>(records);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferStep, setTransferStep] = useState<'input' | 'confirm' | 'idle'>('idle');
  const [transferConfirmName, setTransferConfirmName] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedYears, setSelectedYears] = useState(1);
  const [renewPrices, setRenewPrices] = useState({
    price3Char: 0n,
    price4Char: 0n,
    price5PlusChar: 0n,
    permanentMultiplier: 0n,
  });
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [renewLoading, setRenewLoading] = useState(true);
  const { copy } = useCopy();

  // Renew pricing logic
  const gasBuffer = 500000000000000000n; // 0.5 QF

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultTab);
    setEditValues(records);
    setTransferStep('idle');
    setTransferRecipient('');
    setTransferConfirmName('');
    setSaveSuccess(false);
  }, [isOpen, defaultTab, records]);

  // Load renew pricing data
  useEffect(() => {
    if (activeTab !== 'manage' || ownedName.isPermanent) return;
    
    const loadRenewData = async () => {
      try {
        const [contractPrices] = await Promise.all([getContractPrices()]);
        
        // Fetch balance based on provider type
        let balance = 0n;
        try {
          if (providerType === 'evm') {
            const { evmGetBalance } = await import('../utils/evmContractCall');
            balance = await evmGetBalance(address);
          } else {
            const substrateBal = await getSubstrateQFBalance(address);
            if (substrateBal > 0n) {
              balance = substrateBal;
            } else {
              balance = await getQFBalance(address);
            }
          }
        } catch {
          balance = 0n;
        }

        setRenewPrices({
          price3Char: contractPrices.price3Char,
          price4Char: contractPrices.price4Char,
          price5PlusChar: contractPrices.price5PlusChar,
          permanentMultiplier: contractPrices.permanentMultiplier,
        });
        setUserBalance(balance);

        // Select the most expensive option the user can afford
        const options = [5, 3, 2, 1];
        let selected = 0;
        for (const years of options) {
          const cost = calculatePrice(name.length, years, false, contractPrices);
          if (balance >= cost + gasBuffer) {
            selected = years;
            break;
          }
        }
        setSelectedYears(selected);
      } catch (error) {
        console.error('Failed to load renewal data:', error);
      } finally {
        setRenewLoading(false);
      }
    };

    loadRenewData();
  }, [activeTab, ownedName.isPermanent, name.length, providerType, address]);

  // Helper functions
  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getNewExpiry = (years: number) => {
    return ownedName.expires + BigInt(years) * 365n * 24n * 60n * 60n;
  };

  const canAffordOption = (years: number) => {
    const cost = calculatePrice(name.length, years, false, renewPrices);
    return userBalance >= cost + gasBuffer;
  };

  const canAffordSelected = selectedYears > 0 && canAffordOption(selectedYears);

  const hasUnsavedChanges = Object.keys(editValues).some(key => editValues[key] !== records[key]);

  const handleSave = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    
    setIsSaving(true);
    hapticTap();
    
    try {
      await onSaveRecords(name, editValues);
      setSaveSuccess(true);
      hapticSuccess();
      
      // Auto-switch to overview after 1 second
      setTimeout(() => {
        setActiveTab('overview');
        setSaveSuccess(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to save records:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    hapticTap();
    await onSetPrimary(name);
  };

  const handleRenew = async () => {
    if (!canAffordSelected) return;
    hapticTap();
    await onRenew(name, selectedYears);
  };

  const handleTransfer = async () => {
    if (transferStep === 'input') {
      setTransferStep('confirm');
    } else if (transferStep === 'confirm' && transferConfirmName === name) {
      setIsTransferring(true);
      hapticTap();
      
      try {
        await onTransfer(name, transferRecipient);
        setTransferStep('idle');
        setTransferRecipient('');
        setTransferConfirmName('');
        onClose();
      } catch (error) {
        console.error('Transfer failed:', error);
      } finally {
        setIsTransferring(false);
      }
    }
  };

  const copyProfileLink = () => {
    const url = `https://dotqf.xyz/name/${name}`;
    copy(url, false);
    hapticTap();
  };

  const copyNamehash = () => {
    const hash = namehash(`${name}.qf`);
    copy(hash, false);
    hapticTap();
  };

  const shareOnX = () => {
    const url = `https://dotqf.xyz/name/${name}`;
    const text = `Check out my identity on QNS: ${name}.qf ${url} @dotqfns`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Badge checks
  const isTeam = TEAM_NAMES.includes(name.toLowerCase());
  const isDappLab = DAPP_LAB_NAMES.includes(name.toLowerCase());

  // Social link helpers
  const getSocialUrl = (platform: string, handle: string) => {
    if (platform === 'twitter') {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('x.com') || handle.includes('twitter.com')) return `https://${handle}`;
      return `https://x.com/${handle.replace(/^@/, '')}`;
    }
    if (platform === 'telegram') {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('t.me')) return `https://${handle}`;
      return `https://t.me/${handle.replace(/^@/, '')}`;
    }
    return handle;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      initial={modalBackdropVariants.hidden}
      animate={modalBackdropVariants.visible}
      exit={modalBackdropVariants.exit}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-[520px] max-h-[85vh] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0c0c]"
        initial={modalContentVariants.hidden}
        animate={modalContentVariants.visible}
        exit={modalContentVariants.exit}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <motion.div
                layoutId={`avatar-${name}`}
                className="relative"
              >
                <Avatar url={records.avatar} name={name} size={48} />
                {isPrimary && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#00D179] rounded-full border-2 border-[#0c0c0c]" />
                )}
              </motion.div>
              <div>
                <h2 className="font-clash text-lg font-bold text-white">
                  {name}<span className="text-[#00D179]">.qf</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {ownedName.isPermanent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
                      <ShieldIcon />
                      Permanent
                    </span>
                  )}
                  {isTeam && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
                      <ShieldIcon />
                      Team
                    </span>
                  )}
                  {isDappLab && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
                      <ShieldIcon />
                      dApp Lab
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-[#555] hover:bg-white/10 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="relative">
            <div className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 pb-2 transition-colors ${
                    activeTab === tab.key
                      ? 'text-white border-b-2 border-[#00D179]'
                      : 'text-[#555] hover:text-[#888]'
                  }`}
                >
                  {tab.icon}
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Avatar and basic info */}
                <div className="text-center">
                  <Avatar url={records.avatar} name={name} size={96} className="mx-auto mb-4" />
                  <div className="space-y-2">
                    {ownedName.isPermanent ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-[#00D179]">
                        <ShieldIcon />
                        <span>Permanent</span>
                      </div>
                    ) : (
                      <div className="text-sm text-[#888]">
                        Expires {formatDate(ownedName.expires)}
                      </div>
                    )}
                    {isPrimary && (
                      <div className="text-xs text-[#00D179] font-medium">Primary Name</div>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {records.bio && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">Bio</h3>
                    <p className="text-[#999] text-sm leading-relaxed">{records.bio}</p>
                  </div>
                )}

                {/* Social Links */}
                {(records.twitter || records.telegram || records.website || records.email) && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3">Social Links</h3>
                    <div className="flex flex-wrap gap-2">
                      {records.twitter && (
                        <a
                          href={getSocialUrl('twitter', records.twitter)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#00D179] text-sm transition-colors"
                        >
                          <Twitter size={16} />
                          <span>X</span>
                        </a>
                      )}
                      {records.telegram && (
                        <a
                          href={getSocialUrl('telegram', records.telegram)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#00D179] text-sm transition-colors"
                        >
                          <Send size={16} />
                          <span>Telegram</span>
                        </a>
                      )}
                      {records.website && (
                        <a
                          href={records.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#00D179] text-sm transition-colors"
                        >
                          <Globe size={16} />
                          <span>Website</span>
                        </a>
                      )}
                      {records.email && (
                        <a
                          href={`mailto:${records.email}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#00D179] text-sm transition-colors"
                        >
                          <Mail size={16} />
                          <span>Email</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Provenance */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Provenance</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#555]">Owner</span>
                      <span className="text-xs font-mono text-[#888]">{truncateAddress(address)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#555]">Registered</span>
                      <span className="text-xs text-[#888]">{formatDate(ownedName.registeredAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#555]">Namehash</span>
                      <span className="text-xs font-mono text-[#555]">
                        {namehash(`${name}.qf`).slice(0, 10)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profile completion nudge */}
                {!records.avatar || !records.bio || !records.twitter ? (
                  <div className="rounded-xl border border-[#00D179]/20 bg-[#00D179]/5 p-4">
                    <div className="flex items-center gap-3">
                      <Pencil size={16} className="text-[#00D179]" />
                      <div>
                        <p className="text-sm text-white font-medium">Complete your profile</p>
                        <p className="text-xs text-[#8DF0BA]">Add more details to make your identity stand out</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('edit')}
                        className="ml-auto px-3 py-1 rounded-lg bg-[#00D179] text-black text-xs font-semibold hover:bg-[#00B868] transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={`/name/${name}`}
                    className="block text-center"
                    onClick={onClose}
                  >
                    <button className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-colors">
                      View public profile <ExternalLink size={14} className="inline ml-1" />
                    </button>
                  </Link>
                )}
              </motion.div>
            )}

            {activeTab === 'edit' && (
              <motion.div
                key="edit"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {TEXT_RECORD_KEYS.map((field) => (
                  <div key={field.key}>
                    <label className="flex items-center gap-2 text-sm text-[#888] mb-2">
                      <span>{field.icon}</span>
                      <span>{field.label}</span>
                    </label>
                    <input
                      type="text"
                      value={editValues[field.key] || ''}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:border-[#00D179]/30 focus:outline-none transition-all"
                    />
                  </div>
                ))}

                {/* Save button */}
                <div className="pt-4">
                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 mb-3 text-xs text-[#00D179]">
                      <div className="w-2 h-2 bg-[#00D179] rounded-full animate-pulse" />
                      <span>Unsaved changes</span>
                    </div>
                  )}
                  
                  {saveSuccess ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00D179] text-black">
                      <Check size={16} />
                      <span className="font-semibold">Saved!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges || isSaving}
                      className={`w-full py-3 font-semibold rounded-xl transition-colors ${
                        hasUnsavedChanges && !isSaving
                          ? 'bg-[#00D179] hover:bg-[#00B868] text-black'
                          : 'bg-[#00D179]/20 text-[#00D179]/50 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={16} className="animate-spin inline mr-2" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'manage' && (
              <motion.div
                key="manage"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Set as Primary */}
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">Set as primary</p>
                      <p className="text-xs text-[#555] mt-1">
                        This name will represent your wallet across all QNS-integrated apps
                      </p>
                    </div>
                    {isPrimary ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D179]/10 text-[#00D179]">
                        <Check size={16} />
                        <span className="text-sm font-medium">Primary</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleSetPrimary}
                        className="px-4 py-2 rounded-lg bg-[#00D179] text-black text-sm font-semibold hover:bg-[#00B868] transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                </div>

                {/* Renew */}
                {!ownedName.isPermanent && (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                    <div className="mb-4">
                      <p className="text-sm text-white font-medium mb-1">Renew registration</p>
                      <p className="text-xs text-[#555]">
                        Current expiry: {formatDate(ownedName.expires)}
                      </p>
                    </div>

                    {renewLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#00D179] animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-4">
                          {[1, 2, 3, 5].map((years) => {
                            const cost = calculatePrice(name.length, years, false, renewPrices);
                            const canAfford = canAffordOption(years);
                            const newExpiry = getNewExpiry(years);
                            
                            return (
                              <button
                                key={years}
                                onClick={() => canAfford && setSelectedYears(years)}
                                disabled={!canAfford}
                                className={`w-full p-3 rounded-lg border transition-all text-left ${
                                  selectedYears === years && canAfford
                                    ? 'border-[#00D179]/50 bg-[#00D179]/5'
                                    : canAfford
                                      ? 'border-white/10 bg-[#0C0C0C] hover:border-[#00D179]/30 hover:bg-[#00D179]/5'
                                      : 'border-white/5 bg-[#0C0C0C] opacity-50 cursor-not-allowed'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                                      selectedYears === years && canAfford
                                        ? 'border-[#00D179] bg-[#00D179]'
                                        : canAfford
                                          ? 'border-gray-500 bg-transparent'
                                          : 'border-gray-600 bg-gray-800'
                                    }`}>
                                      {selectedYears === years && canAfford && (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
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

                        <div className="text-xs text-[#555] mb-3">
                          Note: Gas buffer of 0.5 QF is reserved for transaction fees
                        </div>

                        <button
                          onClick={handleRenew}
                          disabled={!canAffordSelected}
                          className={`w-full py-3 font-bold rounded-xl transition-colors ${
                            canAffordSelected
                              ? 'bg-[#00D179] hover:bg-[#00B868] text-black'
                              : 'bg-[#00D179]/20 text-[#00D179]/50 cursor-not-allowed'
                          }`}
                        >
                          Confirm Renewal
                        </button>
                      </>
                    )}
                  </div>
                )}

                {ownedName.isPermanent && (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                    <div className="flex items-center gap-3">
                      <ShieldIcon />
                      <div>
                        <p className="text-sm text-white font-medium">Permanent registration</p>
                        <p className="text-xs text-[#555]">This name is permanent — no renewal needed</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transfer */}
                <div className="rounded-xl border border-red-400/10 bg-red-400/[0.02] p-4">
                  <p className="text-sm text-white font-medium mb-1">Transfer ownership</p>
                  <p className="text-xs text-[#555] mb-3">
                    Send this name to another address. This action is irreversible.
                  </p>
                  
                  {transferStep === 'idle' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Recipient address or name.qf"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#333] focus:border-red-400/30 focus:outline-none"
                      />
                      <button
                        onClick={() => transferRecipient && setTransferStep('input')}
                        disabled={!transferRecipient}
                        className="px-4 py-2 rounded-lg bg-red-400/20 text-red-400 text-sm font-semibold hover:bg-red-400/30 transition-colors disabled:opacity-50"
                      >
                        Transfer
                      </button>
                    </div>
                  )}

                  {transferStep === 'input' && (
                    <div className="space-y-3">
                      <div className="text-xs text-[#555]">
                        Recipient: {transferRecipient}
                      </div>
                      <button
                        onClick={handleTransfer}
                        className="w-full py-2 rounded-lg bg-red-400/20 text-red-400 text-sm font-semibold hover:bg-red-400/30 transition-colors"
                      >
                        Confirm Transfer
                      </button>
                      <button
                        onClick={() => setTransferStep('idle')}
                        className="w-full py-2 rounded-lg border border-white/10 text-white text-sm hover:bg-white/[0.04] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {transferStep === 'confirm' && (
                    <div className="space-y-3">
                      <p className="text-xs text-red-400">
                        Type the name to confirm: <span className="font-bold">{name}.qf</span>
                      </p>
                      <input
                        type="text"
                        placeholder="Type name to confirm"
                        value={transferConfirmName}
                        onChange={(e) => setTransferConfirmName(e.target.value)}
                        className="w-full bg-white/[0.02] border border-red-400/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#333] focus:border-red-400/50 focus:outline-none"
                      />
                      <button
                        onClick={handleTransfer}
                        disabled={transferConfirmName !== name || isTransferring}
                        className="w-full py-2 rounded-lg bg-red-400 text-white text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 size={16} className="animate-spin inline mr-2" />
                            Transferring...
                          </>
                        ) : (
                          'Transfer Name'
                        )}
                      </button>
                      <button
                        onClick={() => setTransferStep('input')}
                        className="w-full py-2 rounded-lg border border-white/10 text-white text-sm hover:bg-white/[0.04] transition-colors"
                      >
                        Back
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'share' && (
              <motion.div
                key="share"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Profile Link */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">Profile Link</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={`https://dotqf.xyz/name/${name}`}
                      readOnly
                      className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white font-mono"
                    />
                    <button
                      onClick={copyProfileLink}
                      className="px-4 py-2 rounded-lg bg-[#00D179] text-black text-sm font-semibold hover:bg-[#00B868] transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                {/* Share on X */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">Share on X</p>
                  <button
                    onClick={shareOnX}
                    className="w-full py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Twitter size={16} />
                    Share on X
                  </button>
                </div>

                {/* QR Code */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">QR Code</p>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                    <QrCode size={48} className="mx-auto text-[#333] mb-2" />
                    <p className="text-xs text-[#555]">QR coming soon</p>
                  </div>
                </div>

                {/* Namehash */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">Namehash</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={namehash(`${name}.qf`)}
                      readOnly
                      className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white font-mono"
                    />
                    <button
                      onClick={copyNamehash}
                      className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
