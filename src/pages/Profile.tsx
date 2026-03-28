// src/pages/Profile.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { Gift, Share2, Check, Loader2, Twitter, Send, X, Copy } from 'lucide-react';
import { parseEther } from 'viem';
import type { FormEvent } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  getPublicClient,
  getRegistration,
  validateNameLocal,
  namehash,
  getWalletClient,
  getQFBalance,
  getSubstrateQFBalance,
  formatQF,
} from '../utils/qns';
import { useWalletStore } from '../stores/walletStore';
import {
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
} from '../config/contracts';
import { useCopy } from '../hooks/useCopy';
import { hapticTap, hapticGift } from '../utils/haptics';
import { DAPP_LAB_NAMES, TEAM_NAMES } from '../utils/badges';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../utils/errorHelpers';
import { useToast } from '../contexts/ToastContext';
import Avatar from '../components/Avatar';
import PulseDot from '../components/PulseDot';

// ── Types ──

interface ProfileData {
  name: string;
  address: string;
  avatar: string;
  bio: string;
  twitter: string;
  telegram: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
  exists: boolean;
}

interface LedgerEvent {
  label: string;
  detail?: string;
  date: string;
}

// ── Social link configurations (unchanged) ──

const SOCIAL_CONFIG = {
  twitter: {
    icon: <Twitter size={20} />,
    getUrl: (handle: string) => {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('x.com') || handle.includes('twitter.com')) return `https://${handle}`;
      return `https://x.com/${handle.replace(/^@/, '')}`;
    },
  },
  telegram: {
    icon: <Send size={20} />,
    getUrl: (handle: string) => {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('t.me')) return `https://${handle}`;
      return `https://t.me/${handle.replace(/^@/, '')}`;
    },
  },
};

// ── Helper: truncate address ──

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Helper: derive ledger events from profile data (no new API calls) ──

function deriveLedgerEvents(profile: ProfileData): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const regDate = new Date(Number(profile.registeredAt) * 1000);
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  events.push({
    label: profile.isPermanent ? 'Registered permanently' : 'Registered',
    date: formatDate(regDate),
  });

  if (profile.avatar) {
    events.push({ label: 'Avatar set', date: formatDate(regDate) });
  }
  if (profile.bio) {
    events.push({
      label: 'Bio updated',
      detail: `"${profile.bio.length > 40 ? profile.bio.slice(0, 40) + '...' : profile.bio}"`,
      date: formatDate(regDate),
    });
  }
  if (profile.twitter) {
    events.push({ label: 'X linked', date: formatDate(regDate) });
  }
  if (profile.telegram) {
    events.push({ label: 'Telegram linked', date: formatDate(regDate) });
  }

  return events;
}

// ── Provenance Panel ──

