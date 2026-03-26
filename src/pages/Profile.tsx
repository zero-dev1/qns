import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { Gift, Share2, Check, ArrowLeft, Loader2, Twitter, Send, X } from 'lucide-react';
import { parseEther } from 'viem';
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
import { hapticTap } from '../utils/haptics';
import { DAPP_LAB_NAMES, TEAM_NAMES } from '../utils/badges';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../utils/errorHelpers';
import { useToast } from '../contexts/ToastContext';

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

// Avatar component with fallback to initials
const Avatar = ({
  url,
  name,
  size = 96,
}: {
  url?: string;
  name: string;
  size?: number;
}) => {
  const [imageError, setImageError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();

  useEffect(() => {
    setImageError(false);
  }, [url]);

  if (url && !imageError) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-[#00D179] to-[#00A060] font-bold text-white text-2xl"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

// Social link configurations
const SOCIAL_CONFIG = {
  twitter: {
    icon: <Twitter size={18} />,
    getUrl: (handle: string) => {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('x.com') || handle.includes('twitter.com')) return `https://${handle}`;
      return `https://x.com/${handle.replace(/^@/, '')}`;
    },
  },
  telegram: {
    icon: <Send size={18} />,
    getUrl: (handle: string) => {
      if (handle.startsWith('http')) return handle;
      if (handle.includes('t.me')) return `https://${handle}`;
      return `https://t.me/${handle.replace(/^@/, '')}`;
    },
  },
};

export default function ProfilePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { qnsName } = useWalletStore();
  const showVisitorCTA = !qnsName; // Show if visitor has no .qf name
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { copy } = useCopy();
  const { showToast } = useToast();
  
  // Gift modal state
  const { address: senderAddress, ss58Address, connect, connecting } = useWalletStore();
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [senderBalance, setSenderBalance] = useState<bigint>(0n);
  const [isSending, setIsSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState(false);
  const [_txHash, setTxHash] = useState<string | null>(null);

  // Mouse position for spotlight effect
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // 3D tilt motion values
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  // Check if mobile for disabling tilt
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(pointer: coarse)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add shimmer animation styles
  useEffect(() => {
    const styleId = 'profile-shimmer-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .permanent-badge {
          background-image: linear-gradient(110deg, transparent 30%, rgba(0, 209, 121, 0.15) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: shimmer 4s infinite;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, []);

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
          name: normalizedName,
          address: '',
          avatar: '',
          bio: '',
          twitter: '',
          telegram: '',
          expires: 0n,
          registeredAt: 0n,
          isPermanent: false,
          exists: false,
        });
        setLoading(false);
        return;
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const isPermanent = registration.expires === 0n;
      const isExpired = !isPermanent && registration.expires < now;

      if (isExpired) {
        setProfile({
          name: normalizedName,
          address: '',
          avatar: '',
          bio: '',
          twitter: '',
          telegram: '',
          expires: registration.expires,
          registeredAt: registration.registeredAt,
          isPermanent: false,
          exists: false,
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
      const address = addressRes as string;
      const avatar = avatarRes as string;
      const bio = bioRes as string;
      const twitter = twitterRes as string;
      const telegram = telegramRes as string;

      setProfile({
        name: normalizedName,
        address: address === '0x0000000000000000000000000000000000000000' ? registration.owner : address,
        avatar: avatar || '',
        bio: bio || '',
        twitter: twitter || '',
        telegram: telegram || '',
        expires: registration.expires,
        registeredAt: registration.registeredAt,
        isPermanent,
        exists: true,
      });
    } catch (err) {
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Spotlight and tilt effect handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });

    if (isMobile) return;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateYValue = ((x - centerX) / centerX) * 5;
    const rotateXValue = ((centerY - y) / centerY) * 5;

    rotateX.set(rotateXValue);
    rotateY.set(rotateYValue);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const handleShare = () => {
    if (!profile) return;
    const url = `https://dotqf.xyz/name/${profile.name}`;
    copy(url, false);
    hapticTap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get the address to use for balance queries
  const balanceAddress = ss58Address || senderAddress;

  // Fetch balance when modal opens or address changes
  useEffect(() => {
    if (!giftModalOpen) return;
    
    const fetchBalance = async () => {
      try {
        // Prefer SS58 path (Substrate native) — this is the reliable source
        if (ss58Address) {
          const bal = await getSubstrateQFBalance(ss58Address);
          if (bal > 0n) {
            setSenderBalance(bal);
            return;
          }
        }
        // Fallback to EVM path
        if (senderAddress) {
          const bal = await getQFBalance(senderAddress);
          setSenderBalance(bal);
          return;
        }
        setSenderBalance(0n);
      } catch {
        setSenderBalance(0n);
      }
    };
    
    fetchBalance();
  }, [giftModalOpen, ss58Address, senderAddress]);

  // Gift modal handlers
  const openGiftModal = async () => {
    hapticTap();
    setGiftModalOpen(true);
  };

  const closeGiftModal = () => {
    setGiftModalOpen(false);
    setGiftAmount('');
    setGiftError(null);
    setIsSending(false);
    setGiftSuccess(false);
  };

  const handleQuickSelect = (amount: number) => {
    setGiftAmount(amount.toString());
    setGiftError(null);
  };

  // Calculate if send button should be disabled
  const sendDisabled = !giftAmount || parseFloat(giftAmount) <= 0 || (balanceAddress && parseEther(giftAmount) + 500000000000000000n > senderBalance);

  const handleSendGift = async () => {
    if (!senderAddress || !profile?.address || !giftAmount) return;
    
    // Early return if button should be disabled
    if (sendDisabled) return;
    
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) {
      setGiftError('Please enter a valid amount');
      return;
    }

    // Check balance
    if (!balanceAddress) {
      setGiftError('No wallet connected');
      return;
    }
    const balance = await getQFBalance(balanceAddress);
    const requiredAmount = parseEther(giftAmount);
    const gasBuffer = 500000000000000000n; // 0.5 QF
    
    if (balance < requiredAmount + gasBuffer) {
      setGiftError('Insufficient QF balance');
      return;
    }

    setIsSending(true);
    setGiftError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');

      const signerAddress = ss58Address || senderAddress;
      const { txHash, confirmation } = await walletClient.sendTransaction({
        to: profile.address as `0x${string}`,
        value: requiredAmount,
        account: signerAddress,
        verifyOnChain: async () => {
          // For gifts, the confirmation event itself is sufficient.
          // We can't easily verify balance changes without knowing the exact prior balance.
          return true; // rely on PAPI event, not balance check
        },
      });

      setTxHash(txHash);
      setGiftSuccess(true);

      // Background confirmation
      confirmation.then((result) => {
        if (result.confirmed) return;
        if (result.error === 'not_confirmed') {
          setGiftError('Gift submitted but not yet confirmed on-chain. It may still arrive shortly.');
          return;
        }
        // Check if this is a retryable error
        if (result.error && isRetryableError(result.error)) {
          setGiftSuccess(false);
          setGiftError(RETRY_MESSAGE_SHORT);
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          return;
        }
        // Hard failure
        setGiftSuccess(false);
        setGiftError(`Gift failed on-chain: ${result.error}. Your balance was not deducted.`);
      });
    } catch (err: any) {
      console.error('Gift send error:', err);
      const msg = err?.message ?? String(err);
      
      // Check if this is a retryable error
      if (isRetryableError(msg)) {
        setGiftError(RETRY_MESSAGE_SHORT);
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        return;
      }
      
      if (msg.includes('rejected') || msg.includes('Rejected') || msg.includes('Cancelled') || msg.includes('cancelled')) {
        setGiftError('Transaction cancelled.');
      } else {
        setGiftError(msg || 'Transaction failed. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleShareGiftOnX = () => {
    if (!profile || !giftAmount) return;
    const text = `Just gifted ${giftAmount} QF to ${profile.name}.qf on @dotqfns powered by @theqfnetwork`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Update page title and meta tags
  useEffect(() => {
    if (profile?.name) {
      document.title = `${profile.name}.qf — QNS Profile`;

      const setMetaTag = (property: string, content: string, attr: 'property' | 'name' = 'property') => {
        let tag = document.querySelector(`meta[${attr}="${property}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute(attr, property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      const profileUrl = `https://dotqf.xyz/name/${profile.name}`;
      const defaultImage = 'https://dotqf.xyz/og-image.png';

      setMetaTag('og:title', `${profile.name}.qf`);
      setMetaTag('og:description', profile.bio || 'A QNS identity on QF Network');
      setMetaTag('og:image', profile.avatar || defaultImage);
      setMetaTag('og:url', profileUrl);
      setMetaTag('og:type', 'profile');
      setMetaTag('twitter:card', 'summary', 'name');
      setMetaTag('twitter:title', `${profile.name}.qf — QNS`, 'name');
      setMetaTag('twitter:description', profile.bio || 'A QNS identity on QF Network', 'name');
      setMetaTag('twitter:image', profile.avatar || defaultImage, 'name');

      return () => {
        const tagsToRemove = [
          'og:title', 'og:description', 'og:image', 'og:url', 'og:type',
          'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'
        ];
        tagsToRemove.forEach(tag => {
          const el = document.querySelector(`meta[property="${tag}"], meta[name="${tag}"]`);
          if (el) el.remove();
        });
        document.title = 'QNS — Quantum Fusion Name System';
      };
    }
  }, [profile?.name, profile?.bio, profile?.avatar]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-black overflow-hidden animate-pulse">
          {/* Header skeleton */}
          <div className="h-32 bg-gradient-to-b from-white/[0.03] to-transparent" />
          <div className="px-6 pb-6">
            {/* Avatar skeleton */}
            <div className="flex justify-center -mt-6 mb-4">
              <div className="w-24 h-24 rounded-full bg-white/[0.06]" />
            </div>
            {/* Name skeleton */}
            <div className="h-7 w-40 mx-auto rounded bg-white/[0.06] mb-3" />
            {/* Bio skeleton */}
            <div className="h-4 w-56 mx-auto rounded bg-white/[0.04] mb-2" />
            <div className="h-4 w-44 mx-auto rounded bg-white/[0.04] mb-6" />
            {/* Badge skeleton */}
            <div className="flex justify-center gap-2">
              <div className="h-6 w-20 rounded-full bg-white/[0.04]" />
              <div className="h-6 w-16 rounded-full bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile?.exists) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-sm">
          {/* Show the name prominently even though it's unclaimed */}
          {name && !error && (
            <p className="font-clash font-semibold text-2xl text-white mb-2">
              {name.replace(/\.qf$/, '')}<span className="text-[#00D179]">.qf</span>
            </p>
          )}
          <p className="text-[#555] mb-6">{error || 'This name hasn\'t been claimed yet'}</p>
          
          {/* If name is valid and unclaimed, offer to register it */}
          {!error && name && (
            <Link
              to={`/?search=${encodeURIComponent(name.replace(/\.qf$/, ''))}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors duration-200"
            >
              Register {name.replace(/\.qf$/, '')}<span>.qf</span>
            </Link>
          )}
          
          <Link
            to="/"
            className="block mt-4 text-sm text-[#555] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} className="inline mr-1" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const isDappLab = DAPP_LAB_NAMES.includes(profile.name.toLowerCase());
  const isTeam = TEAM_NAMES.includes(profile.name.toLowerCase());
  const hasSocials = profile.twitter || profile.telegram;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
      {/* Back to home link */}
      <Link
        to="/"
        className="fixed top-6 left-6 flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors z-50"
      >
        <ArrowLeft size={16} />
        Back to home
      </Link>

      {/* Profile Card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.6 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: isMobile ? 0 : springRotateX,
          rotateY: isMobile ? 0 : springRotateY,
          transformPerspective: 1000,
        }}
        className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-black overflow-hidden"
      >
        {/* Spotlight effect overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,209,121,0.06), transparent 40%)`,
          }}
        />

        {/* Emerald glow header */}
        <div className="relative h-32 bg-gradient-to-b from-[#00D179]/10 via-[#00D179]/5 to-transparent">
          {/* Action buttons - top right, above name */}
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <button
              onClick={openGiftModal}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              title="Send Gift"
            >
              <Gift className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors relative"
              title={copied ? 'Copied!' : 'Share'}
            >
              {copied ? (
                <Check className="w-5 h-5 text-[#00D179]" />
              ) : (
                <Share2 className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              )}
            </button>
          </div>
          {/* Name in header - below icons */}
          <div className="absolute inset-0 flex items-center justify-center pt-8">
            <h1 className="text-3xl font-bold text-white truncate px-12">
              {profile.name}
              <span className="text-[#00D179]">.qf</span>
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 relative z-10">
          {/* Avatar - overlapping header */}
          <div className="flex justify-center -mt-6 mb-4">
            <div className="border-4 border-black rounded-full">
              <Avatar url={profile.avatar} name={profile.name} size={96} />
            </div>
          </div>

          {/* Bio */}
          <p className="text-gray-400 text-center text-sm max-w-xs mx-auto mt-4">
            {profile.bio || '—'}
          </p>

          {/* Social icons */}
          {hasSocials && (
            <div className="flex items-center justify-center gap-3 mt-4">
              {profile.twitter && (
                <a
                  href={SOCIAL_CONFIG.twitter.getUrl(profile.twitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {SOCIAL_CONFIG.twitter.icon}
                </a>
              )}
              {profile.telegram && (
                <a
                  href={SOCIAL_CONFIG.telegram.getUrl(profile.telegram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {SOCIAL_CONFIG.telegram.icon}
                </a>
              )}
            </div>
          )}

          {/* Member since - OG flex for early adopters */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Member since {new Date(Number(profile.registeredAt) * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile.isPermanent && (
              <span className="permanent-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Permanent
              </span>
            )}
            {isDappLab && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                dApp Lab
              </span>
            )}
            {isTeam && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Team
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 my-5" />

          {/* Footer inside card */}
          <p className="text-center text-xs text-gray-600">
            QNS. • Powered by QF Network
          </p>
        </div>
      </motion.div>

      {/* Visitor CTA — nudge viewers to register their own */}
      {showVisitorCTA && profile?.exists && (
        <motion.div
          className="mt-8 w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="rounded-2xl border border-white/[0.06] bg-[#111]/80 backdrop-blur-sm p-6 text-center">
            <p className="text-[#666] text-sm mb-1">Want your own identity on QF Network?</p>
            <p className="text-white font-medium mb-4">
              Claim your <span className="text-[#00D179]">.qf</span> name in seconds
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors duration-200 cursor-pointer"
            >
              Register a name
            </button>
          </div>
        </motion.div>
      )}

      {/* Gift Modal */}
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
              {/* Emerald gradient header band */}
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#00D179]/20 via-[#00D179]/10 to-transparent" />
              
              <div className="relative p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-clash text-xl font-bold text-white">
                    {!giftSuccess ? 'Send Gift' : 'Gift Sent!'}
                  </h3>
                  <button
                    onClick={closeGiftModal}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                {!giftSuccess ? (
                  <>
                    {/* Recipient Info */}
                    <div className="mb-6">
                      <label className="mb-2 block text-xs text-gray-500">Recipient</label>
                      <input
                        type="text"
                        value={`${profile.name}.qf`}
                        readOnly
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400 outline-none cursor-not-allowed"
                      />
                    </div>

                    {/* Wallet Connection Check */}
                    {!senderAddress ? (
                      <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">
                          Connect wallet to send a gift
                        </p>
                        <button
                          onClick={connect}
                          disabled={connecting}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#00D179] px-6 py-3 font-medium text-black transition-all duration-200 hover:bg-[#00B868] active:scale-95 disabled:opacity-50"
                        >
                          {connecting ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : null}
                          {connecting ? 'Connecting...' : 'Connect Wallet'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Amount Input */}
                        <div className="mb-4">
                          <label className="mb-2 block text-xs text-gray-500">Amount (QF)</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={giftAmount}
                              onChange={(e) => {
                                setGiftAmount(e.target.value);
                                setGiftError(null);
                              }}
                              placeholder="Enter amount"
                              min="0"
                              step="0.01"
                              className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 pr-12 text-sm text-white outline-none transition-all duration-200 focus:border-[#00D179]/50 focus:ring-1 focus:ring-[#00D179]/20 placeholder:text-gray-600"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                              QF
                            </span>
                          </div>
                        </div>

                        {/* Quick Select Buttons */}
                        <div className="flex items-center gap-2 mb-4">
                          {[10, 50, 100, 500].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => handleQuickSelect(amount)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                giftAmount === amount.toString()
                                  ? 'bg-[#00D179] text-black'
                                  : 'bg-white/5 text-gray-400 hover:text-[#00D179] hover:bg-white/10'
                              }`}
                            >
                              {amount}
                            </button>
                          ))}
                        </div>

                        {/* Balance Display */}
                        <div className="mb-4 text-center">
                          <span className="text-sm text-gray-500">
                            Your balance: <span className="text-white font-medium">{formatQF(senderBalance)} QF</span>
                          </span>
                        </div>

                        {/* Error Message */}
                        {giftError && (
                          <p className="text-center text-red-400 text-sm mb-4">
                            {giftError}
                          </p>
                        )}

                        {/* Send Gift Button */}
                        <button
                          onClick={handleSendGift}
                          disabled={isSending || sendDisabled || false}
                          className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                            isSending || sendDisabled
                              ? 'bg-[#00D179]/50 text-black/50 cursor-not-allowed'
                              : 'bg-[#00D179] hover:bg-[#00B868] text-black cursor-pointer'
                          }`}
                        >
                          {isSending ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : null}
                          {isSending ? 'Sending...' : 'Send Gift'}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  /* Success Screen */
                  <div className="text-center py-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00D179]/20 flex items-center justify-center">
                      <Check size={32} className="text-[#00D179]" />
                    </div>
                    <h3 className="font-clash font-medium text-xl text-white mb-6">
                      You sent {giftAmount} QF to {profile.name}.qf!
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleShareGiftOnX}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors duration-200"
                      >
                        <Twitter size={18} />
                        Share on X
                      </button>
                      <Link
                        to={`/name/${profile.name}`}
                        onClick={closeGiftModal}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/[0.08] text-[#666] hover:text-white hover:border-white/[0.15] transition-all duration-200 text-sm"
                      >
                        View {profile.name}<span className="text-[#00D179]">.qf</span> profile
                      </Link>
                      <button
                        onClick={closeGiftModal}
                        className="text-sm text-gray-500 hover:text-white transition-colors duration-200 py-2"
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

    </div>
  );
}
