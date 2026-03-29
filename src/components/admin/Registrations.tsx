import { useState, useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { useWalletStore } from '../../stores/walletStore';
import { Search, Calendar, User, Clock, Wallet, FileText, Loader2, List, Copy, Check, Crown } from 'lucide-react';

export default function Registrations() {
  const {
    lookupResult, isLookingUp, lookupRegistration,
    registrationList, isLoadingRegistrations, loadRegistrations,
  } = useAdminStore();
  const { } = useWalletStore();
  const [searchInput, setSearchInput] = useState('');
  const [copiedNames, setCopiedNames] = useState(false);
  const pioneerCount = 100;

  useEffect(() => {
    if (registrationList.length === 0 && !isLoadingRegistrations) {
      loadRegistrations();
    }
  }, []);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    await lookupRegistration(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const formatDateTime = (timestamp: bigint) => {
    if (timestamp === 0n) return 'N/A';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (timestamp: bigint) => {
    if (timestamp === 0n) return 'N/A';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get first N names without pioneer badge for batch copy
  const unpioneerNames = registrationList
    .filter(r => !r.hasPioneer)
    .slice(0, pioneerCount)
    .map(r => r.name);

  const handleCopyForBatch = () => {
    navigator.clipboard.writeText(unpioneerNames.join('\n'));
    setCopiedNames(true);
    setTimeout(() => setCopiedNames(false), 2000);
  };

  const textRecordKeys = Object.keys(lookupResult?.textRecords || {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Search size={28} className="text-[#00D179]" />
          Registrations
        </h1>
        <p className="text-[#8A8A8A]">All registrations chronologically, plus name lookup</p>
      </div>

      {/* Registration List */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-clash text-lg font-semibold text-white flex items-center gap-2">
            <List size={18} className="text-[#00D179]" />
            All Registrations ({registrationList.length})
          </h2>
          <div className="flex items-center gap-3">
            {unpioneerNames.length > 0 && (
              <button
                onClick={handleCopyForBatch}
                className="px-3 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copiedNames ? <Check size={14} /> : <Copy size={14} />}
                {copiedNames ? 'Copied!' : `Copy ${unpioneerNames.length} for Pioneer batch`}
              </button>
            )}
            <button
              onClick={loadRegistrations}
              disabled={isLoadingRegistrations}
              className="px-3 py-1.5 bg-[#00D179]/10 hover:bg-[#00D179]/20 text-[#00D179] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isLoadingRegistrations ? <Loader2 size={14} className="animate-spin" /> : null}
              Refresh
            </button>
          </div>
        </div>

        {isLoadingRegistrations && registrationList.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#00D179]" />
            <span className="text-[#8A8A8A] ml-3">Loading registrations from chain...</span>
          </div>
        ) : registrationList.length === 0 ? (
          <p className="text-[#8A8A8A] text-center py-8">No registrations found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8A8A8A] text-xs border-b border-[#1E1E1E]">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Name</th>
                  <th className="text-left py-2 pr-3 font-medium">Owner</th>
                  <th className="text-left py-2 pr-3 font-medium">Registered</th>
                  <th className="text-left py-2 pr-3 font-medium">Type</th>
                  <th className="text-left py-2 font-medium">Pioneer</th>
                </tr>
              </thead>
              <tbody>
                {registrationList.map((reg, i) => (
                  <tr key={reg.name} className="border-b border-[#1E1E1E]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-3 text-[#8A8A8A] font-mono text-xs">{i + 1}</td>
                    <td className="py-3 pr-3">
                      <span className="text-white font-medium">{reg.name}</span>
                      <span className="text-[#00D179]">.qf</span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-[#8A8A8A]">
                      {reg.owner.slice(0, 6)}...{reg.owner.slice(-4)}
                    </td>
                    <td className="py-3 pr-3 text-[#8A8A8A] text-xs">{formatDateShort(reg.registeredAt)}</td>
                    <td className="py-3 pr-3">
                      {reg.isPermanent ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00D179]/10 text-[#00D179]">Permanent</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8A8A8A]">Annual</span>
                      )}
                    </td>
                    <td className="py-3">
                      {reg.hasPioneer ? (
                        <span className="flex items-center gap-1 text-[#FFD700] text-xs">
                          <Crown size={12} /> Assigned
                        </span>
                      ) : (
                        <span className="text-[#8A8A8A]/40 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Search (existing functionality, unchanged) */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Name Lookup</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for a name (e.g., quantum)"
            className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isLookingUp || !searchInput.trim()}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLookingUp ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Search
          </button>
        </div>
      </div>

      {/* Lookup Results (existing, unchanged) */}
      {lookupResult && (
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-clash text-2xl font-semibold text-white">
                {lookupResult.name}<span className="text-[#00D179]">.qf</span>
              </h2>
              <div className="flex items-center gap-2 mt-2">
                {lookupResult.isPermanent ? (
                  <span className="px-2 py-1 bg-[#00D179]/10 text-[#00D179] text-xs rounded-full font-medium">Permanent</span>
                ) : (
                  <span className="px-2 py-1 bg-[#8A8A8A]/10 text-[#8A8A8A] text-xs rounded-full font-medium">Annual</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Owner</span>
              </div>
              <code className="text-white font-mono text-sm">{lookupResult.owner}</code>
            </div>
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Resolved Address</span>
              </div>
              <code className="text-white font-mono text-sm">{lookupResult.resolvedAddress || 'Not set'}</code>
            </div>
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Registered</span>
              </div>
              <p className="text-white">{formatDateTime(lookupResult.registeredAt)}</p>
            </div>
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">{lookupResult.isPermanent ? 'Status' : 'Expires'}</span>
              </div>
              <p className="text-white">{lookupResult.isPermanent ? 'Never expires' : formatDateTime(lookupResult.expires)}</p>
            </div>
          </div>

          {textRecordKeys.length > 0 && (
            <div className="border-t border-[#1E1E1E] pt-6">
              <h3 className="font-clash text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={18} className="text-[#00D179]" />
                Text Records
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {textRecordKeys.map((key) => (
                  <div key={key} className="p-3 bg-[#0A0A0A] rounded-lg border border-[#1E1E1E]">
                    <span className="text-[#8A8A8A] text-xs uppercase">{key}</span>
                    <p className="text-white text-sm mt-1">{lookupResult.textRecords[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
