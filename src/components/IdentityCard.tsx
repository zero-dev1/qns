import { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Pencil, Share2 } from 'lucide-react';
import Avatar from './Avatar';
import PulseDot from './PulseDot';
import { TEAM_NAMES, DAPP_LAB_NAMES } from '../utils/badges';

interface OwnedName {
  name: string;
  expires: bigint;
  isPermanent: boolean;
  registeredAt: bigint;
}

interface IdentityCardProps {
  name: OwnedName;
  records: {
    avatar: string;
    bio: string;
    twitter: string;
    telegram: string;
    website: string;
    email: string;
  };
  isPrimary: boolean;
  enableTilt: boolean;
  onOpenDetail: (name: string, tab?: 'overview' | 'edit' | 'manage' | 'share') => void;
}

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const COMPLETENESS_FIELDS = ['avatar', 'bio', 'twitter', 'telegram', 'website', 'email'] as const;

export default function IdentityCard({ name, records, isPrimary, enableTilt, onOpenDetail }: IdentityCardProps) {
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
    rotateX.set(((centerY - y) / centerY) * 4);
    rotateY.set(((x - centerX) / centerX) * 4);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  // Status calculation
  const now = BigInt(Math.floor(Date.now() / 1000));
  const thirtyDays = 30n * 24n * 60n * 60n;
  const isExpiringSoon = !name.isPermanent && name.expires > 0n && (name.expires - now) < thirtyDays;
  const isExpired = !name.isPermanent && name.expires > 0n && name.expires < now;

  const statusBarClass = name.isPermanent
    ? 'bg-gradient-to-r from-[#00D179] to-[#00D179]/40'
    : isExpired
      ? 'bg-gradient-to-r from-red-500 to-red-500/40'
      : isExpiringSoon
        ? 'bg-gradient-to-r from-amber-400 to-amber-400/40'
        : 'bg-gradient-to-r from-[#00D179] to-[#00D179]/40';

  const isTeam = TEAM_NAMES.includes(name.name.toLowerCase());
  const isDappLab = DAPP_LAB_NAMES.includes(name.name.toLowerCase());

  const filledFields = COMPLETENESS_FIELDS.filter(
    (field) => records[field as keyof typeof records]
  ).length;

  const expiryText =
    !name.isPermanent && name.expires > 0n
      ? new Date(Number(name.expires) * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  return (
    <motion.div
      ref={cardRef}
      layoutId={`card-${name.name}`}
      onClick={() => onOpenDetail(name.name, 'overview')}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        enableTilt
          ? { rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 1200 }
          : undefined
      }
      className={`group relative cursor-pointer rounded-2xl border bg-[#111] overflow-hidden flex flex-col items-center px-5 py-6 hover:border-white/[0.1] transition-all duration-300 ${
        isPrimary ? 'border-[#00D179]/20' : 'border-white/[0.06]'
      }`}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Ambient glow for primary */}
      {isPrimary && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'radial-gradient(ellipse, rgba(0,209,121,0.08) 0%, transparent 70%)',
            }}
          />
          {/* QDL: Subtle shimmer sweep on primary card — reuses @keyframes shimmer from index.css */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'linear-gradient(110deg, transparent 30%, rgba(0,209,121,0.04) 45%, rgba(0,209,121,0.07) 50%, rgba(0,209,121,0.04) 55%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 5s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* Status gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusBarClass}`} />

      {/* Spotlight on hover */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(500px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,209,121,0.05), transparent 40%)`,
        }}
      />

      {/* Floating quick actions: edit + share */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetail(name.name, 'edit'); }}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#555] hover:text-white transition-all"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetail(name.name, 'share'); }}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#555] hover:text-white transition-all"
        >
          <Share2 size={14} />
        </button>
      </div>

      {/* Badge row */}
      <div className="flex items-center gap-2 mb-4">
        {name.isPermanent && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#00D179]/10 text-[#8DF0BA] border border-[#00D179]/20">
            <ShieldIcon /> Permanent
          </span>
        )}
        {isTeam && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#DADADA]/10 text-[#DADADA] border border-[#DADADA]/20">
            <ShieldIcon /> Team
          </span>
        )}
        {isDappLab && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[#00EFE7]/10 text-[#00EFE7] border border-[#00EFE7]/20">
            <ShieldIcon /> dApp Lab
          </span>
        )}
      </div>

      {/* Avatar with layoutId for shared animation */}
      <motion.div
        layoutId={`avatar-${name.name}`}
        className={`relative mb-4 rounded-full ${
          isPrimary ? 'ring-2 ring-[#00D179]/40 ring-offset-2 ring-offset-[#111]' : ''
        }`}
      >
        <Avatar url={records.avatar} name={name.name} size={80} />
      </motion.div>

      {/* Name */}
      <h3 className="font-clash text-xl font-bold text-white text-center mb-2">
        {name.name}<span className="text-[#00D179]">.qf</span>
      </h3>

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

      {/* Completeness dots */}
      <div className="mt-auto pt-3">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          {COMPLETENESS_FIELDS.map((field, i) => (
            <div
              key={field}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < filledFields ? 'bg-[#00D179]' : 'bg-white/[0.06]'
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] text-[#333] text-center">
          {filledFields} of {COMPLETENESS_FIELDS.length}
        </p>
      </div>
    </motion.div>
  );
}
