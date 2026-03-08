import { useState, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore } from '../../stores/adminStore';
import { validateNameLocal } from '../../utils/qns';
import { Bookmark, Plus, Trash2, UserPlus, Search, Loader2 } from 'lucide-react';

export default function ReserveNames() {
  const { address } = useWalletStore();
  const { reservedNames, isLoadingReserved, loadReservedNames, reserveName, unreserveName, assignReservedName } = useAdminStore();
  
  const [singleName, setSingleName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [isReserving, setIsReserving] = useState(false);
  const [reservingProgress, setReservingProgress] = useState({ current: 0, total: 0 });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignName, setAssignName] = useState('');
  const [assignAddress, setAssignAddress] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadReservedNames();
  }, [loadReservedNames]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleReserveSingle = async () => {
    if (!address) return;
    
    const validation = validateNameLocal(singleName);
    if (!validation.valid) {
      showError(validation.error || 'Invalid name');
      return;
    }

    setIsReserving(true);
    setError(null);
    try {
      await reserveName(singleName.toLowerCase(), address);
      showSuccess(`Reserved "${singleName.toLowerCase()}"`);
      setSingleName('');
    } catch (err: any) {
      showError(err.message || 'Failed to reserve name');
    } finally {
      setIsReserving(false);
    }
  };

  const handleReserveBulk = async () => {
    if (!address) return;
    
    const names = bulkNames
      .split('\n')
      .map(n => n.trim().toLowerCase())
      .filter(n => n.length > 0);
    
    if (names.length === 0) {
      showError('No valid names provided');
      return;
    }

    // Validate all names first
    for (const name of names) {
      const validation = validateNameLocal(name);
      if (!validation.valid) {
        showError(`Invalid name "${name}": ${validation.error}`);
        return;
      }
    }

    setIsReserving(true);
    setReservingProgress({ current: 0, total: names.length });
    setError(null);

    try {
      for (let i = 0; i < names.length; i++) {
        setReservingProgress({ current: i + 1, total: names.length });
        await reserveName(names[i], address);
      }
      showSuccess(`Reserved ${names.length} names`);
      setBulkNames('');
    } catch (err: any) {
      showError(err.message || 'Failed to reserve some names');
    } finally {
      setIsReserving(false);
      setReservingProgress({ current: 0, total: 0 });
    }
  };

  const handleUnreserve = async (name: string) => {
    if (!address) return;
    
    if (!confirm(`Are you sure you want to unreserve "${name}"?`)) {
      return;
    }

    try {
      await unreserveName(name, address);
      showSuccess(`Unreserved "${name}"`);
    } catch (err: any) {
      showError(err.message || 'Failed to unreserve name');
    }
  };

  const handleAssign = async () => {
    if (!address) return;
    
    if (!assignAddress || !assignAddress.startsWith('0x') || assignAddress.length !== 42) {
      showError('Invalid address format');
      return;
    }

    setIsAssigning(true);
    try {
      await assignReservedName(assignName, assignAddress as `0x${string}`, address);
      showSuccess(`Assigned "${assignName}" to ${assignAddress.slice(0, 6)}...${assignAddress.slice(-4)}`);
      setAssignModalOpen(false);
      setAssignName('');
      setAssignAddress('');
    } catch (err: any) {
      showError(err.message || 'Failed to assign name');
    } finally {
      setIsAssigning(false);
    }
  };

  const openAssignModal = (name: string) => {
    setAssignName(name);
    setAssignAddress('');
    setAssignModalOpen(true);
  };

  const filteredNames = reservedNames.filter(name => 
    name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Bookmark size={28} className="text-[#00D179]" />
          Reserve Names
        </h1>
        <p className="text-[#8A8A8A]">Reserve names to prevent registration, or assign them to specific addresses</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-xl text-[#E5484D]">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-[#00D179]/10 border border-[#00D179]/30 rounded-xl text-[#00D179]">
          {success}
        </div>
      )}

      {/* Single Reserve */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Reserve Single Name</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="Enter name to reserve (e.g., quantum)"
            className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            disabled={isReserving}
          />
          <button
            onClick={handleReserveSingle}
            disabled={isReserving || !singleName}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isReserving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Reserve
          </button>
        </div>
      </div>

      {/* Bulk Reserve */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Bulk Reserve</h2>
        <p className="text-[#8A8A8A] text-sm mb-3">Enter one name per line</p>
        <textarea
          value={bulkNames}
          onChange={(e) => setBulkNames(e.target.value)}
          placeholder="quantum&#10;fusion&#10;defi&#10;..."
          rows={5}
          className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none mb-4 font-mono text-sm"
          disabled={isReserving}
        />
        {reservingProgress.total > 0 && (
          <div className="mb-4 p-3 bg-[#0A0A0A] rounded-lg">
            <p className="text-[#8A8A8A] text-sm">
              Reserving {reservingProgress.current}/{reservingProgress.total}...
            </p>
            <div className="mt-2 h-1 bg-[#1E1E1E] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00D179] transition-all duration-300"
                style={{ width: `${(reservingProgress.current / reservingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={handleReserveBulk}
          disabled={isReserving || !bulkNames.trim()}
          className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isReserving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          Reserve All
        </button>
      </div>

      {/* Reserved Names List */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-clash text-lg font-semibold text-white">Reserved Names ({reservedNames.length})</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter names..."
              className="pl-9 pr-4 py-2 bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg text-sm text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
        </div>

        {isLoadingReserved ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-[#00D179] animate-spin" />
          </div>
        ) : filteredNames.length === 0 ? (
          <p className="text-[#8A8A8A] text-center py-8">
            {searchFilter ? 'No names match your filter' : 'No reserved names'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredNames.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-lg border border-[#1E1E1E]"
              >
                <span className="font-medium text-white">
                  {name}<span className="text-[#00D179]">.qf</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAssignModal(name)}
                    className="p-2 text-[#00D179] hover:bg-[#00D179]/10 rounded-lg transition-colors"
                    title="Assign to address"
                  >
                    <UserPlus size={16} />
                  </button>
                  <button
                    onClick={() => handleUnreserve(name)}
                    className="p-2 text-[#E5484D] hover:bg-[#E5484D]/10 rounded-lg transition-colors"
                    title="Release reservation"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 max-w-md w-full">
            <h3 className="font-clash text-xl font-semibold text-white mb-2">
              Assign "{assignName}.qf"
            </h3>
            <p className="text-[#8A8A8A] text-sm mb-4">
              Enter the recipient address to assign this reserved name to:
            </p>
            <input
              type="text"
              value={assignAddress}
              onChange={(e) => setAssignAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none mb-4 font-mono text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 px-4 py-3 border border-[#1E1E1E] text-white rounded-xl hover:bg-[#1E1E1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={isAssigning || !assignAddress}
                className="flex-1 px-4 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAssigning ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
