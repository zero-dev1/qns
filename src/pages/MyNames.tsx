import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useNamesStore } from '../stores/namesStore';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Twitter,
  Loader2,
  Check,
  Star,
  X,
  Pencil,
  Globe,
  Send,
  Link2,
  FileText,
  RefreshCw,
  Share2,
  Copy,
  ArrowRight,
  Search,
  Wallet,
  Clock,
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
import { ss58ToEvmAddress } from '../utils/address';
import { TEAM_NAMES, DAPP_LAB_NAMES } from '../utils/badges';
import { useToast } from '../contexts/ToastContext';
import { useCopy } from '../hooks/useCopy';
import { hapticSuccess, hapticError, hapticTap, hapticProfileAction } from '../utils/haptics';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../utils/errorHelpers';
import RenewModal from '../components/RenewModal';
import Avatar from '../components/Avatar';
import PulseDot from '../components/PulseDot';
import DetailModal from '../components/DetailModal';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

const TEXT_KEYS = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'] as const;

const FIELD_ICONS: Record<typeof TEXT_KEYS[number], React.ReactNode> = {
  avatar: <Link2 size={16} />,
  bio: <FileText size={16} />,
  twitter: <Twitter size={16} />,
  telegram: <Send size={16} />,
  website: <Globe size={16} />,
  email: <Send size={16} />,
};

const FIELD_LABELS: Record<typeof TEXT_KEYS[number], string> = {
  avatar: 'Avatar URL',
  bio: 'Bio',
  twitter: 'Twitter',
  telegram: 'Telegram',
  website: 'Website',
  email: 'Email',
};

const PLACEHOLDERS: Record<typeof TEXT_KEYS[number], string> = {
  avatar: 'https://example.com/avatar.png',
  bio: 'Tell the world about yourself',
  twitter: '@dotqfns or https://x.com/dotqfns',
  telegram: '@username or https://t.me/username',
  website: 'https://example.com',
  email: 'user@example.com',
};

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ── Identity Card Component ──

interface IdentityCardProps {
  name: OwnedName;
  records: { avatar: string; bio: string; twitter: string; telegram: string; website: string; email: string };
  isPrimary: boolean;
  enableTilt: boolean;
  onOpenDetail: (name: string, tab?: 'overview' | 'edit' | 'manage' | 'share') => void;
}

