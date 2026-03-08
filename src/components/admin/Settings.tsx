import { useState, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore } from '../../stores/adminStore';
import { Shield, UserCog, Wallet, Flame, Link as LinkIcon, AlertTriangle, Loader2, Save, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const { address } = useWalletStore();
  const { adminAddress, treasuryAddress, burnAddress, loadOverviewData, transferAdmin, setTreasury, setBurnAddress, setDefaultResolver } = useAdminStore();
  
  // Transfer admin
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [adminConfirmText, setAdminConfirmText] = useState('');
  const [isTransferringAdmin, setIsTransferringAdmin] = useState(false);
  
  // Treasury
  const [newTreasury, setNewTreasury] = useState('');
  const [isUpdatingTreasury, setIsUpdatingTreasury] = useState(false);
  
  // Burn address
  const [newBurnAddress, setNewBurnAddress] = useState('');
  const [isUpdatingBurn, setIsUpdatingBurn] = useState(false);
  
  // Default resolver
  const [newResolver, setNewResolver] = useState('');
  const [isUpdatingResolver, setIsUpdatingResolver] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  const validateAddress = (addr: string): boolean => {
    return addr.startsWith('0x') && addr.length === 42;
  };

  const handleTransferAdmin = async () => {
    if (!address) return;
    
    if (adminConfirmText !== 'CONFIRM') {
      showError('Please type CONFIRM to proceed');
      return;
    }
    
    if (!validateAddress(newAdminAddress)) {
      showError('Invalid address format');
      return;
    }
    
    setIsTransferringAdmin(true);
    setError(null);
    
    try {
      await transferAdmin(newAdminAddress as `0x${string}`, address);
      showSuccess('Admin transferred successfully');
      setNewAdminAddress('');
      setAdminConfirmText('');
      setShowAdminConfirm(false);
    } catch (err: any) {
      showError(err.message || 'Failed to transfer admin');
    } finally {
      setIsTransferringAdmin(false);
    }
  };

  const handleSetTreasury = async () => {
    if (!address) return;
    
    if (!validateAddress(newTreasury)) {
      showError('Invalid address format');
      return;
    }
    
    setIsUpdatingTreasury(true);
    setError(null);
    
    try {
      await setTreasury(newTreasury as `0x${string}`, address);
      showSuccess('Treasury address updated');
      setNewTreasury('');
    } catch (err: any) {
      showError(err.message || 'Failed to update treasury');
    } finally {
      setIsUpdatingTreasury(false);
    }
  };

  const handleSetBurnAddress = async () => {
    if (!address) return;
    
    if (!validateAddress(newBurnAddress)) {
      showError('Invalid address format');
      return;
    }
    
    setIsUpdatingBurn(true);
    setError(null);
    
    try {
      await setBurnAddress(newBurnAddress as `0x${string}`, address);
      showSuccess('Burn address updated');
      setNewBurnAddress('');
    } catch (err: any) {
      showError(err.message || 'Failed to update burn address');
    } finally {
      setIsUpdatingBurn(false);
    }
  };

  const handleSetResolver = async () => {
    if (!address) return;
    
    if (!validateAddress(newResolver)) {
      showError('Invalid address format');
      return;
    }
    
    setIsUpdatingResolver(true);
    setError(null);
    
    try {
      await setDefaultResolver(newResolver as `0x${string}`, address);
      showSuccess('Default resolver updated');
      setNewResolver('');
    } catch (err: any) {
      showError(err.message || 'Failed to update resolver');
    } finally {
      setIsUpdatingResolver(false);
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '-';
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <SettingsIcon size={28} className="text-[#00D179]" />
          Settings
        </h1>
        <p className="text-[#8A8A8A]">Manage admin settings and contract configuration</p>
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

      {/* Current Admin */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-[#00D179]" />
          Current Admin
        </h2>
        <code className="block p-3 bg-[#0A0A0A] rounded-lg text-white font-mono text-sm">
          {adminAddress || '-'}
        </code>
      </div>

      {/* Transfer Admin */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <UserCog size={18} className="text-[#E5484D]" />
          Transfer Admin
        </h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          <span className="text-[#E5484D]">Warning:</span> This will permanently transfer admin control to a new address. This action cannot be undone.
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Admin Address</label>
            <input
              type="text"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none font-mono text-sm"
            />
          </div>
          <button
            onClick={() => setShowAdminConfirm(true)}
            disabled={!newAdminAddress}
            className="px-6 py-3 bg-[#E5484D]/20 hover:bg-[#E5484D]/30 text-[#E5484D] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            Transfer
          </button>
        </div>
      </div>

      {/* Treasury Address */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Wallet size={18} className="text-[#00D179]" />
          Treasury Address
        </h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          Current: {truncateAddress(treasuryAddress)}
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Treasury Address</label>
            <input
              type="text"
              value={newTreasury}
              onChange={(e) => setNewTreasury(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none font-mono text-sm"
            />
          </div>
          <button
            onClick={handleSetTreasury}
            disabled={isUpdatingTreasury || !newTreasury}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isUpdatingTreasury ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Update
          </button>
        </div>
      </div>

      {/* Burn Address */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Flame size={18} className="text-[#E5484D]" />
          Burn Address
        </h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          Current: {truncateAddress(burnAddress)}
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Burn Address</label>
            <input
              type="text"
              value={newBurnAddress}
              onChange={(e) => setNewBurnAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none font-mono text-sm"
            />
          </div>
          <button
            onClick={handleSetBurnAddress}
            disabled={isUpdatingBurn || !newBurnAddress}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isUpdatingBurn ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Update
          </button>
        </div>
      </div>

      {/* Default Resolver */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <LinkIcon size={18} className="text-[#00D179]" />
          Default Resolver
        </h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          The resolver contract used for new registrations
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Resolver Address</label>
            <input
              type="text"
              value={newResolver}
              onChange={(e) => setNewResolver(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none font-mono text-sm"
            />
          </div>
          <button
            onClick={handleSetResolver}
            disabled={isUpdatingResolver || !newResolver}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isUpdatingResolver ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Update
          </button>
        </div>
      </div>

      {/* Admin Transfer Confirmation Modal */}
      {showAdminConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#141414] border border-[#E5484D]/30 rounded-[12px] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#E5484D]/10 rounded-lg">
                <AlertTriangle size={24} className="text-[#E5484D]" />
              </div>
              <h3 className="font-clash text-xl font-semibold text-white">Confirm Admin Transfer</h3>
            </div>
            
            <p className="text-[#E5484D] font-medium mb-4">
              This will permanently transfer admin control. You cannot undo this action.
            </p>
            
            <div className="p-4 bg-[#0A0A0A] rounded-xl mb-4">
              <p className="text-[#8A8A8A] text-sm mb-1">New admin will be:</p>
              <code className="text-white font-mono text-sm">{newAdminAddress}</code>
            </div>
            
            <p className="text-[#8A8A8A] text-sm mb-2">
              Type "CONFIRM" to proceed:
            </p>
            <input
              type="text"
              value={adminConfirmText}
              onChange={(e) => setAdminConfirmText(e.target.value)}
              placeholder="CONFIRM"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#E5484D]/30 rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#E5484D] focus:outline-none mb-6 font-mono text-sm"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdminConfirm(false);
                  setAdminConfirmText('');
                }}
                className="flex-1 px-4 py-3 border border-[#1E1E1E] text-white rounded-xl hover:bg-[#1E1E1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferAdmin}
                disabled={isTransferringAdmin || adminConfirmText !== 'CONFIRM'}
                className="flex-1 px-4 py-3 bg-[#E5484D] hover:bg-[#D43D42] text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTransferringAdmin ? <Loader2 size={18} className="animate-spin" /> : 'Transfer Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
