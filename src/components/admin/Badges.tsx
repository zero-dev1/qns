import { useState } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore } from '../../stores/adminStore';
import { hapticSuccess, hapticError } from '../../utils/haptics';
import { Award, Search, Plus, X, Check, Loader2, Copy } from 'lucide-react';

export default function Badges() {
  const { address, ss58Address } = useWalletStore();
  const { 
    badgeLookupName, 
    badgeLookupResult, 
    isCheckingBadges, 
    setBadgeLookupName, 
    checkBadges, 
    assignBadge, 
    revokeBadge, 
    assignBadgeBatch 
  } = useAdminStore();
  
  const [bulkNames, setBulkNames] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleCheckBadges = async () => {
    if (!badgeLookupName.trim()) {
      showError('Please enter a name to check');
      return;
    }

    try {
      await checkBadges(badgeLookupName.trim());
    } catch (err: any) {
      let userMessage = 'Failed to check badges';
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        } else if (message.includes('unauthorized') || message.includes('not authorized') || message.includes('permission')) {
          userMessage = 'You are not authorized to perform this action';
        }
      }
      showError(err.message || userMessage);
    }
  };

  const handleAssignBadge = async (badgeType: string) => {
    if (!address || !badgeLookupResult) return;
    
    setIsAssigning(true);
    setError(null);
    try {
      const signerAddress = ss58Address || address;
      const { confirmation } = await assignBadge(badgeLookupName.trim(), badgeType, signerAddress);
      showSuccess(`Assigning ${badgeType} badge to ${badgeLookupName}.qf — confirming...`);

      // Await on-chain confirmation
      confirmation.then(async (result) => {
        if (result.confirmed) {
          showSuccess(`${badgeType} badge assigned to ${badgeLookupName}.qf`);
          hapticSuccess();
        } else {
          showError(`Badge assignment failed on-chain: ${result.error || 'Transaction reverted'}`);
          hapticError();
        }
        // Re-check badges regardless to get fresh state
        await checkBadges(badgeLookupName.trim());
        setIsAssigning(false);
      });
    } catch (err: any) {
      let userMessage = 'Failed to assign badge';
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        } else if (message.includes('unauthorized') || message.includes('not authorized') || message.includes('permission')) {
          userMessage = 'You are not authorized to perform this action';
        }
      }
      showError(err.message || userMessage);
      hapticError();
      setIsAssigning(false);
    }
  };

  const handleRevokeBadge = async (badgeType: string) => {
    if (!address || !badgeLookupResult) return;
    
    setIsRevoking(true);
    setError(null);
    try {
      const signerAddress = ss58Address || address;
      const { confirmation } = await revokeBadge(badgeLookupName.trim(), badgeType, signerAddress);
      showSuccess(`Revoking ${badgeType} badge from ${badgeLookupName}.qf — confirming...`);

      // Await on-chain confirmation
      confirmation.then(async (result) => {
        if (result.confirmed) {
          showSuccess(`${badgeType} badge revoked from ${badgeLookupName}.qf`);
          hapticSuccess();
        } else {
          showError(`Badge revocation failed on-chain: ${result.error || 'Transaction reverted'}`);
          hapticError();
        }
        // Re-check badges regardless to get fresh state
        await checkBadges(badgeLookupName.trim());
        setIsRevoking(false);
      });
    } catch (err: any) {
      let userMessage = 'Failed to revoke badge';
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        } else if (message.includes('unauthorized') || message.includes('not authorized') || message.includes('permission')) {
          userMessage = 'You are not authorized to perform this action';
        }
      }
      showError(err.message || userMessage);
      hapticError();
      setIsRevoking(false);
    }
  };

  const handleBatchAssign = async () => {
    if (!address) return;
    
    const names = bulkNames
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) {
      showError('Please enter at least one name');
      return;
    }

    setIsBatchAssigning(true);
    setError(null);
    try {
      const signerAddress = ss58Address || address;
      const { confirmation } = await assignBadgeBatch(names, 'pioneer', signerAddress);
      showSuccess(`Assigning pioneer badges to ${names.length} names — confirming...`);

      confirmation.then(async (result) => {
        if (result.confirmed) {
          showSuccess(`Pioneer badges assigned to ${names.length} names`);
          hapticSuccess();
          setBulkNames('');
        } else {
          showError(`Batch assignment failed on-chain: ${result.error || 'Transaction reverted'}`);
          hapticError();
        }
        setIsBatchAssigning(false);
      });
    } catch (err: any) {
      let userMessage = 'Failed to assign badges in batch';
      if (err.message) {
        const message = err.message.toLowerCase();
        if (message.includes('rejected') || message.includes('denied') || message.includes('user rejected')) {
          userMessage = 'Transaction rejected';
        } else if (message.includes('unauthorized') || message.includes('not authorized') || message.includes('permission')) {
          userMessage = 'You are not authorized to perform this action';
        }
      }
      showError(err.message || userMessage);
      hapticError();
      setIsBatchAssigning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const badgeTypes = [
    { key: 'pioneer', label: 'Pioneer', color: '#FFD700' },
    { key: 'team', label: 'Team', color: '#DADADA' },
    { key: 'dapplab', label: 'dApp Lab', color: '#00EFE7' },
    { key: 'ambassador', label: 'Ambassador', color: '#FF6B35' },
  ];


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Award size={28} className="text-[#00D179]" />
          Badge Management
        </h1>
        <p className="text-[#8A8A8A]">Assign and revoke on-chain badges for .qf names</p>
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


      {/* Card 1: Check Badges */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Check Badges</h2>
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={badgeLookupName}
            onChange={(e) => setBadgeLookupName(e.target.value)}
            placeholder="Enter name (e.g., alice)"
            className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            disabled={isCheckingBadges}
          />
          <button
            onClick={handleCheckBadges}
            disabled={isCheckingBadges || !badgeLookupName.trim()}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCheckingBadges ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Check
          </button>
        </div>

        {/* Results */}
        {badgeLookupResult && (
          <div className="space-y-4">
            <div className="p-4 bg-[#0A0A0A] rounded-xl border border-[#1E1E1E]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{badgeLookupName}.qf</span>
                <button
                  onClick={() => copyToClipboard(badgeLookupResult.nameHash)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <Copy size={16} className="text-[#8A8A8A]" />
                </button>
              </div>
              <div className="text-[#8A8A8A] text-sm font-mono mb-4">
                {truncateHash(badgeLookupResult.nameHash)}
              </div>
              
              <div className="space-y-2">
                {badgeTypes.map((badgeType) => {
                  const hasBadge = badgeLookupResult.badges.includes(badgeType.key);
                  return (
                    <div key={badgeType.key} className="flex items-center justify-between p-3 bg-[#141414] rounded-lg border border-[#1E1E1E]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: badgeType.color }}
                        />
                        <span className="text-white font-medium">{badgeType.label}</span>
                        <span className="text-[#8A8A8A] text-sm">({badgeType.key})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasBadge ? (
                          <>
                            <Check size={16} className="text-[#00D179]" />
                            <button
                              onClick={() => handleRevokeBadge(badgeType.key)}
                              disabled={isRevoking}
                              className="px-3 py-1 bg-[#E5484D] hover:bg-[#C74242] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRevoking ? <Loader2 size={14} className="animate-spin" /> : 'Revoke'}
                            </button>
                          </>
                        ) : (
                          <>
                            <X size={16} className="text-[#8A8A8A]" />
                            <button
                              onClick={() => handleAssignBadge(badgeType.key)}
                              disabled={isAssigning}
                              className="px-3 py-1 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isAssigning ? <Loader2 size={14} className="animate-spin" /> : 'Assign'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Batch Assign Pioneer Badges */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Batch Assign Pioneer Badges</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Names (one per line)
            </label>
            <textarea
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
              placeholder="alice&#10;bob&#10;charlie"
              rows={6}
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none resize-none font-mono text-sm"
              disabled={isBatchAssigning}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[#8A8A8A] text-sm">
              {bulkNames.split('\n').filter(name => name.trim()).length} names
            </span>
            <button
              onClick={handleBatchAssign}
              disabled={isBatchAssigning || !bulkNames.trim()}
              className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isBatchAssigning ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Assign Pioneer Badges
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Badge Type Legend */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Badge Type Legend</h2>
        <div className="space-y-3">
          {badgeTypes.map((badgeType) => (
            <div key={badgeType.key} className="flex items-center gap-4">
              <div
                className="w-6 h-6 rounded-full border-2 border-white/20"
                style={{ backgroundColor: badgeType.color }}
              />
              <div>
                <span className="text-white font-medium">{badgeType.label}</span>
                <span className="text-[#8A8A8A] ml-2">({badgeType.key})</span>
              </div>
              <span className="text-[#8A8A8A] text-sm font-mono">{badgeType.color}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
