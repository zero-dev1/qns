import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  Twitter,
  Github,
  Globe,
  MessageCircle,
  Loader2,
  ExternalLink,
  Share2,
  Download,
  Gift,
} from 'lucide-react';
import { namehash, getPublicClient, getRegistration, validateNameLocal, getWalletClient, getQFBalance, formatQF } from '../utils/qns';
import { generateShareCard, downloadShareCard } from '../utils/shareCard';
import {
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
} from '../config/contracts';
import { useWalletStore } from '../stores/walletStore';
import { parseEther } from 'viem';

interface ProfileData {
  name: string;
  address: string;
  avatar: string;
  bio: string;
  twitter: string;
  github: string;
  url: string;
  discord: string;
  expires: bigint;
  registeredAt: bigint;
  isPermanent: boolean;
  exists: boolean;
}

const SOCIAL_CONFIG: Record<string, { icon: React.ReactNode; url: (handle: string) => string; label: string }> = {
  twitter: {
    icon: <Twitter size={18} />,
    url: (handle: string) => `https://twitter.com/${handle.replace(/^@/, '')}`,
    label: 'Twitter',
  },
  github: {
    icon: <Github size={18} />,
    url: (handle: string) => `https://github.com/${handle}`,
    label: 'GitHub',
  },
  url: {
    icon: <Globe size={18} />,
    url: (handle: string) => (handle.startsWith('http') ? handle : `https://${handle}`),
    label: 'Website',
  },
  discord: {
    icon: <MessageCircle size={18} />,
    url: (handle: string) => `https://discord.com/users/${handle}`,
    label: 'Discord',
  },
};

