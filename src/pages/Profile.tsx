import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { Gift, Share2, Check, Loader2, Twitter, Send, X } from 'lucide-react';
import { parseEther } from 'viem';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import {
  getPublicClient,
  getRegistration,
  validateNameLocal,
  namehash,
  getWalletClient,
  getQFBalance,
  getSubstrateQFBalance,
  formatQF,
  getBurnStats,
} from '../utils/qns';
import type { BurnStats } from '../utils/qns';
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
  // Show CTA for anyone who isn't the profile owner (including disconnected visitors)
const isOwnProfile = qnsName && name && qnsName.toLowerCase() === name.toLowerCase().replace(/\.qf$/, '');
const showVisitorCTA = !isOwnProfile;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { copy } = useCopy();
  const { showToast } = useToast();
  
  // Gift modal state
  const { address: senderAddress, ss58Address, connect, connecting, providerType } = useWalletStore();
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [senderBalance, setSenderBalance] = useState<bigint>(0n);
  const [isSending, setIsSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
// Gift phase state machine
type GiftPhase = 'idle' | 'signing' | 'inflight' | 'delivered' | 'success';
const [giftPhase, setGiftPhase] = useState<GiftPhase>('idle');
  const [_txHash, setTxHash] = useState<string | null>(null);

  // Burn stats for visitor CTA
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);

  // Animated year counter for Member since
  const registrationYear = profile ? new Date(Number(profile.registeredAt) * 1000).getFullYear() : new Date().getFullYear();
  const animatedYear = useAnimatedNumber(registrationYear, 2);

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

  useEffect(() => {
    if (!isMobile || !cardRef.current) return;

    let permissionGranted = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!cardRef.current) return;
      const beta = e.beta ?? 0;   // front-back tilt (-180 to 180)
      const gamma = e.gamma ?? 0; // left-right tilt (-90 to 90)

      // Normalize to a subtle range (±4 degrees)
      const tiltX = Math.max(-4, Math.min(4, (beta - 45) * 0.08));  // 45 = resting position when held in hand
      const tiltY = Math.max(-4, Math.min(4, gamma * 0.08));

      rotateX.set(tiltX);
      rotateY.set(tiltY);

      // Update spotlight position based on tilt
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const spotX = (rect.width / 2) + (gamma * 2);
        const spotY = (rect.height / 2) + ((beta - 45) * 2);
        setMousePosition({ x: spotX, y: spotY });
      }
    };

    const requestPermission = async () => {
      // iOS 13+ requires permission request
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const perm = await (DeviceOrientationEvent as any).requestPermission();
          if (perm === 'granted') permissionGranted = true;
        } catch {
          return;
        }
      } else {
        permissionGranted = true; // Android, older iOS
      }

      if (permissionGranted) {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isMobile]);

  // Fetch burn stats for visitor CTA
  useEffect(() => {
    const loadBurnStats = async () => {
      try {
        const stats = await getBurnStats();
        setBurnStats(stats);
      } catch (error) {
        console.error('Failed to load burn stats:', error);
        // Set fallback values
        setBurnStats({
          totalBurned: 0,
          qnsBurned: 0,
          totalRegistrations: 400,
          burnPercent: 5,
        });
      }
    };

    loadBurnStats();
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

    // Only apply mouse tilt on desktop (not mobile)
    if (!isMobile) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateYValue = ((x - centerX) / centerX) * 5;
      const rotateXValue = ((centerY - y) / centerY) * 5;

      rotateX.set(rotateXValue);
      rotateY.set(rotateYValue);
    }
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
  const balanceAddress = providerType === 'evm' ? senderAddress : (ss58Address || senderAddress);

  // Fetch balance when modal opens or address changes
  useEffect(() => {
    if (!giftModalOpen) return;

    const fetchBalance = async () => {
      try {
        if (providerType === 'evm' && senderAddress) {
          const { evmGetBalance } = await import('../utils/evmContractCall');
          const bal = await evmGetBalance(senderAddress);
          setSenderBalance(bal);
          return;
        }
        // Substrate: SS58-first, EVM fallback
        if (ss58Address) {
          const bal = await getSubstrateQFBalance(ss58Address);
          if (bal > 0n) {
            setSenderBalance(bal);
            return;
          }
        }
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
  }, [giftModalOpen, ss58Address, senderAddress, providerType]);

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
    setGiftPhase('idle'); // replaces setGiftSuccess(false)
  };

  const handleQuickSelect = (amount: number) => {
    setGiftAmount(amount.toString());
    setGiftError(null);
  };

  // Calculate if send button should be disabled
  const sendDisabled = !giftAmount || parseFloat(giftAmount) <= 0 || (balanceAddress && parseEther(giftAmount) + 500000000000000000n > senderBalance);

  const handleSendGift = async () => {
    if (!senderAddress || !profile?.address || !giftAmount) return;
    if (sendDisabled) return;

    // ... existing validation ...
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
    let balance = 0n;
    try {
      if (providerType === 'evm') {
        const { evmGetBalance } = await import('../utils/evmContractCall');
        balance = await evmGetBalance(senderAddress);
      } else if (ss58Address) {
        balance = await getSubstrateQFBalance(ss58Address);
        if (balance === 0n && senderAddress) {
          balance = await getQFBalance(senderAddress);
        }
      } else if (senderAddress) {
        balance = await getQFBalance(senderAddress);
      }
    } catch {
      balance = 0n;
    }
    const requiredAmount = parseEther(giftAmount);
    const gasBuffer = 500000000000000000n; // 0.5 QF

    if (balance < requiredAmount + gasBuffer) {
      setGiftError('Insufficient QF balance');
      return;
    }

    setIsSending(true);
    setGiftError(null);
    setGiftPhase('signing'); // Phase 1: wallet is prompting

    try {
      let txHash: string | undefined;
      let confirmation: Promise<{ confirmed: boolean; error?: string }>;

      // ... existing provider branching (evm vs substrate) ...
      if (providerType === 'evm') {
        // MetaMask: use EVM transfer
        const { evmSendTransfer } = await import('../utils/evmContractCall');
        const result = await evmSendTransfer(
          profile.address,
          requiredAmount,
          async () => true // rely on receipt, not balance check
        );
        txHash = result.txHash;
        confirmation = result.confirmation;
      } else {
        // Substrate: use PAPI transfer
        const walletClient = getWalletClient();
        if (!walletClient) throw new Error('No wallet connected');
        const signerAddress = ss58Address || senderAddress;
        const result = await walletClient.sendTransaction({
          to: profile.address as `0x${string}`,
          value: requiredAmount,
          account: signerAddress,
          verifyOnChain: async () => true,
        });
        txHash = result.txHash;
        confirmation = result.confirmation;
      }

      // Phase 2: tx submitted, in-flight
      setGiftPhase('inflight');
      hapticTap(); // subtle tap on broadcast

      // After 1.8s, transition to "delivered"
      setTimeout(() => {
        setGiftPhase('delivered');
        hapticGift(); // the unique gift chime plays HERE, on "delivery"
      }, 1800);

      // After 3.5s total, show full success with CTAs
      setTimeout(() => {
        setGiftPhase('success');
      }, 3500);

      setTxHash(txHash || null);

      // Background confirmation (same pattern as registration)
      confirmation.then((result) => {
        if (result.confirmed) return;
        // ... existing error handling, but reset giftPhase to 'idle' on hard failure ...
        if (result.error === 'not_confirmed') {
          setGiftError('Gift submitted but not yet confirmed on-chain. It may still arrive shortly.');
          return;
        }
        if (result.error && isRetryableError(result.error)) {
          setGiftPhase('idle');
          setGiftError(RETRY_MESSAGE_SHORT);
          showToast(RETRY_MESSAGE_SHORT, 'warning');
          return;
        }
        setGiftPhase('idle');
        setGiftError(`Gift failed on-chain: ${result.error}. Your balance was not deducted.`);
      });
    } catch (err: any) {
      console.error('Gift send error:', err);
      const msg = err?.message ?? String(err);

      if (isRetryableError(msg)) {
        setGiftPhase('idle');
        setGiftError(RETRY_MESSAGE_SHORT);
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        return;
      }

      if (msg.includes('rejected') || msg.includes('Rejected') || msg.includes('Cancelled') || msg.includes('cancelled')) {
        setGiftPhase('idle');
        setGiftError('Transaction cancelled.');
      } else {
        setGiftPhase('idle');
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
      const dynamicOgImage = `https://dotqf.xyz/api/og/${profile.name}.png`;

      setMetaTag('og:title', `${profile.name}.qf`);
      setMetaTag('og:description', profile.bio || 'A QNS identity on QF Network');
      setMetaTag('og:image', dynamicOgImage);
      setMetaTag('og:url', profileUrl);
      setMetaTag('og:type', 'profile');
      setMetaTag('twitter:card', 'summary_large_image', 'name');
      setMetaTag('twitter:title', `${profile.name}.qf — QNS`, 'name');
      setMetaTag('twitter:description', profile.bio || 'A QNS identity on QF Network', 'name');
      setMetaTag('twitter:image', dynamicOgImage, 'name');

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
      <>
        <Navbar />
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12 pt-24">
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
        <Footer />
      </>
    );
  }

  if (!loading && (error || !profile?.exists)) {
  const displayName = name?.replace(/\.qf$/, '') || '';
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md rounded-2xl border border-white/[0.04] bg-black/40 overflow-hidden"
        >
          {/* Noise/grain overlay */}
          <div
            className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Faded header */}
          <div className="relative h-32 bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="absolute inset-0 flex items-center justify-center pt-8">
              <h1 className="text-3xl font-bold text-white/20">
                {displayName}<span className="text-[#00D179]/20">.qf</span>
              </h1>
            </div>
          </div>

          {/* Ghost avatar */}
          <div className="px-6 pb-6 relative z-10">
            <div className="flex justify-center -mt-6 mb-4">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border-4 border-black/60 flex items-center justify-center">
                <span className="text-2xl font-bold text-white/10">{displayName.slice(0, 2).toUpperCase()}</span>
              </div>
            </div>

            <p className="text-[#333] text-center text-sm mt-4 mb-2">
              {error || 'This identity hasn\'t been claimed'}
            </p>

            <div className="border-t border-white/[0.03] my-5" />

            {/* The only color on screen — the CTA */}
            {!error && (
              <Link
                to={`/?search=${encodeURIComponent(displayName)}`}
                className="block w-full text-center py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold text-sm transition-colors duration-200"
              >
                Claim {displayName}.qf
              </Link>
            )}
          </div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}

  const isDappLab = profile ? DAPP_LAB_NAMES.includes(profile.name.toLowerCase()) : false;
  const isTeam = profile ? TEAM_NAMES.includes(profile.name.toLowerCase()) : false;
  const hasSocials = profile ? (profile.twitter || profile.telegram) : false;

  // Guard clause - only render profile card if profile exists
  if (!profile) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12 pt-24">
      {/* Profile Card */}
      <motion.div
        ref={cardRef}
        layoutId={name ? `name-card-${name.replace(/\.qf$/, '')}` : undefined}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.6 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
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
            Member since {new Date(Number(profile.registeredAt) * 1000).toLocaleDateString('en-US', { month: 'long' })} <motion.span>{animatedYear}</motion.span>
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
            <p className="text-white font-medium mb-3">
              Claim your <span className="text-[#00D179]">.qf</span> name in seconds
            </p>
            {/* Live social proof */}
            <p className="text-[#444] text-xs mb-4">
              <span className="text-[#00D179]">{burnStats?.totalRegistrations || 400}</span> names claimed and counting
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
                    {giftPhase === 'idle' ? 'Send Gift' :
                     giftPhase === 'signing' ? 'Confirming...' :
                     giftPhase === 'inflight' ? 'Sending...' :
                     giftPhase === 'delivered' ? 'Delivered' :
                     'Gift Sent!'}
                  </h3>
                  <button
                    onClick={closeGiftModal}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 transition-all duration-200 hover:border-[#00D179]/20 hover:bg-white/10 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {giftPhase === 'idle' && (
                    <motion.div key="gift-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
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
                                className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 pr-12 text-base md:text-sm text-white outline-none transition-all duration-200 focus:border-[#00D179]/50 focus:ring-1 focus:ring-[#00D179]/20 placeholder:text-gray-600"
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
                    </motion.div>
                  )}

                  {giftPhase === 'signing' && (
                    <motion.div key="gift-signing" className="text-center py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div className="relative inline-block mb-5">
                        <div className="w-12 h-12 border-[3px] border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-[#00D179] rounded-full animate-pulse" />
                        </div>
                      </div>
                      <p className="text-white font-medium mb-1">Confirm in your wallet</p>
                      <p className="text-[#555] text-sm">Sending {giftAmount} QF to {profile.name}.qf</p>
                    </motion.div>
                  )}

                  {giftPhase === 'inflight' && (
                    <motion.div key="gift-inflight" className="text-center py-10" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                      {/* Animated gift icon — SVG line-draw */}
                      <div className="relative flex items-center justify-center mb-6">
                        {/* Soft pulsing ring behind the icon */}
                        <motion.div
                          className="absolute w-20 h-20 rounded-full bg-[#00D179]/10"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Gift box SVG with path draw-in */}
                        <motion.div className="relative w-16 h-16 flex items-center justify-center">
                          <motion.svg
                            width="40" height="40" viewBox="0 0 24 24" fill="none"
                            stroke="#00D179" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                          >
                            {/* Gift box body */}
                            <motion.rect x="3" y="8" width="18" height="13" rx="2"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                            {/* Gift box lid */}
                            <motion.rect x="2" y="4" width="20" height="4" rx="1"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                            />
                            {/* Ribbon vertical */}
                            <motion.line x1="12" y1="4" x2="12" y2="21"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.4, delay: 0.5 }}
                            />
                            {/* Ribbon horizontal */}
                            <motion.line x1="3" y1="12" x2="21" y2="12"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.4, delay: 0.6 }}
                            />
                          </motion.svg>
                        </motion.div>
                      </div>
                      {/* Floating upward animation on the whole icon */}
                      <motion.p
                        className="text-[#00D179] font-medium mb-1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        Sending to {profile.name}.qf
                      </motion.p>
                      <motion.p
                        className="text-[#555] text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                      >
                        {giftAmount} QF on its way
                      </motion.p>
                    </motion.div>
                  )}

                  {giftPhase === 'delivered' && (
                    <motion.div key="gift-delivered" className="text-center py-10" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
                      <div className="relative flex items-center justify-center mb-6">
                        {/* Expanding ring — same pattern as registration celebrate */}
                        <motion.div
                          className="absolute w-[72px] h-[72px] rounded-full border-2 border-[#00D179]/30"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                        />
                        {/* Checkmark circle */}
                        <motion.div
                          className="relative w-[72px] h-[72px] rounded-full bg-[#00D179] flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <motion.svg
                            width="36" height="36" viewBox="0 0 24 24" fill="none"
                            stroke="white" strokeWidth="3" strokeLinecap="round"
                          >
                            <motion.path
                              d="M20 6L9 17l-5-5"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.4, delay: 0.2 }}
                            />
                          </motion.svg>
                        </motion.div>
                      </div>
                      <motion.p
                        className="font-clash font-semibold text-xl text-white mb-1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                      >
                        {profile.name}<span className="text-[#00D179]">.qf</span> received your gift
                      </motion.p>
                      <motion.p
                        className="text-[#555] text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        {giftAmount} QF delivered
                      </motion.p>
                    </motion.div>
                  )}

                  {giftPhase === 'success' && (
                    <motion.div key="gift-success" className="text-center py-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                      {/* This is the existing success screen with Share on X / View profile / Close */}
                      <h3 className="font-clash font-medium text-xl text-white mb-6">
                        You sent {giftAmount} QF to {profile.name}.qf!
                      </h3>
                      <div className="flex flex-col gap-3">
                        <button onClick={handleShareGiftOnX}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors duration-200">
                          <Twitter size={18} />
                          Share on X
                        </button>
                        <Link to={`/name/${profile.name}`} onClick={closeGiftModal}
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/[0.08] text-[#666] hover:text-white hover:border-white/[0.15] transition-all duration-200 text-sm">
                          View {profile.name}<span className="text-[#00D179]">.qf</span> profile
                        </Link>
                        <button onClick={closeGiftModal}
                          className="text-sm text-gray-500 hover:text-white transition-colors duration-200 py-2">
                          Close
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
      <Footer />
    </>
  );
}
