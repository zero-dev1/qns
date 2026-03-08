import { useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { formatQF, formatUSD } from '../../utils/qns';
import { Users, Bookmark, Wallet, Flame, Tag, Clock } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
}

function StatCard({ label, value, subValue, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-[#00D179]/10">
          <Icon size={20} className="text-[#00D179]" />
        </div>
      </div>
      <p className="text-[#8A8A8A] text-sm mb-1">{label}</p>
      <p className="font-clash text-2xl font-semibold text-white">{value}</p>
      {subValue && (
        <p className="text-[#8A8A8A] text-xs mt-1">{subValue}</p>
      )}
    </div>
  );
}

export default function Overview() {
  const {
    totalRegistrations,
    reservedNamesCount,
    contractBalance,
    treasuryAddress,
    burnAddress,
    burnPercent,
    price3Char,
    price4Char,
    price5PlusChar,
    permanentMultiplier,
    loadOverviewData,
  } = useAdminStore();

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const truncateAddr = (addr: string | null) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2">Overview</h1>
        <p className="text-[#8A8A8A]">QNS Registrar contract metrics and statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Registrations"
          value={totalRegistrations !== null ? totalRegistrations.toString() : '-'}
          icon={Users}
        />
        <StatCard
          label="Reserved Names"
          value={reservedNamesCount !== null ? reservedNamesCount.toString() : '-'}
          icon={Bookmark}
        />
        <StatCard
          label="Contract Balance"
          value={contractBalance !== null ? formatQF(contractBalance) : '-'}
          subValue={contractBalance !== null ? formatUSD(contractBalance) : undefined}
          icon={Wallet}
        />
        <StatCard
          label="Burn Percentage"
          value={burnPercent !== null ? `${burnPercent.toString()}%` : '-'}
          icon={Flame}
        />
        <StatCard
          label="Treasury Address"
          value={truncateAddr(treasuryAddress)}
          subValue={treasuryAddress || undefined}
          icon={Wallet}
        />
        <StatCard
          label="Burn Address"
          value={truncateAddr(burnAddress)}
          subValue={burnAddress || undefined}
          icon={Flame}
        />
      </div>

      {/* Pricing Table */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Tag size={20} className="text-[#00D179]" />
          Current Pricing
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
            <p className="text-[#8A8A8A] text-sm mb-2">3-Character Names</p>
            <p className="font-clash text-xl font-semibold text-white">
              {price3Char !== null ? formatQF(price3Char) : '-'} <span className="text-[#00D179]">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs mt-1">
              {price3Char !== null ? formatUSD(price3Char) : ''}
            </p>
          </div>
          
          <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
            <p className="text-[#8A8A8A] text-sm mb-2">4-Character Names</p>
            <p className="font-clash text-xl font-semibold text-white">
              {price4Char !== null ? formatQF(price4Char) : '-'} <span className="text-[#00D179]">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs mt-1">
              {price4Char !== null ? formatUSD(price4Char) : ''}
            </p>
          </div>
          
          <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
            <p className="text-[#8A8A8A] text-sm mb-2">5+ Character Names</p>
            <p className="font-clash text-xl font-semibold text-white">
              {price5PlusChar !== null ? formatQF(price5PlusChar) : '-'} <span className="text-[#00D179]">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs mt-1">
              {price5PlusChar !== null ? formatUSD(price5PlusChar) : ''}
            </p>
          </div>
        </div>

        <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-[#00D179]" />
            <p className="text-[#8A8A8A] text-sm">Permanent Registration Multiplier</p>
          </div>
          <p className="font-clash text-xl font-semibold text-white">
            {permanentMultiplier !== null ? `${permanentMultiplier.toString()}x` : '-'} <span className="text-[#8A8A8A] text-sm font-normal">(annual price × multiplier)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