function ProvenancePanel({
  profile,
  onCopyAddress,
  addressCopied,
}: {
  profile: ProfileData;
  onCopyAddress: () => void;
  addressCopied: boolean;
}) {
  const node = namehash(`${profile.name}.qf`);
  const truncatedHash = node ? `${node.slice(0, 8)}...${node.slice(-4)}` : '';

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: 'OWNER',
      value: (
        <button
          onClick={onCopyAddress}
          className="group flex items-center gap-1.5 font-mono-addr text-xs text-[#888] hover:text-white transition-colors"
        >
          <span>{truncateAddress(profile.address)}</span>
          {addressCopied ? (
            <Check size={10} className="text-[#00D179]" />
          ) : (
            <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      ),
    },
    {
      label: 'REGISTERED',
      value: (
        <span className="font-mono-addr text-xs text-[#888]">
          {new Date(Number(profile.registeredAt) * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      label: 'STATUS',
      value: (
        <span className="flex items-center gap-1.5 text-xs">
          <PulseDot color={profile.isPermanent ? 'bg-[#00D179]' : 'bg-amber-400'} />
          <span className={profile.isPermanent ? 'text-[#00D179]' : 'text-amber-400'}>
            {profile.isPermanent ? 'Permanent' : `Expires ${new Date(Number(profile.expires) * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
          </span>
        </span>
      ),
    },
    {
      label: 'NAMEHASH',
      value: <span className="font-mono-addr text-xs text-[#555]">{truncatedHash}</span>,
    },
  ];

  return (
    <div className="space-y-0">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`py-3 ${i < rows.length - 1 ? 'border-b border-white/[0.03]' : ''}`}
        >
          <p className="text-[10px] font-medium tracking-[0.2em] text-[#333] mb-1.5 select-none">
            {row.label}
          </p>
          {row.value}
        </div>
      ))}
    </div>
  );
}

// ── Ledger Panel (git-log style) ──

function LedgerPanel({ events }: { events: LedgerEvent[] }) {
  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-[3px] top-3 bottom-3 w-px bg-white/[0.06]" />

      <div className="space-y-4">
        {events.map((event, i) => (
          <div key={i} className="relative">
            {/* Dot on the line */}
            <div className="absolute -left-4 top-[5px] w-[7px] h-[7px] rounded-full bg-[#00D179] ring-2 ring-[#0c0c0c]" />

            <p className="text-xs text-[#888] leading-tight">{event.label}</p>
            {event.detail && (
              <p className="text-[11px] text-[#444] mt-0.5 leading-tight">{event.detail}</p>
            )}
            <p className="text-[10px] text-[#333] mt-1">{event.date}</p>
          </div>
        ))}

        {/* Ghost entry if few events */}
        {events.length <= 2 && (
          <div className="relative">
            <div className="absolute -left-4 top-[5px] w-[7px] h-[7px] rounded-full bg-white/[0.04] ring-2 ring-[#0c0c0c]" />
            <p className="text-[11px] text-[#222] italic">What happens next is up to you</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bottom Bar: Visitor CTA with inline search ──

function VisitorCTA() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = searchValue.trim().toLowerCase().replace(/\.qf$/, '');
    if (cleaned) {
      navigate(`/?search=${encodeURIComponent(cleaned)}`);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4">
      <p className="text-sm text-[#555] shrink-0">
        Your name is waiting
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-56">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search a name"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 pr-12 text-sm text-white outline-none transition-all focus:border-[#00D179]/30 placeholder:text-[#333] font-satoshi"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00D179] text-xs font-medium select-none qf-suffix-live">
            .qf
          </span>
        </div>
        <button
          type="submit"
          className="shrink-0 px-4 py-2 rounded-lg bg-[#00D179] hover:bg-[#00B868] text-black text-sm font-semibold transition-colors"
        >
          Claim
        </button>
      </form>
    </div>
  );
}

function OwnerBar() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <p className="text-xs text-[#333]">QNS · Powered by QF Network</p>
      <button
        onClick={() => navigate('/my-names')}
        className="text-xs text-[#555] hover:text-[#00D179] transition-colors"
      >
        Edit profile
      </button>
    </div>
  );
}

// ══════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════

export default function ProfilePage() {
  const { name } = useParams<{ name: string }>();
  const { qnsName } = useWalletStore();
  const isOwnProfile =
    qnsName && name && qnsName.toLowerCase() === name.toLowerCase().replace(/\.qf$/, '');
  const showVisitorCTA = !isOwnProfile;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const { copy } = useCopy();
  const { showToast } = useToast();

  // Gift modal state (ALL PRESERVED EXACTLY AS-IS)
  const { address: senderAddress, ss58Address, connect, connecting, providerType } =
    useWalletStore();
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [senderBalance, setSenderBalance] = useState<bigint>(0n);
  const [isSending, setIsSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  type GiftPhase = 'idle' | 'signing' | 'inflight' | 'delivered' | 'success';
  const [giftPhase, setGiftPhase] = useState<GiftPhase>('idle');
  const [_txHash, setTxHash] = useState<string | null>(null);

  // 3D tilt + spotlight (preserved)
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia('(pointer: coarse)').matches);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gyroscope tilt for mobile (preserved exactly)
  useEffect(() => {
    if (!isMobile || !cardRef.current) return;
    let permissionGranted = false;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!cardRef.current) return;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const tiltX = Math.max(-4, Math.min(4, (beta - 45) * 0.08));
      const tiltY = Math.max(-4, Math.min(4, gamma * 0.08));
      rotateX.set(tiltX);
      rotateY.set(tiltY);
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({
          x: rect.width / 2 + gamma * 2,
          y: rect.height / 2 + (beta - 45) * 2,
        });
      }
    };
    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const perm = await (DeviceOrientationEvent as any).requestPermission();
          if (perm === 'granted') permissionGranted = true;
        } catch {
          return;
        }
      } else {
        permissionGranted = true;
      }
      if (permissionGranted) window.addEventListener('deviceorientation', handleOrientation);
    };
    requestPermission();
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isMobile]);

  // ── Data loading (preserved exactly) ──

  useEffect(() => {
    if (!name) return;
    const normalizedName = name.toLowerCase().trim().replace(/\.qf$/, '');
    const validation = validateNameLocal(normalizedName);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      setLoading(false);
      return;
    }
    loadProfile(normalizedName);
  }, [name]);

  const loadProfile = async (normalizedName: string) => {
    setLoading(true);
    setError(null);
    try {
      const client = getPublicClient();
      const node = namehash(`${normalizedName}.qf`);
      const registration = await getRegistration(normalizedName);
      if (!registration) {
        setProfile({
          name: normalizedName, address: '', avatar: '', bio: '', twitter: '', telegram: '',
          expires: 0n, registeredAt: 0n, isPermanent: false, exists: false,
        });
        setLoading(false);
        return;
      }
      const now = BigInt(Math.floor(Date.now() / 1000));
      const isPermanent = registration.expires === 0n;
      const isExpired = !isPermanent && registration.expires < now;
      if (isExpired) {
        setProfile({
          name: normalizedName, address: '', avatar: '', bio: '', twitter: '', telegram: '',
          expires: registration.expires, registeredAt: registration.registeredAt,
          isPermanent: false, exists: false,
        });
        setLoading(false);
        return;
      }
      const [addressRes, avatarRes, bioRes, twitterRes, telegramRes] = await Promise.all([
        client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'addr', args: [node] }).catch(() => ''),
        client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'avatar'] }).catch(() => ''),
        client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'bio'] }).catch(() => ''),
        client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'twitter'] }).catch(() => ''),
        client.readContract({ address: QNS_RESOLVER_ADDRESS, abi: QNS_RESOLVER_ABI, functionName: 'text', args: [node, 'telegram'] }).catch(() => ''),
      ]);
      setProfile({
        name: normalizedName,
        address: (addressRes as string) === '0x0000000000000000000000000000000000000000' ? registration.owner : (addressRes as string),
        avatar: (avatarRes as string) || '', bio: (bioRes as string) || '',
        twitter: (twitterRes as string) || '', telegram: (telegramRes as string) || '',
        expires: registration.expires, registeredAt: registration.registeredAt,
        isPermanent, exists: true,
      });
    } catch {
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Interaction handlers (preserved exactly) ──

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!isMobile) {
      rotateX.set(((rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2)) * 5);
      rotateY.set((((e.clientX - rect.left) - rect.width / 2) / (rect.width / 2)) * 5);
    }
  };
  const handleMouseLeave = () => { rotateX.set(0); rotateY.set(0); };

  const handleShare = () => {
    if (!profile) return;
    copy(`https://dotqf.xyz/name/${profile.name}`, false);
    hapticTap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAddress = () => {
    if (!profile?.address) return;
    copy(profile.address, false);
    hapticTap();
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // ── Gift modal handlers (ALL PRESERVED EXACTLY) ──

  const balanceAddress = providerType === 'evm' ? senderAddress : (ss58Address || senderAddress);

  useEffect(() => {
    if (!giftModalOpen) return;
    const fetchBalance = async () => {
      try {
        if (providerType === 'evm' && senderAddress) {
          const { evmGetBalance } = await import('../utils/evmContractCall');
          setSenderBalance(await evmGetBalance(senderAddress)); return;
        }
        if (ss58Address) {
          const bal = await getSubstrateQFBalance(ss58Address);
          if (bal > 0n) { setSenderBalance(bal); return; }
        }
        if (senderAddress) { setSenderBalance(await getQFBalance(senderAddress)); return; }
        setSenderBalance(0n);
      } catch { setSenderBalance(0n); }
    };
    fetchBalance();
  }, [giftModalOpen, ss58Address, senderAddress, providerType]);

  const openGiftModal = () => { hapticTap(); setGiftModalOpen(true); };
  const closeGiftModal = () => {
    setGiftModalOpen(false); setGiftAmount(''); setGiftError(null);
    setIsSending(false); setGiftPhase('idle');
  };
  const handleQuickSelect = (amount: number) => { setGiftAmount(amount.toString()); setGiftError(null); };
  const sendDisabled = !giftAmount || parseFloat(giftAmount) <= 0 || (balanceAddress && parseEther(giftAmount) + 500000000000000000n > senderBalance);

  const handleSendGift = async () => {
    if (!senderAddress || !profile?.address || !giftAmount) return;
    if (sendDisabled) return;
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) { setGiftError('Please enter a valid amount'); return; }
    if (!balanceAddress) { setGiftError('No wallet connected'); return; }
    let balance = 0n;
    try {
      if (providerType === 'evm') {
        const { evmGetBalance } = await import('../utils/evmContractCall');
        balance = await evmGetBalance(senderAddress);
      } else if (ss58Address) {
        balance = await getSubstrateQFBalance(ss58Address);
        if (balance === 0n && senderAddress) balance = await getQFBalance(senderAddress);
      } else if (senderAddress) { balance = await getQFBalance(senderAddress); }
    } catch { balance = 0n; }
    if (balance < parseEther(giftAmount) + 500000000000000000n) { setGiftError('Insufficient QF balance'); return; }
    setIsSending(true); setGiftError(null); setGiftPhase('signing');
    try {
      let txHash: string | undefined;
      let confirmation: Promise<{ confirmed: boolean; error?: string }>;
      if (providerType === 'evm') {
        const { evmSendTransfer } = await import('../utils/evmContractCall');
        const result = await evmSendTransfer(profile.address, parseEther(giftAmount), async () => true);
        txHash = result.txHash; confirmation = result.confirmation;
      } else {
        const walletClient = getWalletClient();
        if (!walletClient) throw new Error('No wallet connected');
        const result = await walletClient.sendTransaction({
          to: profile.address as `0x${string}`, value: parseEther(giftAmount),
          account: ss58Address || senderAddress, verifyOnChain: async () => true,
        });
        txHash = result.txHash; confirmation = result.confirmation;
      }
      setGiftPhase('inflight'); hapticTap();
      setTimeout(() => { setGiftPhase('delivered'); hapticGift(); }, 1800);
      setTimeout(() => { setGiftPhase('success'); }, 3500);
      setTxHash(txHash || null);
      confirmation.then((result) => {
        if (result.confirmed) return;
        if (result.error === 'not_confirmed') { setGiftError('Gift submitted but not yet confirmed on-chain. It may still arrive shortly.'); return; }
        if (result.error && isRetryableError(result.error)) { setGiftPhase('idle'); setGiftError(RETRY_MESSAGE_SHORT); showToast(RETRY_MESSAGE_SHORT, 'warning'); return; }
        setGiftPhase('idle'); setGiftError(`Gift failed on-chain: ${result.error}. Your balance was not deducted.`);
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (isRetryableError(msg)) { setGiftPhase('idle'); setGiftError(RETRY_MESSAGE_SHORT); showToast(RETRY_MESSAGE_SHORT, 'warning'); return; }
      if (msg.includes('rejected') || msg.includes('Rejected') || msg.includes('Cancelled') || msg.includes('cancelled')) { setGiftPhase('idle'); setGiftError('Transaction cancelled.'); }
      else { setGiftPhase('idle'); setGiftError(msg || 'Transaction failed. Please try again.'); }
    } finally { setIsSending(false); }
  };

  const handleShareGiftOnX = () => {
    if (!profile || !giftAmount) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just gifted ${giftAmount} QF to ${profile.name}.qf on @dotqfns powered by @theqfnetwork`)}`, '_blank');
  };

  // ── Meta tags (preserved exactly) ──

  useEffect(() => {
    if (profile?.name) {
      document.title = `${profile.name}.qf · QNS Profile`;
      const setMetaTag = (property: string, content: string, attr: 'property' | 'name' = 'property') => {
        let tag = document.querySelector(`meta[${attr}="${property}"]`);
        if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attr, property); document.head.appendChild(tag); }
        tag.setAttribute('content', content);
      };
      const profileUrl = `https://dotqf.xyz/name/${profile.name}`;
      const dynamicOgImage = `https://dotqf.xyz/api/og/${profile.name}.png`;
      setMetaTag('og:title', `${profile.name}.qf`);
      setMetaTag('og:description', profile.bio || 'A QNS identity on QF Network');
      setMetaTag('og:image', dynamicOgImage);
      setMetaTag('og:url', profileUrl);
      setMetaTag('og:type', 'profile');
      setMetaTag('twitter:card', 'summary_large_image', 'name');
      setMetaTag('twitter:title', `${profile.name}.qf · QNS`, 'name');
      setMetaTag('twitter:description', profile.bio || 'A QNS identity on QF Network', 'name');
      setMetaTag('twitter:image', dynamicOgImage, 'name');
      return () => {
        ['og:title','og:description','og:image','og:url','og:type','twitter:card','twitter:title','twitter:description','twitter:image'].forEach(tag => {
          const el = document.querySelector(`meta[property="${tag}"], meta[name="${tag}"]`); if (el) el.remove();
        });
        document.title = 'QNS · Quantum Fusion Name System';
      };
    }
  }, [profile?.name, profile?.bio, profile?.avatar]);

  // ═══════════════════════════════════════
  // ── RENDER: Loading skeleton ──
  // ═══════════════════════════════════════

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12 pt-24">
          <div className="w-full max-w-5xl rounded-2xl border border-white/[0.04] bg-[#0c0c0c] overflow-hidden animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px]">
              {/* Left skeleton */}
              <div className="hidden md:block p-5 border-r border-white/[0.04]">
                <div className="space-y-6">
                  {[1,2,3,4].map(i => (
                    <div key={i}>
                      <div className="h-2 w-12 rounded bg-white/[0.04] mb-2" />
                      <div className="h-3 w-24 rounded bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Center skeleton */}
              <div className="p-8">
                <div className="h-8 w-48 mx-auto rounded bg-white/[0.06] mb-6" />
                <div className="w-[120px] h-[120px] rounded-full bg-white/[0.06] mx-auto mb-4" />
                <div className="h-4 w-56 mx-auto rounded bg-white/[0.04] mb-2" />
                <div className="h-4 w-40 mx-auto rounded bg-white/[0.04]" />
              </div>
              {/* Right skeleton */}
              <div className="hidden md:block p-5 border-l border-white/[0.04]">
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i}><div className="h-3 w-28 rounded bg-white/[0.04] mb-1" /><div className="h-2 w-16 rounded bg-white/[0.03]" /></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ═══════════════════════════════════════
  // ── RENDER: Ghost state (unclaimed / expired / error) ──
  // ═══════════════════════════════════════

  if (!loading && (error || !profile?.exists)) {
    const displayName = name?.replace(/\.qf$/, '') || '';
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 pt-24 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-5xl rounded-2xl border border-white/[0.04] bg-[#0c0c0c] overflow-hidden"
          >
            {/* Noise overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            }} />

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px] relative">
              {/* Left: Ghost provenance */}
              <div className="hidden md:block p-5 border-r border-white/[0.03]">
                <div className="py-3">
                  <p className="text-[10px] font-medium tracking-[0.2em] text-[#222] mb-1.5">STATUS</p>
                  <span className="flex items-center gap-1.5 text-xs text-red-400/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400/40" />
                    Unclaimed
                  </span>
                </div>
                <div className="py-3 border-t border-white/[0.03]">
                  <p className="text-[10px] font-medium tracking-[0.2em] text-[#222] mb-1.5">AVAILABLE</p>
                  <span className="text-xs text-[#00D179]">Yes</span>
                </div>
              </div>

              {/* Center: Ghost card */}
              <div className="py-12 px-6 text-center">
                <h1 className="font-clash text-4xl md:text-5xl font-bold text-white/15 mb-6">
                  {displayName}<span className="text-[#00D179]/15">.qf</span>
                </h1>
                <div className="w-[120px] h-[120px] rounded-full bg-white/[0.02] border-4 border-[#0c0c0c] mx-auto flex items-center justify-center mb-6">
                  <span className="text-3xl font-bold text-white/[0.06]">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <p className="text-[#333] text-sm mb-8">
                  {error || 'This name has never been claimed'}
                </p>
                {!error && (
                  <Link
                    to={`/?search=${encodeURIComponent(displayName)}`}
                    className="inline-block px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors"
                  >
                    Claim {displayName}.qf
                  </Link>
                )}
              </div>

              {/* Right: Empty ledger */}
              <div className="hidden md:block p-5 border-l border-white/[0.03]">
                <p className="text-[11px] text-[#1a1a1a] italic">No history yet</p>
              </div>
            </div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  // Guard
  if (!profile) return null;

  const isDappLab = DAPP_LAB_NAMES.includes(profile.name.toLowerCase());
  const isTeam = TEAM_NAMES.includes(profile.name.toLowerCase());
  const hasSocials = profile.twitter || profile.telegram;
  const ledgerEvents = deriveLedgerEvents(profile);

  // ═══════════════════════════════════════
  // ── RENDER: Full profile (The Inspector) ──
  // ═══════════════════════════════════════

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12 pt-24">
        {/* Ambient glow behind the frame */}
        <div className="relative w-full max-w-5xl">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none -z-10"
            style={{ background: 'radial-gradient(ellipse, rgba(0,209,121,0.03) 0%, transparent 70%)' }}
          />

          {/* ── Inspector Frame ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.6 }}
            className="w-full rounded-2xl border border-white/[0.06] bg-[#0c0c0c] overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px]">

              {/* ── Left: Provenance ── */}
              <div className="hidden md:block p-5 border-r border-white/[0.04]">
                <ProvenancePanel
                  profile={profile}
                  onCopyAddress={handleCopyAddress}
                  addressCopied={addressCopied}
                />
              </div>

              {/* ── Center: Identity Card ── */}
              <motion.div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  rotateX: springRotateX,
                  rotateY: springRotateY,
                  transformPerspective: 1200,
                }}
                className="relative py-8 px-6"
              >
                {/* Spotlight */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(500px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,209,121,0.05), transparent 40%)`,
                  }}
                />

                {/* Action icons — top right */}
                <div className="absolute top-4 right-4 flex gap-2 z-20">
                  <button
                    onClick={openGiftModal}
                    className="w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                    title="Send QF"
                  >
                    <Gift className="w-[22px] h-[22px] text-[#666] hover:text-white transition-colors" />
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors relative"
                    title={copied ? 'Copied!' : 'Share'}
                  >
                    {copied ? (
                      <Check className="w-[22px] h-[22px] text-[#00D179]" />
                    ) : (
                      <Share2 className="w-[22px] h-[22px] text-[#666] hover:text-white transition-colors" />
                    )}
                  </button>
                </div>

                {/* Name */}
                <div className="text-center mb-6 pt-2">
                  <h1 className="font-clash text-4xl md:text-5xl font-bold text-white">
                    {profile.name}<span className="text-[#00D179]">.qf</span>
                  </h1>
                </div>

                {/* Avatar */}
                <div className="flex justify-center mb-5">
                  <div className="border-4 border-[#0c0c0c] rounded-full">
                    <Avatar url={profile.avatar} name={profile.name} size={120} />
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="text-[#999] text-center text-sm max-w-xs mx-auto mb-4 leading-relaxed">
                    {profile.bio}
                  </p>
                )}

                {/* Social icons */}
                {hasSocials && (
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {profile.twitter && (
                      <a
                        href={SOCIAL_CONFIG.twitter.getUrl(profile.twitter)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center text-[#666] hover:bg-white/[0.08] hover:text-white transition-colors"
                      >
                        {SOCIAL_CONFIG.twitter.icon}
                      </a>
                    )}
                    {profile.telegram && (
                      <a
                        href={SOCIAL_CONFIG.telegram.getUrl(profile.telegram)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center text-[#666] hover:bg-white/[0.08] hover:text-white transition-colors"
                      >
                        {SOCIAL_CONFIG.telegram.icon}
                      </a>
                    )}
                  </div>
                )}

                {/* Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  {profile.isPermanent && (
                    <span className="permanent-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      Permanent
                    </span>
                  )}
                  {isDappLab && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      dApp Lab
                    </span>
                  )}
                  {isTeam && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      Team
                    </span>
                  )}
                </div>

                {/* Mobile-only: Provenance strip + Ledger (below card) */}
                <div className="md:hidden mt-8">
                  {/* Compact provenance strip */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 mb-4">
                    <div>
                      <p className="text-[9px] tracking-[0.2em] text-[#333] mb-1">OWNER</p>
                      <p className="font-mono-addr text-[11px] text-[#888]">{truncateAddress(profile.address)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-[0.2em] text-[#333] mb-1">STATUS</p>
                      <p className="flex items-center gap-1 text-[11px]">
                        <PulseDot color={profile.isPermanent ? 'bg-[#00D179]' : 'bg-amber-400'} />
                        <span className={profile.isPermanent ? 'text-[#00D179]' : 'text-amber-400'}>
                          {profile.isPermanent ? 'Permanent' : 'Annual'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-[0.2em] text-[#333] mb-1">REGISTERED</p>
                      <p className="font-mono-addr text-[11px] text-[#888]">
                        {new Date(Number(profile.registeredAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-[0.2em] text-[#333] mb-1">NAMEHASH</p>
                      <p className="font-mono-addr text-[11px] text-[#555]">
                        {(() => { const h = namehash(`${profile.name}.qf`); return `${h.slice(0,6)}...${h.slice(-3)}`; })()}
                      </p>
                    </div>
                  </div>

                  {/* Compact ledger */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4">
                    <LedgerPanel events={ledgerEvents} />
                  </div>
                </div>
              </motion.div>

              {/* ── Right: Ledger ── */}
              <div className="hidden md:block p-5 border-l border-white/[0.04]">
                <LedgerPanel events={ledgerEvents} />
              </div>
            </div>

            {/* ── Bottom Bar ── */}
            <div className="border-t border-white/[0.04]">
              {showVisitorCTA && profile.exists ? <VisitorCTA /> : <OwnerBar />}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Gift Modal (ENTIRELY PRESERVED) ── */}
      <AnimatePresence>
        {giftModalOpen && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={closeGiftModal}
            onKeyDown={(e) => { if (e.key === 'Escape') closeGiftModal(); }}
            tabIndex={-1}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-clash text-xl font-bold text-white">
                    {giftPhase === 'idle' ? 'Send Gift' : giftPhase === 'signing' ? 'Confirming...' : giftPhase === 'inflight' ? 'Sending...' : giftPhase === 'delivered' ? 'Delivered' : 'Gift Sent!'}
                  </h3>
                  <button onClick={closeGiftModal} className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {giftPhase === 'idle' && (
                    <motion.div key="gift-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                      <div className="mb-6">
                        <label className="mb-2 block text-xs text-gray-500">Recipient</label>
                        <input type="text" value={`${profile.name}.qf`} readOnly className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400 outline-none cursor-not-allowed" />
                      </div>
                      {!senderAddress ? (
                        <div className="text-center py-4">
                          <p className="text-gray-500 mb-4">Connect wallet to send a gift</p>
                          <button onClick={connect} disabled={connecting} className="inline-flex items-center gap-2 rounded-xl bg-[#00D179] px-6 py-3 font-medium text-black transition-all duration-200 hover:bg-[#00B868] active:scale-95 disabled:opacity-50">
                            {connecting ? <Loader2 size={18} className="animate-spin" /> : null}
                            {connecting ? 'Connecting...' : 'Connect Wallet'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <label className="mb-2 block text-xs text-gray-500">Amount (QF)</label>
                            <div className="relative">
                              <input type="number" value={giftAmount} onChange={(e) => { setGiftAmount(e.target.value); setGiftError(null); }} placeholder="Enter amount" min="0" step="0.01" className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 pr-12 text-base md:text-sm text-white outline-none transition-all duration-200 focus:border-[#00D179]/50 focus:ring-1 focus:ring-[#00D179]/20 placeholder:text-gray-600" />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">QF</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-4">
                            {[10, 50, 100, 500].map((amt) => (
                              <button key={amt} onClick={() => handleQuickSelect(amt)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${giftAmount === amt.toString() ? 'bg-[#00D179] text-black' : 'bg-white/5 text-gray-400 hover:text-[#00D179] hover:bg-white/10'}`}>{amt}</button>
                            ))}
                          </div>
                          <div className="mb-4 text-center"><span className="text-sm text-gray-500">Your balance: <span className="text-white font-medium">{formatQF(senderBalance)} QF</span></span></div>
                          {giftError && <p className="text-center text-red-400 text-sm mb-4">{giftError}</p>}
                          <button onClick={handleSendGift} disabled={isSending || sendDisabled || false} className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${isSending || sendDisabled ? 'bg-[#00D179]/50 text-black/50 cursor-not-allowed' : 'bg-[#00D179] hover:bg-[#00B868] text-black cursor-pointer'}`}>
                            {isSending ? <Loader2 size={18} className="animate-spin" /> : null}
                            {isSending ? 'Sending...' : 'Send Gift'}
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                  {giftPhase === 'signing' && (
                    <motion.div key="gift-signing" className="text-center py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="relative inline-block mb-5"><div className="w-12 h-12 border-[3px] border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-2 h-2 bg-[#00D179] rounded-full animate-pulse" /></div></div>
                      <p className="text-white font-medium mb-1">Confirm in your wallet</p>
                      <p className="text-[#555] text-sm">Sending {giftAmount} QF to {profile.name}.qf</p>
                    </motion.div>
                  )}
                  {giftPhase === 'inflight' && (
                    <motion.div key="gift-inflight" className="text-center py-10" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                      <div className="relative flex items-center justify-center mb-6">
                        <motion.div className="absolute w-20 h-20 rounded-full bg-[#00D179]/10" animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="relative w-16 h-16 flex items-center justify-center">
                          <motion.svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <motion.rect x="3" y="8" width="18" height="13" rx="2" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                            <motion.rect x="2" y="4" width="20" height="4" rx="1" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }} />
                            <motion.line x1="12" y1="4" x2="12" y2="21" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5 }} />
                            <motion.line x1="3" y1="12" x2="21" y2="12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.6 }} />
                          </motion.svg>
                        </motion.div>
                      </div>
                      <motion.p className="text-[#00D179] font-medium mb-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>Sending to {profile.name}.qf</motion.p>
                      <motion.p className="text-[#555] text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{giftAmount} QF on its way</motion.p>
                    </motion.div>
                  )}
                  {(giftPhase === 'delivered' || giftPhase === 'success') && (
                    <motion.div key="gift-success" className="text-center py-10" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="relative flex items-center justify-center mb-5">
                        <motion.div className="w-16 h-16 rounded-full bg-[#00D179]/10 flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}>
                          <Check className="w-8 h-8 text-[#00D179]" />
                        </motion.div>
                      </div>
                      <p className="text-white font-medium mb-1">{giftAmount} QF delivered</p>
                      <p className="text-[#555] text-sm mb-6">to {profile.name}.qf</p>
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={handleShareGiftOnX} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white hover:bg-white/10 transition-colors">Share on X</button>
                        <button onClick={closeGiftModal} className="px-4 py-2 rounded-lg bg-[#00D179] text-sm text-black font-semibold hover:bg-[#00B868] transition-colors">Done</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
