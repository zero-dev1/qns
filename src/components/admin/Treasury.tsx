import { useState, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore } from '../../stores/adminStore';
import { formatQF, formatUSD } from '../../utils/qns';
import { Wallet, ArrowUpRight, Loader2, AlertTriangle } from 'lucide-react';

export default function Treasury() {
  const { address } = useWalletStore();
  const { contractBalance, treasuryAddress, loadOverviewData, withdrawToTreasury } = useAdminStore();
  
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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

  const handleWithdraw = async () => {
    if (!address) return;
    
    setIsWithdrawing(true);
    setShowConfirmModal(false);
    setError(null);
    
    try {
      await withdrawToTreasury(address);
      showSuccess(`Withdrew ${contractBalance ? formatQF(contractBalance) : ''} QF to treasury`);
    } catch (err: any) {
      showError(err.message || 'Failed to withdraw to treasury');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Wallet size={28} className="text-[#00D179]" />
          Treasury
        </h1>
        <p className="text-[#8A8A8A]">Manage contract funds and withdrawals</p>
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

      {/* Balance Display */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-8">
        <p className="text-[#8A8A8A] text-sm mb-2">Contract Balance</p>
        <p className="font-clash text-5xl font-semibold text-[#00D179] mb-2">
          {contractBalance !== null ? formatQF(contractBalance) : '-'} <span className="text-2xl">QF</span>
        </p>
        <p className="text-[#8A8A8A]">
          {contractBalance !== null ? formatUSD(contractBalance) : ''}
        </p>
      </div>

      {/* Treasury & Burn Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
          <p className="text-[#8A8A8A] text-sm mb-2">Treasury Address</p>
          <code className="text-white font-mono text-sm block mb-2">
            {treasuryAddress || '-'}
          </code>
          <p className="text-[#8A8A8A] text-xs">
            All withdrawals are sent to this address
          </p>
        </div>
        
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
          <p className="text-[#8A8A8A] text-sm mb-2">Withdrawal Status</p>
          <p className="text-white">
            {contractBalance && contractBalance > 0n ? (
              <span className="text-[#00D179]">Funds available for withdrawal</span>
            ) : (
              <span className="text-[#8A8A8A]">No funds to withdraw</span>
            )}
          </p>
        </div>
      </div>

      {/* Withdraw Button */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Withdraw to Treasury</h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          This will transfer the entire contract balance to the treasury address.
        </p>
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isWithdrawing || !contractBalance || contractBalance === 0n}
          className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : <ArrowUpRight size={18} />}
          Withdraw to Treasury
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-[#E5484D]/10 rounded-lg">
                <AlertTriangle size={24} className="text-[#E5484D]" />
              </div>
              <h3 className="font-clash text-xl font-semibold text-white">Confirm Withdrawal</h3>
            </div>
            
            <p className="text-[#8A8A8A] mb-4">
              Are you sure you want to withdraw the entire contract balance?
            </p>
            
            <div className="p-4 bg-[#0A0A0A] rounded-xl mb-6">
              <p className="text-[#8A8A8A] text-sm mb-1">Amount to withdraw:</p>
              <p className="font-clash text-2xl font-semibold text-[#00D179]">
                {contractBalance !== null ? formatQF(contractBalance) : '-'} QF
              </p>
              <p className="text-[#8A8A8A] text-sm mt-1">
                To: {truncateAddress(treasuryAddress)}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 border border-[#1E1E1E] text-white rounded-xl hover:bg-[#1E1E1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                className="flex-1 px-4 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