const IdentityCard = ({ name, records, isPrimary, enableTilt, onOpenDetail }: IdentityCardProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    if (!enableTilt) return;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextRotateY = ((x - centerX) / centerX) * 4;
    const nextRotateX = ((centerY - y) / centerY) * 4;

    rotateX.set(nextRotateX);
    rotateY.set(nextRotateY);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  // Status calculation
  const now = BigInt(Math.floor(Date.now() / 1000));
  const thirtyDays = 30n * 24n * 60n * 60n;
  const isExpiringSoon = !name.isPermanent && name.expires > 0n && name.expires - now < thirtyDays;
  
  // Status bar color
  const statusBarClass = name.isPermanent 
    ? 'bg-gradient-to-r from-[#00D179] to-[#00D179]/40'
    : isExpiringSoon 
      ? 'bg-gradient-to-r from-red-400 to-red-400/40'
      : 'bg-gradient-to-r from-amber-400 to-amber-400/40';

  // Badge checks
  const isTeam = TEAM_NAMES.includes(name.name.toLowerCase());
  const isDappLab = DAPP_LAB_NAMES.includes(name.name.toLowerCase());

  // Completeness calculation
  const completenessFields = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'];
  const filledFields = completenessFields.filter(field => records[field as keyof typeof records]).length;

  // Expiry text
  const expiryText = !name.isPermanent && name.expires > 0n
    ? new Date(Number(name.expires) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <motion.div
      ref={cardRef}
      layoutId={`card-${name.name}`}
      onClick={() => onOpenDetail(name.name, 'overview')}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={enableTilt ? { rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 1200 } : undefined}
      className={`group relative cursor-pointer rounded-2xl border bg-[#111] overflow-hidden flex flex-col items-center px-5 py-6 hover:border-white/[0.1] transition-all duration-300 ${
        isPrimary ? 'border-[#00D179]/20' : 'border-white/[0.06]'
      }`}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Ambient glow for primary name */}
      {isPrimary && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl" style={{
            background: 'radial-gradient(ellipse, rgba(0,209,121,0.08) 0%, transparent 70%)',
          }} />
        </div>
      )}

      {/* Status header bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusBarClass}`} />

      {/* Spotlight effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(500px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,209,121,0.05), transparent 40%)`,
        }}
      />

      {/* Floating action icons */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:group-hover:opacity-100 opacity-100 md:opacity-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(name.name, 'edit');
          }}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#555] hover:text-white transition-all"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(name.name, 'share');
          }}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#555] hover:text-white transition-all"
        >
          <Share2 size={16} />
        </button>
      </div>

      {/* Badge row */}
      <div className="flex items-center gap-2 mb-4">
        {name.isPermanent && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
            <ShieldIcon />
            Permanent
          </span>
        )}
        {isTeam && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
            <ShieldIcon />
            Team
          </span>
        )}
        {isDappLab && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
            <ShieldIcon />
            dApp Lab
          </span>
        )}
      </div>

      {/* Avatar */}
      <motion.div
        layoutId={`avatar-${name.name}`}
        className={`relative mb-4 border-4 border-[#111]/60 rounded-full ring ${
          isPrimary ? 'ring-2 ring-[#00D179]/40 ring-offset-2 ring-offset-[#111]' : ''
        }`}
      >
        <Avatar url={records.avatar} name={name.name} size={80} className="md:w-20 md:h-20 w-16 h-16" />
      </motion.div>

      {/* Name */}
      <div className="text-center mb-2">
        <h3 className="font-clash text-xl font-bold text-white">
          {name.name}<span className="text-[#00D179]">.qf</span>
        </h3>
      </div>

      {/* Status line */}
      <div className="text-center mb-2">
        {name.isPermanent ? (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#00D179]">
            <PulseDot color="bg-[#00D179]" />
            <span>Permanent</span>
          </div>
        ) : expiryText ? (
          <p className="text-[11px] text-[#888]">Expires {expiryText}</p>
        ) : null}
        
        {isPrimary && (
          <p className="text-[10px] text-[#00D179] font-medium mt-1">Primary</p>
        )}
      </div>

      {/* Bio preview */}
      {records.bio && (
        <p className="text-[#666] text-xs text-center leading-relaxed line-clamp-2 mb-3 px-2">
          {records.bio}
        </p>
      )}

      {/* Completeness indicator */}
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-center gap-1 mb-1">
          {completenessFields.map((field, i) => (
            <div
              key={field}
              className={`w-1 h-1 rounded-full ${
                i < filledFields ? 'bg-[#00D179]' : 'bg-white/[0.06]'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-[#333] text-center">
          {filledFields} of {completenessFields.length}
        </p>
      </div>
    </motion.div>
  );
};

// Modal animation variants
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


/* const NameCard = ({
  item,
  index,
  bio,
  avatarUrl,
  isPrimary,
  enableTilt,
  renewing,
  settingPrimary,
  recentlyRenewed,
  recentlyPrimaried,
  onOpen,
  onSetPrimary,
  onRenew,
  onShare,
  onEdit,
  onTransfer,
}: NameCardProps) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 180, damping: 20, mass: 0.45 });
  const springRotateY = useSpring(rotateY, { stiffness: 180, damping: 20, mass: 0.45 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update spotlight position
    setMousePosition({ x, y });
    
    // Update tilt if enabled
    if (!enableTilt) return;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextRotateY = ((x - centerX) / centerX) * 3;
    const nextRotateX = ((centerY - y) / centerY) * 3;

    rotateX.set(Number(nextRotateX.toFixed(2)));
    rotateY.set(Number(nextRotateY.toFixed(2)));
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const hasExpiry = !item.isPermanent && item.expires > 0n;
  const expiryText = hasExpiry
    ? new Date(Number(item.expires) * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isTeam = TEAM_NAMES.includes(item.name.toLowerCase());
  const isDappLab = DAPP_LAB_NAMES.includes(item.name.toLowerCase());

  return (
    <motion.div
      layoutId={`name-card-${item.name}`}
      onClick={onOpen}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={enableTilt ? { rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 800 } : undefined}
      className={`name-card group relative cursor-pointer overflow-hidden rounded-2xl border bg-[#111] transition-all duration-300 hover:border-[#00D179]/20 hover:shadow-lg hover:shadow-[#00D179]/5 ${
  recentlyRenewed || recentlyPrimaried ? 'border-[#00D179]/40 shadow-lg shadow-[#00D179]/10' : 'border-white/5'
}`}
    >
      {/* Spotlight effect overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(350px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,209,121,0.04), transparent 40%)`,
        }}
      />
      <div
        className={`relative h-20 z-10 ${
          isPrimary
            ? 'bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent'
            : 'bg-gradient-to-r from-white/5 via-white/[0.03] to-transparent'
        }`}
      >
        <div className="absolute right-4 top-4 z-10 flex flex-wrap justify-end gap-2">
          {item.isPermanent && (
            <span className="permanent-badge hidden md:inline-flex rounded-full border border-[#00D179]/30 bg-[#00D179]/5 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179]">
              Permanent
            </span>
          )}
          {isTeam && (
            <span className="inline-flex rounded-full border border-[#00D179]/30 bg-[#00D179]/5 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179]">
              Team
            </span>
          )}
          {isDappLab && (
            <span className="inline-flex rounded-full border border-[#00D179]/30 bg-[#00D179]/5 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179]">
              dApp Lab
            </span>
          )}
          {recentlyRenewed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#00D179]/30 bg-[#00D179]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179] animate-pulse">
              <Check size={10} />
              Renewed
            </span>
          )}
          {recentlyPrimaried && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#00D179]/30 bg-[#00D179]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00D179] animate-pulse">
              <Star size={10} fill="currentColor" />
              Primary set
            </span>
          )}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="-mt-8 flex items-center gap-4">
          <div className="z-10 h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-4 border-[#111] bg-[#111]">
            <Avatar url={avatarUrl} name={item.name} size={64} />
          </div>

          <div className="min-w-0 flex-1 pt-2">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 truncate font-clash text-xl md:text-2xl font-bold text-white whitespace-nowrap">
                <span className="whitespace-nowrap">
                  {item.name}
                  <span className="text-[#00D179]">.qf</span>
                </span>
              </h3>

              {isPrimary && (
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs text-[#00D179]">
                  <span className="primary-dot" />
                  <span className="whitespace-nowrap">Primary</span>
                </span>
              )}
            </div>

            {item.isPermanent ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#00D179]">
                <ShieldIcon />
                <span>Permanent</span>
              </div>
            ) : expiryText && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500">
                <Clock size={16} />
                <span>{expiryText}</span>
              </div>
            )}
          </div>
        </div>

        <p className={`mt-2 line-clamp-1 text-sm ${bio ? 'text-gray-400' : 'italic text-gray-600'}`}>
          {bio || 'No bio set'}
        </p>

        <div className="mt-4 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onSetPrimary}
              disabled={isPrimary || settingPrimary}
              className={`group/action min-w-0 flex flex-1 flex-col items-center gap-1.5 ${
                isPrimary || settingPrimary ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <span className={`transition-colors duration-200 ${isPrimary ? 'text-[#00D179]' : 'text-gray-500'} ${isPrimary || settingPrimary ? '' : 'group-hover/action:text-[#00D179]'}`}>
                {settingPrimary ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Star size={20} fill={isPrimary ? 'currentColor' : 'none'} />
                )}
              </span>
              <span className={`text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap transition-colors duration-200 ${isPrimary ? 'text-[#00D179]' : 'text-gray-600'} ${isPrimary || settingPrimary ? '' : 'group-hover/action:text-gray-400'}`}>
                Primary
              </span>
            </button>

            <button
              onClick={onRenew}
              disabled={item.isPermanent || renewing}
              className={`group/action min-w-0 flex flex-1 flex-col items-center gap-1.5 ${
                item.isPermanent || renewing ? 'cursor-default opacity-40' : 'cursor-pointer'
              }`}
            >
              <span className={`text-gray-500 transition-colors duration-200 ${item.isPermanent || renewing ? '' : 'group-hover/action:text-[#00D179]'}`}>
                {renewing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
              </span>
              <span className={`text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap text-gray-600 transition-colors duration-200 ${item.isPermanent || renewing ? '' : 'group-hover/action:text-gray-400'}`}>
                Renew
              </span>
            </button>

            <button onClick={onShare} className="group/action min-w-0 flex flex-1 cursor-pointer flex-col items-center gap-1.5">
              <span className="text-gray-500 transition-colors duration-200 group-hover/action:text-[#00D179]">
                <Share2 size={20} />
              </span>
              <span className="text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap text-gray-600 transition-colors duration-200 group-hover/action:text-gray-400">
                Share
              </span>
            </button>

            <button onClick={onEdit} className="group/action min-w-0 flex flex-1 cursor-pointer flex-col items-center gap-1.5">
              <span className="text-gray-500 transition-colors duration-200 group-hover/action:text-[#00D179]">
                <Pencil size={20} />
              </span>
              <span className="text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap text-gray-600 transition-colors duration-200 group-hover/action:text-gray-400">
                Edit
              </span>
            </button>

            <button onClick={onTransfer} className="group/action min-w-0 flex flex-1 cursor-pointer flex-col items-center gap-1.5">
              <span className="text-gray-500 transition-colors duration-200 group-hover/action:text-[#00D179]">
                <ArrowRight size={20} />
              </span>
              <span className="text-[8px] md:text-[9px] uppercase tracking-wider whitespace-nowrap text-gray-600 transition-colors duration-200 group-hover/action:text-gray-400">
                Transfer
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}; */

function MyNamesPage() {
  const { address, ss58Address, connect, refreshName, providerType, qnsName } = useWalletStore();
  const { refreshNames, ownedNames } = useNamesStore();
  const { showToast } = useToast();
  const { copy } = useCopy();
  const [searchParams] = useSearchParams();
  const expandName = searchParams.get('expand');

  // Compute the correct signer address based on provider type
  const signerAddress = providerType === 'evm' ? address : (ss58Address || address);

  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [cardRecords, setCardRecords] = useState<Map<string, Record<string, string>>>(new Map());
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [renewingName, setRenewingName] = useState<string | null>(null);
  const [recentlyRenewed, setRecentlyRenewed] = useState<string | null>(null);
  const [recentlyPrimaried, setRecentlyPrimaried] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [primaryName, setPrimaryNameState] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'primary' | 'alpha' | 'expiry'>('primary');

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'edit' | 'manage' | 'share'>('overview');

  // Edit modal state (legacy, will be replaced by detail modal)
  const [editModalName, setEditModalName] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const hasAutoExpanded = useRef(false);
  const [shareModalName, setShareModalName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [enableTilt, setEnableTilt] = useState(false);
  const [renewModalName, setRenewModalName] = useState<string | null>(null);

  // Load names
  const loadNames = useCallback(async () => {
    if (!address) return;

    // Pre-fill from the Zustand store if it has names and our local state is empty.
    const storeNames = ownedNames;
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
    } catch {
      // Keep whatever we have
    } finally {
      setLoading(false);
    }
  }, [address, ownedNames, names.length]);

  // Load text records for cards
  const loadTextRecords = async (name: string) => {
    const recordKeys = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'];
    const records: Record<string, string> = {};
    
    await Promise.all(recordKeys.map(async (key) => {
      try {
        records[key] = await getTextRecord(name, key) || '';
      } catch {
        records[key] = '';
      }
    }));
    
    setCardRecords((prev) => new Map(prev.set(name, records)));
    setEditValues((prev) => ({ ...prev, [name]: { ...records } }));
  };

  // Load all card records when names change
  useEffect(() => {
    if (!names.length) return;
    const fetchRecords = async () => {
      const recordKeys = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'];
      const entries = await Promise.all(
        names.map(async (n) => {
          const records: Record<string, string> = {};
          await Promise.all(recordKeys.map(async (key) => {
            try { records[key] = await getTextRecord(n.name, key) || ''; } catch { records[key] = ''; }
          }));
          return [n.name, records] as [string, Record<string, string>];
        })
      );
      setCardRecords(new Map(entries));
    };
    fetchRecords();
  }, [names]);

  // Background refresh
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
          if (!cardRecords.get(item.name)) {
            loadTextRecords(item.name);
          }
        }
      } else {
        setNames([]);
      }
    } catch {
      // silently ignore — keep existing state
    }
  }, [address, cardRecords]);

  // Sort names
  const sortedNames = [...names].sort((a, b) => {
    if (sortMode === 'primary') {
      const aPrimary = primaryName === a.name ? 0 : 1;
      const bPrimary = primaryName === b.name ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'alpha') {
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'expiry') {
      if (a.isPermanent && !b.isPermanent) return 1;
      if (!a.isPermanent && b.isPermanent) return -1;
      if (a.isPermanent && b.isPermanent) return a.name.localeCompare(b.name);
      return a.expires < b.expires ? -1 : 1;
    }
    return 0;
  });

  // Detail modal functions
  const openDetailModal = (name: string, tab: 'overview' | 'edit' | 'manage' | 'share' = 'overview') => {
    setSelectedName(name);
    setDetailTab(tab);
    setDetailModalOpen(true);
    hapticTap();
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedName(null);
    setDetailTab('overview');
  };

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

  // Auto-open edit modal if URL param is set
  useEffect(() => {
    if (expandName && !hasAutoExpanded.current && names.some((n) => n.name === expandName)) {
      hasAutoExpanded.current = true;
      openEditModal(expandName);
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
        if (detailModalOpen) closeDetailModal();
        if (editModalName) closeEditModal();
        if (transferModal) setTransferModal(null);
        if (shareModalName) setShareModalName(null);
        if (renewModalName) setRenewModalName(null);
      }
    };

    const hasOpenModal = detailModalOpen || editModalName || transferModal || shareModalName || renewModalName;

    if (hasOpenModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [detailModalOpen, editModalName, transferModal, shareModalName, renewModalName]);

  const openEditModal = (name: string) => {
    setEditModalName(name);
    if (!cardRecords.get(name)) {
      loadTextRecords(name);
    }
    hapticTap();
  };

  const closeEditModal = () => {
    setEditModalName(null);
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
      const keys: string[] = [];
      const values: string[] = [];
      
      for (const key of TEXT_KEYS) {
        const newValue = editValues[name]?.[key] ?? '';
        const oldValue = cardRecords.get(name)?.[key] ?? '';
        
        if (newValue !== oldValue) {
          keys.push(key);
          values.push(newValue);
        }
      }
      
      if (keys.length > 0) {
        try {
          if (!signerAddress) throw new Error('No wallet connected');
          const { confirmation } = await setMultipleTextRecords(name, keys, values, signerAddress);

          // Optimistic update
          const updatedRecords = { ...(editValues[name] || {}) };
          setCardRecords((prev) => new Map(prev.set(name, updatedRecords)));
          showToast('Profile updated successfully', 'success');
          hapticProfileAction();
          closeEditModal();

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
        } catch (err: any) {
          if (isRetryableError(err.message)) {
            showToast(RETRY_MESSAGE_SHORT, 'warning');
            hapticError();
            return;
          }
          showToast('Failed to save, please try again', 'error');
          hapticError();
        }
      } else {
        showToast('No changes to save', 'success');
        closeEditModal();
      }
    } finally {
      setSavingAll(false);
    }
  };

  const handleSetPrimary = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address) return;
    setSettingPrimary(name);
    try {
      if (!signerAddress) throw new Error('No wallet connected');
      const { confirmation } = await setPrimaryName(name, address, signerAddress);

      // Optimistic
      setPrimaryNameState(name);
      useWalletStore.setState({ qnsName: name, displayName: name });
      setRecentlyPrimaried(name);
      setTimeout(() => setRecentlyPrimaried(null), 5000);
      hapticSuccess();

      confirmation.then((result) => {
        if (result.confirmed) {
          // Delay refresh to give chain time to index the reverse record.
          // After refresh, re-assert the optimistic primary in case the
          // chain's reverse lookup returned stale data.
          setTimeout(() => {
            refreshName().catch(() => {}).finally(() => {
              // Re-assert optimistic primary if it was reverted by stale chain data
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
        // Check if this is a retryable error
        if (result.error && isRetryableError(result.error)) {
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          refreshName().catch(() => {});
          resolveReverse(address).then(setPrimaryNameState).catch(() => {});
          hapticError();
          return;
        }
        // Revert
        showToast(`Failed to set primary: ${result.error}`, 'error');
        refreshName().catch(() => {});
        resolveReverse(address).then(setPrimaryNameState).catch(() => {});
        hapticError();
      });
    } catch (err: any) {
      // Check if this is a retryable error
      if (isRetryableError(err.message)) {
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        hapticError();
        return;
      }
      showToast(err.message || 'Failed to set primary name', 'error');
      hapticError();
    } finally {
      setSettingPrimary(null);
    }
  };

  const handleRenew = async (name: string, years: number) => {
    if (!address) return;
    setRenewingName(name);
    setRenewError(null);
    try {
      if (!signerAddress) throw new Error('No wallet connected');
      const { confirmation } = await renewName(name, years, signerAddress);

      // Optimistic update immediately
      setNames((prev) =>
        prev.map((item) => {
          if (item.name !== name || item.isPermanent) return item;
          return { ...item, expires: item.expires + BigInt(years) * 365n * 24n * 60n * 60n };
        })
      );
      showToast(`Renewed ${name}.qf for ${years} year${years > 1 ? 's' : ''}`, 'success');
      hapticSuccess();
      setRecentlyRenewed(name);
      setTimeout(() => setRecentlyRenewed(null), 5000);

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
        // Check if this is a retryable error
        if (result.error && isRetryableError(result.error)) {
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          hapticError();
          bgRefresh(); // reload real data
          return;
        }
        // Hard failure — revert optimistic expiry
        showToast(`Renewal of ${name}.qf failed: ${result.error}`, 'error');
        hapticError();
        bgRefresh(); // reload real data
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
        if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
          userMessage = 'Insufficient QF balance';
        } else if (message.includes('not connected') || message.includes('reconnect')) {
          userMessage = 'Wallet connection lost. Please disconnect and reconnect.';
        } else if (message.includes('switch metamask') || message.includes('qf network')) {
          userMessage = 'Please switch MetaMask to QF Network and try again.';
        } else if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        }
      }
      setRenewError(`Failed to renew ${name}: ${userMessage}`);
      showToast(err.message || `Failed to renew ${name}`, 'error');
      hapticError();
    } finally {
      setRenewingName(null);
    }
  };

  const handleShare = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalName(name);
    hapticTap();
  };

  const handleTransferClick = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferModal(name);
    setTransferRecipient('');
    setTransferError(null);
    setTransferSuccess(false);
  };

  
  const handleTransfer = async () => {
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
      if (editModalName === nameToTransfer) setEditModalName(null);
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="text-[#00D179]"><ShieldIcon /></span>
          <span>Permanent</span>
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
      <div className={`flex flex-wrap items-center gap-2 text-xs ${isExpiringSoon ? 'text-[#F5A623]' : 'text-gray-500'}`}>
        <span className={isExpiringSoon ? 'text-[#F5A623]' : 'text-gray-500'}><Clock size={16} /></span>
        <span>{expiryText}</span>
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

  // Helper functions
  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getNextExpiry = () => {
    const nonPermanent = names.filter(n => !n.isPermanent && n.expires > 0n);
    if (nonPermanent.length === 0) return null;
    const earliest = nonPermanent.reduce((min, curr) => 
      curr.expires < min.expires ? curr : min
    );
    return new Date(Number(earliest.expires) * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="mx-auto max-w-[1120px]">
          {/* Header */}
          <div className="mb-8">
            <p className="font-satoshi font-medium text-sm text-[#00D179] uppercase tracking-[0.15em] mb-2">
              MY NAMES
            </p>
            <h1 className="font-clash text-3xl font-semibold text-white md:text-4xl">
              Your .qf identities
            </h1>
          </div>

          {/* NOT CONNECTED state */}
          {!address && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                <Wallet size={24} className="text-[#333]" />
              </div>
              <h2 className="font-clash text-2xl font-bold text-white mb-2">Connect your wallet</h2>
              <p className="text-[#555] text-sm mb-6">to manage your .qf identities</p>
              <button
                onClick={connect}
                className="px-6 py-3 rounded-xl bg-[#00D179] text-black font-semibold hover:bg-[#00B868] transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* LOADING state */}
          {address && loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl border border-white/[0.04] bg-[#111] animate-pulse" style={{ height: '400px' }}>
                  <div className="h-1 bg-gradient-to-r from-white/[0.06] to-transparent mb-4" />
                  <div className="flex flex-col items-center px-5">
                    <div className="w-16 h-16 rounded-full bg-white/[0.06] mb-4" />
                    <div className="h-6 w-24 rounded bg-white/[0.04] mb-2" />
                    <div className="h-3 w-16 rounded bg-white/[0.03] mb-3" />
                    <div className="h-3 w-32 rounded bg-white/[0.03]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMPTY state */}
          {address && !loading && names.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                <Search size={24} className="text-[#333]" />
              </div>
              <h2 className="font-clash text-2xl font-bold text-white mb-2">No names yet</h2>
              <p className="text-[#555] text-sm mb-6">Claim your first .qf identity</p>
              <Link
                to="/"
                className="px-6 py-3 rounded-xl bg-[#00D179] text-black font-semibold hover:bg-[#00B868] transition-colors"
              >
                Search Names
              </Link>
            </div>
          )}

          {/* MAIN CONTENT */}
          {address && !loading && names.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="w-full rounded-xl border border-white/[0.04] bg-[#0c0c0c] px-5 py-4 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left: wallet + count */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {providerType === 'evm' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#F6851B"/>
                          <path d="M2 17L12 22L22 17" stroke="#F6851B" strokeWidth="2"/>
                          <path d="M2 12L12 17L22 12" stroke="#F6851B" strokeWidth="2"/>
                        </svg>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-[#E6007A]" />
                      )}
                      <span className="text-[#888] text-xs font-mono">
                        {truncateAddress(address)}
                      </span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-white/[0.2]" />
                    <span className="text-white text-sm font-medium">
                      {names.length} name{names.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Center: primary name */}
                  {qnsName && (
                    <div className="flex items-center gap-2">
                      <Avatar url={cardRecords.get(qnsName)?.avatar} name={qnsName} size={24} />
                      <Link 
                        to={`/name/${qnsName}`}
                        className="text-[#00D179] text-sm font-medium hover:text-[#00B868] transition-colors"
                      >
                        {qnsName}.qf
                      </Link>
                    </div>
                  )}

                  {/* Right: next expiry */}
                  <div className="text-sm">
                    {names.some(n => !n.isPermanent) ? (
                      <span className="text-amber-400">
                        Earliest renewal: {getNextExpiry()}
                      </span>
                    ) : (
                      <span className="text-[#00D179]">All permanent</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toolbar row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(['primary', 'alpha', 'expiry'] as const).map((sort) => (
                    <button 
                      key={sort} 
                      onClick={() => setSortMode(sort)} 
                      className={`text-xs transition-colors ${
                        sortMode === sort ? 'text-white' : 'text-[#444] hover:text-[#666]'
                      }`}
                    >
                      {sort === 'primary' ? 'Primary first' : sort === 'alpha' ? 'A–Z' : 'Expiring soon'}
                    </button>
                  ))}
                </div>
                {qnsName && (
                  <Link 
                    to={`/name/${qnsName}`} 
                    className="text-xs text-[#00D179] hover:text-[#00B868] transition-colors"
                  >
                    View public profile →
                  </Link>
                )}
              </div>

              {/* Grid of identity cards */}
              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sortedNames.map((name) => {
                    const defaultRecords = { avatar: '', bio: '', twitter: '', telegram: '', website: '', email: '' };
                    const records = (cardRecords.get(name.name) || defaultRecords) as typeof defaultRecords;
                    const isPrimary = primaryName === name.name;

                    return (
                      <IdentityCard
                        key={name.name}
                        name={name}
                        records={records}
                        isPrimary={isPrimary}
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
      </main>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {editModalName && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            initial={modalBackdropVariants.hidden}
            animate={modalBackdropVariants.visible}
            exit={modalBackdropVariants.exit}
            onClick={closeEditModal}
          >
            <motion.div
              className="relative mx-4 max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[24px] border border-white/10 bg-[#111111] shadow-2xl shadow-[#00D179]/10"
              initial={modalContentVariants.hidden}
              animate={modalContentVariants.visible}
              exit={modalContentVariants.exit}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent" />
              <div className="relative px-6 pb-6 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
              {/* Modal Header with X button */}
              <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-full border border-white/10 bg-[#0A0A0A] p-1 shadow-lg shadow-black/20">
                    <Avatar 
                      url={cardRecords.get(editModalName)?.avatar ?? ''} 
                      name={editModalName} 
                      size={56} 
                    />
                  </div>
                  <div className="pt-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 truncate font-clash text-xl md:text-2xl font-bold text-white whitespace-nowrap">
                        <span className="whitespace-nowrap">
                          {editModalName}<span className="text-[#00D179]">.qf</span>
                        </span>
                        {primaryName === editModalName && (
                          <span className="primary-dot ml-2" />
                        )}
                      </h3>
                      {primaryName === editModalName && (
                        <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-[#00D179]/20 bg-[#00D179]/10 px-2 py-1 text-[10px] font-medium text-[#00D179]">
                          <Star size={8} fill="currentColor" />
                          <span className="whitespace-nowrap">Primary</span>
                        </span>
                      )}
                      {getSelectedNameData()?.isPermanent && (
                        <span className="hidden sm:inline-flex flex-shrink-0 rounded-full border border-[#00D179]/20 bg-[#00D179]/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8DF0BA] whitespace-nowrap">
                          Permanent
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {getSelectedNameData() && getStatusDisplay(getSelectedNameData()!)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#8A8A8A] transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Action buttons row */}
              <div className="mb-6 rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                <div className="flex items-start justify-between gap-2">
                {/* Primary - only show if not primary, amber color */}
                {primaryName !== editModalName && (
                  <button
                    onClick={(e) => handleSetPrimary(editModalName, e)}
                    disabled={settingPrimary === editModalName}
                    className="group flex flex-1 flex-col items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                      {settingPrimary === editModalName ? (
                        <Loader2 size={22} className="animate-spin text-[#00D179]" />
                      ) : (
                        <Star size={22} />
                      )}
                    </div>
                    <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Primary</span>
                  </button>
                )}

                {/* Renew - emerald color, only for non-permanent */}
                {getSelectedNameData() && !getSelectedNameData()!.isPermanent && (
                  <button
                    onClick={() => {
                      const name = editModalName;
                      closeEditModal();
                      if (name) setRenewModalName(name);
                    }}
                    disabled={renewingName === editModalName}
                    className="group flex flex-1 flex-col items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                      {renewingName === editModalName ? (
                        <Loader2 size={22} className="animate-spin text-[#00D179]" />
                      ) : (
                        <RefreshCw size={22} />
                      )}
                    </div>
                    <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Renew</span>
                  </button>
                )}

                {/* Share - default style */}
                <button
                  onClick={(e) => handleShare(editModalName, e)}
                  className="group flex flex-1 flex-col items-center gap-2 cursor-pointer"
                >
                  <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                    <Share2 size={22} />
                  </div>
                  <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Share</span>
                </button>

                {/* Edit - emerald active style */}
                <button
                  className="flex flex-1 flex-col items-center gap-2 cursor-default"
                >
                  <div className="text-[#00D179]">
                    <Pencil size={22} />
                  </div>
                  <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-[#00D179]">Edit</span>
                </button>

                {/* Transfer - default style */}
                <button
                  onClick={(e) => handleTransferClick(editModalName, e)}
                  className="group flex flex-1 flex-col items-center gap-2 cursor-pointer"
                >
                  <div className="text-gray-400 transition-all duration-200 group-hover:scale-110 group-hover:text-white">
                    <ArrowRight size={22} />
                  </div>
                  <span className="text-[8px] md:text-[10px] uppercase tracking-wider whitespace-nowrap text-gray-500 transition-colors duration-200 group-hover:text-white">Transfer</span>
                </button>
                </div>
              </div>

              {/* Profile Edit Fields */}
              <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-5">
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
                        className="w-full rounded-xl border border-white/5 bg-[#090909] px-4 py-3 text-base md:text-sm text-white outline-none transition-colors duration-200 focus:border-[#00D179]/40 placeholder:text-[#555555]"
                      />
                    </div>
                  ))}
                </div>

                {/* Cancel and Save All buttons */}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={handleCancelEditing}
                    disabled={savingAll}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-[#8A8A8A] transition-all duration-200 hover:border-white/20 hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveAll(editModalName)}
                    disabled={savingAll}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00D179] px-4 py-3 text-sm font-medium text-black transition-all duration-200 hover:bg-[#00B868] cursor-pointer disabled:opacity-50"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {transferModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            initial={modalBackdropVariants.hidden}
            animate={modalBackdropVariants.visible}
            exit={modalBackdropVariants.exit}
            onClick={() => {
              if (!transferring) {
                setTransferModal(null);
                setTransferSuccess(false);
              }
            }}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl"
              initial={modalContentVariants.hidden}
              animate={modalContentVariants.visible}
              exit={modalContentVariants.exit}
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
                        onClick={handleTransfer}
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

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalName && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            initial={modalBackdropVariants.hidden}
            animate={modalBackdropVariants.visible}
            exit={modalBackdropVariants.exit}
            onClick={() => setShareModalName(null)}
          >
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-white/10 bg-[#111111] p-6 shadow-2xl shadow-[#00D179]/10"
              initial={modalContentVariants.hidden}
              animate={modalContentVariants.visible}
              exit={modalContentVariants.exit}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent" />
              <div className="relative">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-clash text-2xl font-bold text-white">
                      {shareModalName}<span className="text-[#00D179]">.qf</span>
                    </h3>
                    <p className="mt-1 text-sm text-[#8A8A8A]">Share your on-chain identity</p>
                  </div>
                  <button
                    onClick={() => setShareModalName(null)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-[#8A8A8A] transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="rounded-2xl border border-white/5 bg-[#0C0C0C] p-4">
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleCopyLink}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D179] py-3 font-medium text-black transition-colors duration-200 hover:bg-[#00B868] cursor-pointer"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={handleShareX}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-white transition-colors duration-200 hover:bg-white/5 cursor-pointer"
                    >
                      <Twitter size={18} />
                      Share on X
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailModalOpen && selectedName && (() => {
          const ownedName = names.find(n => n.name === selectedName);
          if (!ownedName || !address || !providerType) return null;
          
          const records = cardRecords.get(selectedName) || {
            avatar: '', bio: '', twitter: '', telegram: '', website: '', email: ''
          } as { avatar: string; bio: string; twitter: string; telegram: string; website: string; email: string };

          return (
            <DetailModal
              name={selectedName}
              isOpen={detailModalOpen}
              defaultTab={detailTab}
              onClose={closeDetailModal}
              ownedName={ownedName}
              records={records}
              isPrimary={primaryName === selectedName}
              onSaveRecords={async (name, newRecords) => {
                // Convert to the format expected by handleSaveAll
                setEditValues(prev => ({ ...prev, [name]: newRecords }));
                await handleSaveAll(name);
              }}
              onSetPrimary={async (name) => {
                await handleSetPrimary(name, { stopPropagation: () => {} } as any);
              }}
              onRenew={async (name, years) => {
                await handleRenew(name, years);
              }}
              onTransfer={async (name, toAddress) => {
                setTransferModal(name);
                setTransferRecipient(toAddress);
                await handleTransfer();
              }}
              providerType={providerType}
              address={address}
            />
          );
        })()}
      </AnimatePresence>

      {/* Renew Modal */}
      <AnimatePresence>
        {renewModalName && (() => {
          const item = names.find(n => n.name === renewModalName);
          if (!item) return null;
          return (
            <RenewModal
              name={item.name}
              currentExpiry={item.expires}
              nameLength={item.name.length}
              onClose={() => setRenewModalName(null)}
              onConfirm={(years) => {
                setRenewModalName(null);
                handleRenew(item.name, years);
              }}
            />
          );
        })()}
      </AnimatePresence>

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

        /* Card hover effect */
        .name-card {
          will-change: transform;
        }

        /* Primary dot pulse animation */
        .primary-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background-color: #00D179;
          border-radius: 50%;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes pulse-dot {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.6;
          }
        }

        /* Permanent badge shimmer */
        .permanent-badge {
          background-image: linear-gradient(110deg, transparent 30%, rgba(0, 209, 121, 0.15) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: shimmer 4s infinite;
        }
      `}</style>
      <Footer />
    </div>
  );
}

export default MyNamesPage;
