import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Check, ExternalLink, Send, Shield, Crown,
  Star, AlertTriangle, ChevronUp, ChevronDown, Loader2,
  Eye, Pencil, Settings, Share2, Sparkles
} from 'lucide-react';
import Avatar from './Avatar';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import { hapticTap, hapticSuccess, hapticError } from '../utils/haptics';

// QDL: Team names - empty for now, can be populated later
const TEAM_NAMES: string[] = [];
const DAPP_LAB_NAMES: string[] = [];

// QDL: Renewal pricing constants (must match contract)
const PRICE_PER_YEAR = 5; // QF tokens
const GAS_BUFFER = 0.5;   // QF tokens reserved for gas

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  expires: number;
  isPermanent: boolean;
  registeredAt?: number;
  avatar?: string;
  bio?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  email?: string;
  isPrimary: boolean;
  // QDL: new props for pricing ceremony
  providerType: 'substrate' | 'evm' | null;
  address: string;
  balance: number; // QF token balance
  onSaveRecords: (records: Record<string, string>) => Promise<void>;
  onSetPrimary: () => Promise<void>;
  onRenew: (years: number) => Promise<void>;
  onTransfer: (to: string) => Promise<void>;
}

type Tab = 'overview' | 'edit' | 'manage' | 'share';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'edit', label: 'Edit', icon: Pencil },
  { id: 'manage', label: 'Manage', icon: Settings },
  { id: 'share', label: 'Share', icon: Share2 },
];

const RECORD_FIELDS = [
  { key: 'avatar', label: 'Avatar URL', placeholder: 'https://example.com/avatar.png' },
  { key: 'bio', label: 'Bio', placeholder: 'A short bio about yourself' },
  { key: 'twitter', label: 'Twitter / X', placeholder: '@handle' },
  { key: 'telegram', label: 'Telegram', placeholder: '@handle' },
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com' },
];

