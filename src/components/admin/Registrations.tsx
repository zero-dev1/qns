import { useState } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { Search, Calendar, User, Clock, Wallet, FileText, Loader2 } from 'lucide-react';

export default function Registrations() {
  const { lookupResult, isLookingUp, lookupRegistration } = useAdminStore();
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    await lookupRegistration(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatDateTime = (timestamp: bigint) => {
    if (timestamp === 0n) return 'N/A';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const textRecordKeys = Object.keys(lookupResult?.textRecords || {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Search size={28} className="text-[#00D179]" />
          Registrations
        </h1>
        <p className="text-[#8A8A8A]">Search for and view details of any registered name</p>
      </div>

      {/* Search */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
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

      {/* Results */}
      {lookupResult && (
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-clash text-2xl font-semibold text-white">
                {lookupResult.name}<span className="text-[#00D179]">.qf</span>
              </h2>
              <div className="flex items-center gap-2 mt-2">
                {lookupResult.isPermanent ? (
                  <span className="px-2 py-1 bg-[#00D179]/10 text-[#00D179] text-xs rounded-full font-medium">
                    Permanent
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-[#8A8A8A]/10 text-[#8A8A8A] text-xs rounded-full font-medium">
                    Annual
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Owner */}
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Owner</span>
              </div>
              <code className="text-white font-mono text-sm">{lookupResult.owner}</code>
            </div>

            {/* Resolved Address */}
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Resolved Address</span>
              </div>
              <code className="text-white font-mono text-sm">
                {lookupResult.resolvedAddress || 'Not set'}
              </code>
            </div>

            {/* Registered At */}
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">Registered</span>
              </div>
              <p className="text-white">{formatDateTime(lookupResult.registeredAt)}</p>
            </div>

            {/* Expires */}
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-[#00D179]" />
                <span className="text-[#8A8A8A] text-sm">{lookupResult.isPermanent ? 'Status' : 'Expires'}</span>
              </div>
              <p className="text-white">
                {lookupResult.isPermanent ? 'Never expires' : formatDateTime(lookupResult.expires)}
              </p>
            </div>
          </div>

          {/* Text Records */}
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

      {/* Empty State / Recent Registrations Note */}
      {!lookupResult && !isLookingUp && (
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-8 text-center">
          <Search size={48} className="text-[#1E1E1E] mx-auto mb-4" />
          <p className="text-[#8A8A8A]">
            Search a name to view its registration details
          </p>
          <p className="text-[#8A8A8A] text-sm mt-2">
            Event querying for recent registrations is not available in this view
          </p>
        </div>
      )}
    </div>
  );
}
