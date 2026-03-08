import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { Link, useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  ArrowLeft,
  Download,
  Twitter,
  Github,
  Globe,
  MessageCircle,
  Loader2,
  Check,
  Link as LinkIcon,
  Star,
} from 'lucide-react';
import {
  renewName,
  transferNameOnChain,
  getTextRecord,
  setTextRecord,
  resolveForward,
  getNamesOwnedByAddress,
  setPrimaryName,
  resolveReverse,
} from '../utils/qns';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

const TEXT_KEYS = ['avatar', 'bio', 'twitter', 'github', 'url', 'discord'] as const;

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: <Twitter size={16} />,
  github: <Github size={16} />,
  url: <Globe size={16} />,
  discord: <MessageCircle size={16} />,
};

export default function MyNamesPage() {
  const { address, connect, refreshName } = useWalletStore();
  const [searchParams] = useSearchParams();
  const expandName = searchParams.get('expand');

  const [names, setNames] = useState<OwnedName[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(expandName);
  const [textRecords, setTextRecords] = useState<Record<string, Record<string, string>>>({});
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [renewingName, setRenewingName] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [primaryName, setPrimaryNameState] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  // Share card modal state
  const [shareModalName, setShareModalName] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const loadNames = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const ownedNames = await getNamesOwnedByAddress(address);
      if (ownedNames.length > 0) {
        setNames(
          ownedNames.map((item) => ({
            name: item.name,
            expires: item.expires,
            isPermanent: item.expires === 0n,
            registeredAt: item.registeredAt,
          }))
        );
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

  const handleSetPrimary = async (name: string) => {
    if (!address) return;
    setSettingPrimary(name);
    try {
      await setPrimaryName(name, address); // Pass just the label, no .qf suffix
      setPrimaryNameState(name);
      await refreshName();
    } catch {
      // tx failed
    } finally {
      setSettingPrimary(null);
    }
  };

  // Auto-expand if URL param is set
  useEffect(() => {
    if (expandName && names.some((n) => n.name === expandName)) {
      setExpandedProfile(expandName);
      loadTextRecords(expandName);
    }
  }, [expandName, names]);

  const loadTextRecords = async (name: string) => {
    const records: Record<string, string> = {};
    for (const key of TEXT_KEYS) {
      records[key] = await getTextRecord(name, key);
    }
    setTextRecords((prev) => ({ ...prev, [name]: records }));
    setEditValues((prev) => ({ ...prev, [name]: { ...records } }));
  };

  const toggleProfile = (name: string) => {
    if (expandedProfile === name) {
      setExpandedProfile(null);
    } else {
      setExpandedProfile(name);
      if (!textRecords[name]) {
        loadTextRecords(name);
      }
    }
  };

  const handleSaveField = async (name: string, key: string) => {
    if (!address) return;
    const value = editValues[name]?.[key] ?? '';
    setSavingField(`${name}-${key}`);
    try {
      await setTextRecord(name, key, value, address);
      setTextRecords((prev) => ({
        ...prev,
        [name]: { ...prev[name], [key]: value },
      }));
    } catch {
      // tx failed
    } finally {
      setSavingField(null);
    }
  };

  const handleRenew = async (name: string) => {
    if (!address) return;
    setRenewingName(name);
    try {
      await renewName(name, 1, address);
      await loadNames();
    } catch {
      // tx failed
    } finally {
      setRenewingName(null);
    }
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
    } catch {
      setTransferError('Transaction failed. Try again.');
    } finally {
      setTransferring(false);
    }
  };

  const openShareModal = (name: string) => {
    if (!textRecords[name]) {
      loadTextRecords(name).then(() => {
        setShareModalName(name);
      });
    } else {
      setShareModalName(name);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current || !shareModalName) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0A0A0A',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `${shareModalName}.qf-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const shareOnX = (name: string) => {
    const text = `Just claimed ${name}.qf on @QFNetwork 🟢 #QNS #QuantumFusion`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const copyProfileLink = (name: string) => {
    const link = `${window.location.origin}/name/${name}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusBadge = (item: OwnedName) => {
    if (item.isPermanent) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#00D179] bg-[#00D17915] px-2.5 py-1 rounded-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Permanent
        </span>
      );
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    const thirtyDays = 30n * 24n * 60n * 60n;
    if (item.expires > 0n && item.expires - now < thirtyDays) {
      return (
        <span className="text-xs font-medium text-[#F5A623] bg-[#F5A62315] px-2.5 py-1 rounded-full">
          Expiring soon
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-[#00D179] bg-[#00D17915] px-2.5 py-1 rounded-full">
        Active
      </span>
    );
  };

  const formatExpiry = (item: OwnedName) => {
    if (item.isPermanent) return 'Permanent — no expiry';
    const date = new Date(Number(item.expires) * 1000);
    return `Expires ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  // Share Card Component
  const ShareCard = ({ name }: { name: string }) => {
    const records = textRecords[name] || {};
    const avatar = records.avatar;
    const bio = records.bio;
    const hasSocials = TEXT_KEYS.slice(2).some((k) => records[k]);

    return (
      <div
        ref={cardRef}
        className="w-[600px] h-[340px] bg-[#0A0A0A] rounded-[12px] p-8 flex flex-col justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #0A0A0A 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(0, 209, 121, 0.3), 0 0 40px rgba(0, 209, 121, 0.1)',
        }}
      >
        {/* Subtle gradient border effect */}
        <div
          className="absolute inset-0 rounded-[12px] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 209, 121, 0.15) 0%, transparent 50%, rgba(0, 209, 121, 0.05) 100%)',
          }}
        />

        <div className="relative z-10">
          {/* Avatar and Name */}
          <div className="flex items-center gap-4 mb-4">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#00D179]/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#00D179]/20 flex items-center justify-center border-2 border-[#00D179]/30">
                <span className="text-2xl font-clash font-bold text-[#00D179]">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="font-clash font-bold text-4xl text-white">
                {name}<span className="text-[#00D179]">.qf</span>
              </h2>
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-[#8A8A8A] text-lg max-w-md mb-4 font-satoshi">{bio}</p>
          )}

          {/* Social Links */}
          {hasSocials && (
            <div className="flex items-center gap-3">
              {TEXT_KEYS.slice(2).map(
                (key) =>
                  records[key] && (
                    <div
                      key={key}
                      className="w-8 h-8 rounded-lg bg-[#141414] border border-[#1E1E1E] flex items-center justify-center text-[#00D179]"
                    >
                      {SOCIAL_ICONS[key] || <Globe size={14} />}
                    </div>
                  )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2 text-sm text-[#8A8A8A]">
          <span className="font-clash font-semibold text-white">
            QNS<span className="text-[#00D179]">.</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-[#00D179]" />
          <span>Powered by QNS</span>
        </div>
      </div>
    );
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
                className="px-8 py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-bold transition-colors duration-200 inline-block"
              >
                Register your first name
              </Link>
            </div>
          )}

          {address && !loading && names.length > 0 && (
            <div className="space-y-4">
              {names.map((item, index) => (
                <div
                  key={item.name}
                  className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 md:p-8 transition-all duration-150 ease-in-out opacity-0 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-satoshi font-bold text-xl text-white">
                          {item.name}<span className="text-[#00D179]">.qf</span>
                        </h3>
                        {primaryName === item.name && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#00D179] bg-[#00D17915] px-2 py-0.5 rounded-full">
                            <Star size={10} fill="currentColor" />
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        {getStatusBadge(item)}
                        <span className="text-sm text-[#8A8A8A]">{formatExpiry(item)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {primaryName !== item.name && (
                        <button
                          onClick={() => handleSetPrimary(item.name)}
                          disabled={settingPrimary === item.name}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[#F5A623] text-[#F5A623] hover:bg-[#F5A62315] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                        >
                          {settingPrimary === item.name ? 'Setting...' : 'Primary'}
                        </button>
                      )}
                      {!item.isPermanent && (
                        <button
                          onClick={() => handleRenew(item.name)}
                          disabled={renewingName === item.name}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[#00D179] text-[#00D179] hover:bg-[#00D17915] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                        >
                          {renewingName === item.name ? 'Renewing...' : 'Renew'}
                        </button>
                      )}
                      <button
                        onClick={() => openShareModal(item.name)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#1E1E1E] text-[#8A8A8A] hover:text-white hover:border-[#00D179]/50 transition-all duration-150 cursor-pointer"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => toggleProfile(item.name)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-[#1E1E1E] text-white hover:bg-[#2a2a2a] transition-all duration-150 cursor-pointer"
                      >
                        {expandedProfile === item.name ? 'Close' : 'Edit'}
                      </button>
                      <button
                        onClick={() => {
                          setTransferModal(item.name);
                          setTransferRecipient('');
                          setTransferError(null);
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#1E1E1E] text-[#8A8A8A] hover:text-white hover:border-[#00D179]/50 transition-all duration-150 cursor-pointer"
                      >
                        Transfer
                      </button>
                    </div>
                  </div>

                  {expandedProfile === item.name && (
                    <div className="mt-5 pt-5 border-t border-[#1E1E1E] space-y-3 transition-all duration-150 ease-in-out animate-fade-in">
                      {TEXT_KEYS.map((key) => (
                        <div key={key} className="flex items-center gap-3">
                          <label className="w-20 text-sm text-[#8A8A8A] capitalize shrink-0">
                            {key}
                          </label>
                          <input
                            type="text"
                            value={editValues[item.name]?.[key] ?? ''}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                [item.name]: {
                                  ...prev[item.name],
                                  [key]: e.target.value,
                                },
                              }))
                            }
                            placeholder={`Enter ${key}`}
                            className="flex-1 bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#00D179] transition-colors duration-200"
                          />
                          <button
                            onClick={() => handleSaveField(item.name, key)}
                            disabled={
                              savingField === `${item.name}-${key}` ||
                              (editValues[item.name]?.[key] ?? '') === (textRecords[item.name]?.[key] ?? '')
                            }
                            className="px-3 py-2 text-xs rounded-lg bg-[#00D179] hover:bg-[#00B868] text-white font-medium disabled:opacity-30 transition-colors duration-200 cursor-pointer"
                          >
                            {savingField === `${item.name}-${key}` ? '...' : 'Save'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

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

      {/* Share Card Modal */}
      {shareModalName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-8 max-w-2xl w-full transition-all duration-150 ease-in-out animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-clash font-medium text-xl text-white">Share Profile</h3>
              <button
                onClick={() => setShareModalName(null)}
                className="text-[#8A8A8A] hover:text-white transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Card Preview */}
            <div className="flex justify-center mb-6 overflow-x-auto">
              <div className="scale-[0.65] sm:scale-[0.8] md:scale-100 origin-top">
                <ShareCard name={shareModalName} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => copyProfileLink(shareModalName)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E1E1E] text-white font-medium transition-colors border border-[#1E1E1E] cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check size={16} className="text-[#00D179]" />
                    Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon size={16} />
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={downloadCard}
                disabled={downloading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Download
              </button>
              <button
                onClick={() => shareOnX(shareModalName)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E1E1E] hover:bg-[#2a2a2a] text-white font-medium transition-colors cursor-pointer"
              >
                <Twitter size={16} />
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
      `}</style>
    </div>
  );
}
