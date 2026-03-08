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
} from 'lucide-react';
import {
  namehash,
  getPublicClient,
  getRegistration,
  validateNameLocal,
} from '../utils/qns';
import {
  QNS_RESOLVER_ADDRESS,
  QNS_RESOLVER_ABI,
} from '../config/contracts';

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
          {/* Profile Card */}
          <div
            className="bg-[#141414] rounded-[16px] p-8 relative overflow-hidden"
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(0, 209, 121, 0.2), 0 0 60px rgba(0, 209, 121, 0.08)',
            }}
          >
            {/* Subtle gradient border */}
            <div
              className="absolute inset-0 rounded-[16px] pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 209, 121, 0.1) 0%, transparent 50%, rgba(0, 209, 121, 0.03) 100%)',
              }}
            />

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
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
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
      </main>

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