export default function ProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  
  // Gift modal state
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [senderBalance, setSenderBalance] = useState<bigint>(0n);
  const [isSending, setIsSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { address: senderAddress, connect, connecting } = useWalletStore();

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

      // Get registration data first to check if name exists
      const registration = await getRegistration(normalizedName);

      if (!registration) {
        setProfile({
          name: normalizedName,
          address: '',
          avatar: '',
          bio: '',
          twitter: '',
          github: '',
          url: '',
          discord: '',
          expires: 0n,
          registeredAt: 0n,
          isPermanent: false,
          exists: false,
        });
        setLoading(false);
        return;
      }

      // Check if expired (unless permanent)
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
          github: '',
          url: '',
          discord: '',
          expires: registration.expires,
          registeredAt: registration.registeredAt,
          isPermanent: false,
          exists: false,
        });
        setLoading(false);
        return;
      }

      // Fetch resolver data
      const [address, , avatar, bio, twitter, github, url, discord] = await Promise.all([
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'addr',
            args: [node],
          })
          .catch(() => '0x0000000000000000000000000000000000000000'),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'name',
            args: [node],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'avatar'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'bio'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'twitter'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'github'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'url'],
          })
          .catch(() => ''),
        client
          .readContract({
            address: QNS_RESOLVER_ADDRESS,
            abi: QNS_RESOLVER_ABI,
            functionName: 'text',
            args: [node, 'discord'],
          })
          .catch(() => ''),
      ]);

      setProfile({
        name: normalizedName,
        address: address === '0x0000000000000000000000000000000000000000' ? registration.owner : address,
        avatar: avatar || '',
        bio: bio || '',
        twitter: twitter || '',
        github: github || '',
        url: url || '',
        discord: discord || '',
        expires: registration.expires,
        registeredAt: registration.registeredAt,
        isPermanent,
        exists: true,
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!profile?.address) return;
    navigator.clipboard.writeText(profile.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: bigint) => {
    if (timestamp === 0n) return 'Unknown';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleShareCard = async () => {
    if (!profile) return;
    setCapturing(true);
    try {
      const dataUrl = await generateShareCard({
        name: profile.name,
        address: profile.address,
        avatar: profile.avatar || undefined,
        bio: profile.bio || undefined,
        twitter: profile.twitter || undefined,
        github: profile.github || undefined,
        url: profile.url || undefined,
        discord: profile.discord || undefined,
        registeredAt: profile.registeredAt,
        isPermanent: profile.isPermanent,
        expires: profile.expires,
      });
      setCanvasDataUrl(dataUrl);
      setShareModalOpen(true);
    } catch (err) {
      console.error('Error generating share card:', err);
    } finally {
      setCapturing(false);
    }
  };

  const handleDownload = () => {
    if (!canvasDataUrl || !profile) return;
    downloadShareCard(canvasDataUrl, `${profile.name}-qf-profile.png`);
  };

  const handleShareX = () => {
    if (!profile) return;
    const profileUrl = `${window.location.origin}/profile/${profile.name}`;
    const text = `Check out my identity on $QF Network`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank');
  };

  // Gift modal handlers
  const openGiftModal = async () => {
    setGiftModalOpen(true);
    setGiftAmount('');
    setGiftError(null);
    setGiftSuccess(false);
    setTxHash(null);
    if (senderAddress) {
      const balance = await getQFBalance(senderAddress);
      setSenderBalance(balance);
    }
  };

  const closeGiftModal = () => {
    setGiftModalOpen(false);
    setGiftAmount('');
    setGiftError(null);
    setGiftSuccess(false);
    setTxHash(null);
  };

  const handleQuickSelect = (amount: number) => {
    setGiftAmount(amount.toString());
    setGiftError(null);
  };

  const handleSendGift = async () => {
    if (!senderAddress || !profile?.address || !giftAmount) return;
    
    const amount = parseFloat(giftAmount);
    if (isNaN(amount) || amount <= 0) {
      setGiftError('Please enter a valid amount');
      return;
    }

    // Check balance
    const balance = await getQFBalance(senderAddress);
    const requiredAmount = parseEther(giftAmount);
    
    if (balance < requiredAmount) {
      setGiftError('Insufficient QF balance');
      return;
    }

    setIsSending(true);
    setGiftError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('No wallet connected');

      const hash = await walletClient.sendTransaction({
        to: profile.address as `0x${string}`,
        value: requiredAmount,
        account: senderAddress,
      });

      setTxHash(hash);
      setGiftSuccess(true);
    } catch (err) {
      console.error('Gift transaction failed:', err);
      setGiftError('Transaction failed. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleShareGiftOnX = () => {
    if (!profile || !giftAmount) return;
    const text = `Just gifted ${giftAmount} QF to ${profile.name}.qf on @QFNetwork`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Get available socials
  const availableSocials = profile
    ? Object.entries(SOCIAL_CONFIG).filter(([key]) => profile[key as keyof ProfileData] as string)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00D179] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#E5484D] mb-4 font-satoshi">{error}</p>
          <Link
            to="/"
            className="text-[#00D179] hover:text-[#00B868] transition-colors font-satoshi"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Name doesn't exist or expired
  if (!profile?.exists) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="mb-6">
            <span className="font-clash font-bold text-3xl text-white">
              {name}
              <span className="text-[#00D179]">.qf</span>
            </span>
          </div>
          <p className="text-[#8A8A8A] mb-6 font-satoshi text-lg">
            This name is available for registration
          </p>
          <Link
            to={`/?search=${encodeURIComponent(name || '')}`}
            className="inline-block px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-bold transition-colors duration-200"
          >
            Register this name
          </Link>
          <div className="mt-8">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 mx-auto w-fit"
            >
              <ArrowLeft size={16} />
              Back to home
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
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
      <main className="flex-1 flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Profile Card - transparent background with border only */}
          <div
            className="rounded-[16px] p-8 relative overflow-hidden border border-[#1E1E1E]"
          >
            {/* Share and Gift icon buttons - top right */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
              <button
                onClick={openGiftModal}
                className="p-2 rounded-lg text-[#8A8A8A] hover:text-[#00D179] hover:bg-[#1E1E1E] transition-all duration-200"
                title="Gift QF"
              >
                <Gift size={18} />
              </button>
              <button
                onClick={handleShareCard}
                disabled={capturing}
                className="p-2 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-[#1E1E1E] transition-all duration-200 disabled:opacity-50"
                title="Share Card"
              >
                <Share2 size={18} />
              </button>
            </div>

            <div className="relative z-10">
              {/* Name Header */}
              <div className="text-center mb-6">
                <h1 className="font-clash font-bold text-4xl text-white">
                  {profile.name}
                  <span className="text-[#00D179]">.qf</span>
                </h1>
              </div>

              {/* Avatar */}
              <div className="flex justify-center mb-6">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-[120px] h-[120px] rounded-full object-cover border-2 border-[#00D179]/30"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] rounded-full bg-[#00D179]/20 flex items-center justify-center border-2 border-[#00D179]/30">
                    <span className="text-5xl font-clash font-bold text-[#00D179]">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-[#8A8A8A] text-center font-satoshi text-base mb-6 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Social Links */}
              {availableSocials.length > 0 && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  {availableSocials.map(([key, config]) => {
                    const value = profile[key as keyof ProfileData] as string;
                    if (!value) return null;
                    return (
                      <a
                        key={key}
                        href={config.url(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] flex items-center justify-center text-[#8A8A8A] hover:text-[#00D179] hover:border-[#00D179]/30 transition-all duration-200"
                        title={config.label}
                      >
                        {config.icon}
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Wallet Address */}
              <div className="mb-6">
                <div className="bg-[#0A0A0A] rounded-xl px-4 py-3 flex items-center justify-between border border-[#1E1E1E]">
                  <span className="font-mono text-sm text-[#8A8A8A] truncate">
                    {profile.address}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="ml-3 p-1.5 rounded-lg hover:bg-[#1E1E1E] transition-colors text-[#8A8A8A] hover:text-[#00D179] shrink-0"
                    title="Copy address"
                  >
                    {copied ? <Check size={16} className="text-[#00D179]" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Registration Info */}
              <div className="flex flex-col items-center gap-2 text-sm">
                <div className="flex items-center gap-2 text-[#555555]">
                  <span>Member since {formatDate(profile.registeredAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {profile.isPermanent ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00D179] bg-[#00D17915] px-3 py-1.5 rounded-full">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Permanent
                    </span>
                  ) : (
                    <span className="text-[#8A8A8A]">
                      Expires {formatDate(profile.expires)}
                    </span>
                  )}
                </div>
              </div>

              {/* Footer inside the card */}
              <div className="mt-8 pt-6 border-t border-[#1E1E1E] text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm text-[#555555] hover:text-[#00D179] transition-colors duration-200"
                >
                  <span className="font-clash font-semibold text-white">
                    QNS<span className="text-[#00D179]">.</span>
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#555555]" />
                  <span>Powered by QNS</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          </div>

          {/* Share Card and Gift QF buttons below */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleShareCard}
              disabled={capturing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[#1E1E1E] text-[#8A8A8A] hover:text-white hover:border-[#00D179] hover:bg-[#00D17915] transition-all duration-200 disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Share2 size={18} />
              )}
              {capturing ? 'Generating...' : 'Share Card'}
            </button>
            <button
              onClick={openGiftModal}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[#1E1E1E] text-[#8A8A8A] hover:text-[#00D179] hover:border-[#00D179] hover:bg-[#00D17915] transition-all duration-200"
            >
              <Gift size={18} />
              Gift QF
            </button>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6 max-w-lg w-full animate-fade-in">
            <h3 className="font-clash font-medium text-xl text-white mb-4 text-center">
              Your Profile Card
            </h3>

            {canvasDataUrl && (
              <div className="mb-6 rounded-xl overflow-hidden border border-[#1E1E1E]">
                <img
                  src={canvasDataUrl}
                  alt="Profile Card Preview"
                  className="w-full h-auto"
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-medium transition-colors duration-200"
              >
                <Download size={18} />
                Download PNG
              </button>
              <button
                onClick={handleShareX}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1E1E1E] text-white hover:bg-[#1E1E1E] transition-colors duration-200"
              >
                <Twitter size={18} />
                Share on X
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {giftModalOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 max-w-md w-full animate-fade-in">
            {!giftSuccess ? (
              <>
                {/* Recipient Info */}
                <div className="text-center mb-6">
                  <h3 className="font-clash font-medium text-xl text-white mb-1">
                    Gift QF to {profile.name}.qf
                  </h3>
                  <p className="text-sm text-[#8A8A8A] font-mono">
                    {profile.address}
                  </p>
                </div>

                {/* Wallet Connection Check */}
                {!senderAddress ? (
                  <div className="text-center py-4">
                    <p className="text-[#8A8A8A] mb-4">
                      Connect wallet to send a gift
                    </p>
                    <button
                      onClick={connect}
                      disabled={connecting}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-medium transition-colors duration-200 disabled:opacity-50"
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
                          className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white font-satoshi focus:outline-none focus:border-[#00D179] transition-colors"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] font-medium">
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
                              ? 'bg-[#00D179] text-white'
                              : 'bg-[#1E1E1E] text-[#8A8A8A] hover:text-[#00D179]'
                          }`}
                        >
                          {amount} QF
                        </button>
                      ))}
                    </div>

                    {/* Balance Display */}
                    <div className="mb-4 text-center">
                      <span className="text-sm text-[#8A8A8A]">
                        Your balance: <span className="text-white font-medium">{formatQF(senderBalance)} QF</span>
                      </span>
                    </div>

                    {/* Error Message */}
                    {giftError && (
                      <p className="text-center text-[#E5484D] text-sm mb-4">
                        {giftError}
                      </p>
                    )}

                    {/* Send Gift Button */}
                    <button
                      onClick={handleSendGift}
                      disabled={isSending || !giftAmount}
                      className="w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-medium transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : null}
                      {isSending ? 'Sending...' : 'Send Gift'}
                    </button>
                  </>
                )}

                {/* Close Button */}
                <button
                  onClick={closeGiftModal}
                  className="w-full text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2 mt-3"
                >
                  Close
                </button>
              </>
            ) : (
              /* Success Screen */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00D179]/20 flex items-center justify-center">
                  <Check size={32} className="text-[#00D179]" />
                </div>
                <h3 className="font-clash font-medium text-xl text-white mb-2">
                  You sent {giftAmount} QF to {profile.name}.qf!
                </h3>
                {txHash && (
                  <p className="text-sm text-[#8A8A8A] font-mono mb-4 break-all">
                    {txHash.slice(0, 20)}...{txHash.slice(-8)}
                  </p>
                )}
                <div className="flex flex-col gap-3 mt-6">
                  <button
                    onClick={handleShareGiftOnX}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#1E1E1E] text-white hover:bg-[#1E1E1E] transition-colors duration-200"
                  >
                    <Twitter size={18} />
                    Share on X
                  </button>
                  <button
                    onClick={closeGiftModal}
                    className="text-sm text-[#8A8A8A] hover:text-white transition-colors duration-200 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