export default function DetailModal({
  isOpen, onClose, name, expires, isPermanent,
  avatar, bio, twitter, telegram, website, email,
  isPrimary, /* providerType, */ address, balance,
  onSaveRecords, onSetPrimary, onRenew, onTransfer,
}: DetailModalProps) {
  const { showToast } = useToast();
  const { copy } = useCopy();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Edit state
  const [editValues, setEditValues] = useState({
    avatar: avatar || '', bio: bio || '', twitter: twitter || '',
    telegram: telegram || '', website: website || '', email: email || '',
  });
  const [saving, setSaving] = useState(false);

  // QDL: dirty tracking — compare edited values to original props
  const isDirty = useMemo(() => {
    const original = { avatar: avatar || '', bio: bio || '', twitter: twitter || '', telegram: telegram || '', website: website || '', email: email || '' };
    return Object.keys(original).some(k => editValues[k as keyof typeof editValues] !== original[k as keyof typeof original]);
  }, [editValues, avatar, bio, twitter, telegram, website, email]);

  // Manage — primary
  const [settingPrimary, setSettingPrimary] = useState(false);

  // QDL: Manage — renewal ceremony state
  const [renewYears, setRenewYears] = useState(1);
  const [renewing, setRenewing] = useState(false);
  const renewCost = renewYears * PRICE_PER_YEAR;
  const canAffordRenew = balance >= renewCost + GAS_BUFFER;
  const newExpiry = useMemo(() => {
    if (isPermanent) return null;
    const base = expires > Date.now() / 1000 ? expires : Math.floor(Date.now() / 1000);
    return new Date((base + renewYears * 365.25 * 24 * 3600) * 1000);
  }, [expires, renewYears, isPermanent]);

  // QDL: Manage — transfer ceremony (two step)
  const [transferTo, setTransferTo] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferStep, setTransferStep] = useState<'input' | 'confirm'>('input');
  const [transferring, setTransferring] = useState(false);

  // Share state
  const [linkCopied, setLinkCopied] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);

  // QDL: namehash for devs (keccak256 of name.qf)
  const namehash = useMemo(() => {
    try {
      // Simple display hash — real namehash computed on-chain
      const encoder = new TextEncoder();
      const data = encoder.encode(`${name}.qf`);
      let hex = '0x';
      data.forEach(b => { hex += b.toString(16).padStart(2, '0'); });
      return hex.slice(0, 18) + '...' + hex.slice(-8);
    } catch { return '0x...'; }
  }, [name]);

  // Reset state when modal opens or name changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setEditValues({
        avatar: avatar || '', bio: bio || '', twitter: twitter || '',
        telegram: telegram || '', website: website || '', email: email || '',
      });
      setTransferTo('');
      setTransferError('');
      setTransferStep('input');
      setRenewYears(1);
    }
  }, [isOpen, name, avatar, bio, twitter, telegram, website, email]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (transferStep === 'confirm') { setTransferStep('input'); return; }
        onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, transferStep]);

  // Completeness
  const completeness = useMemo(() => {
    const fields = [avatar, bio, twitter, telegram, website, email];
    return fields.filter(Boolean).length;
  }, [avatar, bio, twitter, telegram, website, email]);

  // ── Handlers ──────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    hapticTap();
    try {
      await onSaveRecords(editValues);
      hapticSuccess();
      showToast('Records saved', 'success');
    } catch {
      hapticError();
      showToast('Failed to save records', 'error');
    } finally {
      setSaving(false);
    }
  }, [editValues, onSaveRecords, showToast]);

  const handleSetPrimary = useCallback(async () => {
    setSettingPrimary(true);
    hapticTap();
    try {
      await onSetPrimary();
      hapticSuccess();
      showToast(`${name}.qf set as primary`, 'success');
    } catch {
      hapticError();
      showToast('Failed to set primary', 'error');
    } finally {
      setSettingPrimary(false);
    }
  }, [name, onSetPrimary, showToast]);

  // QDL: Renewal with ceremony
  const handleRenew = useCallback(async () => {
    if (!canAffordRenew) {
      hapticError();
      showToast('Insufficient balance for renewal + gas', 'error');
      return;
    }
    setRenewing(true);
    hapticTap();
    try {
      await onRenew(renewYears);
      hapticSuccess();
      showToast(`Renewed ${name}.qf for ${renewYears} year${renewYears > 1 ? 's' : ''}`, 'success');
    } catch {
      hapticError();
      showToast('Renewal failed', 'error');
    } finally {
      setRenewing(false);
    }
  }, [canAffordRenew, renewYears, name, onRenew, showToast]);

  // QDL: Two-step transfer
  const handleTransferNext = useCallback(() => {
    const trimmed = transferTo.trim();
    if (!trimmed) { setTransferError('Enter a recipient address'); return; }
    if (trimmed.length < 10) { setTransferError('Address looks too short'); return; }
    if (trimmed.toLowerCase() === address.toLowerCase()) {
      setTransferError('Cannot transfer to yourself');
      return;
    }
    setTransferError('');
    setTransferStep('confirm');
    hapticTap();
  }, [transferTo, address]);

  const handleTransferConfirm = useCallback(async () => {
    setTransferring(true);
    hapticError();
    try {
      await onTransfer(transferTo.trim());
      hapticSuccess();
      showToast(`${name}.qf transferred`, 'success');
      onClose();
    } catch {
      hapticError();
      showToast('Transfer failed', 'error');
    } finally {
      setTransferring(false);
    }
  }, [transferTo, name, onTransfer, showToast, onClose]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/${name}.qf`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    hapticSuccess();
    setTimeout(() => setLinkCopied(false), 2000);
  }, [name]);

  const handleCopyHash = useCallback(() => {
    copy(namehash);
    setHashCopied(true);
    hapticSuccess();
    setTimeout(() => setHashCopied(false), 2000);
  }, [namehash, copy]);

  const handleShareX = useCallback(() => {
    const text = `I own ${name}.qf on QF Network`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    hapticTap();
  }, [name]);

  // ── Don't render if closed ────────────────────
  if (!isOpen) return null;

  // ── Helpers ───────────────────────────────────
  const expiresDate = new Date(expires * 1000);
  const daysUntilExpiry = Math.floor((expires - Date.now() / 1000) / 86400);
  const isExpiring = !isPermanent && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = !isPermanent && expires < Date.now() / 1000;
  const isTeam = TEAM_NAMES.includes(name);
  const isDappLab = DAPP_LAB_NAMES.includes(name);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div
          className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ─────────────────────────── */}
          <div className="flex items-center gap-4 p-6 pb-4 border-b border-white/5">
            <Avatar name={name} url={avatar} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white truncate">{name}.qf</h2>
                {isPrimary && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-violet-500/20 text-violet-300">
                    <Crown className="w-3 h-3" /> Primary
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 mt-0.5">
                {isPermanent
                  ? 'Permanently registered'
                  : isExpired
                    ? 'Expired'
                    : `Expires ${expiresDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Tabs ───────────────────────────── */}
          <div className="flex border-b border-white/5 px-6">
            {TAB_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              // QDL: dirty indicator dot on Edit tab
              const showDot = tab.id === 'edit' && isDirty && !isActive;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); hapticTap(); }}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-white border-b-2 border-violet-500' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {showDot && (
                    <span className="absolute top-2.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab Content (scrollable) ───────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Badges */}
                {(isPermanent || isTeam || isDappLab) && (
                  <div className="flex flex-wrap gap-2">
                    {isPermanent && (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Shield className="w-3 h-3" /> Permanent
                      </span>
                    )}
                    {isTeam && (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <Sparkles className="w-3 h-3" /> Team
                      </span>
                    )}
                    {isDappLab && (
                      <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Star className="w-3 h-3" /> dApp Lab
                      </span>
                    )}
                  </div>
                )}

                {/* Profile preview */}
                {bio && <p className="text-sm text-white/60 leading-relaxed">{bio}</p>}

                <div className="space-y-2">
                  {twitter && <div className="flex items-center gap-2 text-sm text-white/50"><span className="text-white/30 w-20">Twitter</span><span className="text-white/70">@{twitter.replace('@', '')}</span></div>}
                  {telegram && <div className="flex items-center gap-2 text-sm text-white/50"><span className="text-white/30 w-20">Telegram</span><span className="text-white/70">@{telegram.replace('@', '')}</span></div>}
                  {website && <div className="flex items-center gap-2 text-sm text-white/50"><span className="text-white/30 w-20">Website</span><a href={website} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline truncate">{website}</a></div>}
                  {email && <div className="flex items-center gap-2 text-sm text-white/50"><span className="text-white/30 w-20">Email</span><span className="text-white/70">{email}</span></div>}
                </div>

                {/* QDL: Completeness nudge (read-only, no actions) */}
                {completeness < 6 && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/40">Profile completeness</span>
                      <span className="text-xs text-white/30">{completeness}/6</span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i < completeness ? 'bg-violet-500' : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-white/30 mt-2">
                      Complete your profile in the Edit tab to make your identity stand out.
                    </p>
                  </div>
                )}

                {/* Expiring warning */}
                {isExpiring && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. Head to the Manage tab to renew.</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ EDIT TAB ═══ */}
            {activeTab === 'edit' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {RECORD_FIELDS.map(field => (
                  <div key={field.key}>
                    <label className="block text-xs text-white/40 mb-1.5">{field.label}</label>
                    <input
                      type="text"
                      value={editValues[field.key as keyof typeof editValues]}
                      onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-white/20 focus:border-violet-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                ))}

                {/* QDL: dirty indicator + save */}
                <div className="flex items-center justify-between pt-2">
                  {isDirty && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Unsaved changes
                    </span>
                  )}
                  {!isDirty && <span />}
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Records
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══ MANAGE TAB ═══ */}
            {activeTab === 'manage' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                {/* Set Primary */}
                {!isPrimary && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                    <h3 className="text-sm font-medium text-white">Set as Primary</h3>
                    <p className="text-xs text-white/40">This name will represent your wallet across QF Network.</p>
                    <button
                      onClick={handleSetPrimary}
                      disabled={settingPrimary}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium text-white transition-colors flex items-center gap-2"
                    >
                      {settingPrimary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                      Set Primary
                    </button>
                  </div>
                )}

                {/* QDL: Renewal Ceremony */}
                {!isPermanent && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
                    <h3 className="text-sm font-medium text-white">Renew Registration</h3>

                    {/* Year stepper */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">Years</span>
                      <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg border border-white/10">
                        <button
                          onClick={() => setRenewYears(y => Math.max(1, y - 1))}
                          disabled={renewYears <= 1}
                          className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-white">{renewYears}</span>
                        <button
                          onClick={() => setRenewYears(y => Math.min(5, y + 1))}
                          disabled={renewYears >= 5}
                          className="p-1.5 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Cost breakdown */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-white/40">
                        <span>Cost ({renewYears} yr{renewYears > 1 ? 's' : ''} x {PRICE_PER_YEAR} QF)</span>
                        <span className="text-white/60">{renewCost} QF</span>
                      </div>
                      <div className="flex justify-between text-white/40">
                        <span>Gas buffer</span>
                        <span className="text-white/60">~{GAS_BUFFER} QF</span>
                      </div>
                      <div className="flex justify-between text-white/40">
                        <span>Your balance</span>
                        <span className={balance < renewCost + GAS_BUFFER ? 'text-red-400' : 'text-emerald-400'}>
                          {balance.toFixed(2)} QF
                        </span>
                      </div>
                    </div>

                    {/* New expiry preview */}
                    {newExpiry && (
                      <div className="text-xs text-white/30">
                        New expiry: {newExpiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}

                    {!canAffordRenew && (
                      <p className="text-xs text-red-400">Insufficient balance. You need at least {(renewCost + GAS_BUFFER).toFixed(1)} QF.</p>
                    )}

                    <button
                      onClick={handleRenew}
                      disabled={renewing || !canAffordRenew}
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Renew for {renewCost} QF
                    </button>
                  </div>
                )}

                {isPermanent && (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-sm text-emerald-400 flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    This name is permanently registered. No renewal needed.
                  </div>
                )}

                {/* QDL: Two-step transfer ceremony */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h3 className="text-sm font-medium text-white">Transfer Ownership</h3>

                  <AnimatePresence mode="wait">
                    {transferStep === 'input' && (
                      <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <p className="text-xs text-white/40">Transfer this name to another address. This action cannot be undone.</p>
                        <input
                          type="text"
                          value={transferTo}
                          onChange={e => { setTransferTo(e.target.value); setTransferError(''); }}
                          placeholder="Recipient address (0x... or 5...)"
                          className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-white/20 focus:border-violet-500/50 focus:outline-none transition-colors"
                        />
                        {transferError && <p className="text-xs text-red-400">{transferError}</p>}
                        <button
                          onClick={handleTransferNext}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-colors flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" /> Review Transfer
                        </button>
                      </motion.div>
                    )}

                    {transferStep === 'confirm' && (
                      <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 space-y-2">
                          <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            This is irreversible
                          </div>
                          <p className="text-xs text-white/40">
                            You are about to transfer <span className="text-white font-medium">{name}.qf</span> to:
                          </p>
                          <p className="text-xs text-white/60 font-mono break-all bg-white/[0.03] p-2 rounded-lg">{transferTo}</p>
                          <p className="text-xs text-white/40">
                            You will lose all control of this name. Records, primary status, and ownership will transfer to the recipient.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTransferStep('input')}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white/60 transition-colors"
                          >
                            Go Back
                          </button>
                          <button
                            onClick={handleTransferConfirm}
                            disabled={transferring}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                          >
                            {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Confirm Transfer
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ═══ SHARE TAB ═══ */}
            {activeTab === 'share' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Profile link */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h3 className="text-sm font-medium text-white">Profile Link</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white/50 font-mono truncate">
                      {window.location.origin}/{name}.qf
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    >
                      {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Share on X */}
                <button
                  onClick={handleShareX}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Share on X
                </button>

                {/* QDL: QR placeholder */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h3 className="text-sm font-medium text-white">QR Code</h3>
                  <div className="flex items-center justify-center h-32 rounded-xl bg-white/[0.02] border border-dashed border-white/10">
                    <span className="text-xs text-white/20">QR code coming soon</span>
                  </div>
                </div>

                {/* QDL: Namehash for devs */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h3 className="text-sm font-medium text-white/60">For Developers</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">Namehash</span>
                    <div className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.03] text-xs text-white/40 font-mono truncate">
                      {namehash}
                    </div>
                    <button
                      onClick={handleCopyHash}
                      className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    >
                      {hashCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
