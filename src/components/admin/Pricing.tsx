import { useState, useEffect } from 'react';
import { useWalletStore } from '../../stores/walletStore';
import { useAdminStore } from '../../stores/adminStore';
import { parseEther, formatEther } from 'viem';
import { DollarSign, Save, Flame, Loader2, Tag } from 'lucide-react';

export default function Pricing() {
  const { address } = useWalletStore();
  const { price3Char, price4Char, price5PlusChar, permanentMultiplier, burnPercent, loadOverviewData, updatePrices, updatePermanentMultiplier, updateBurnPercent } = useAdminStore();

  const [price3Input, setPrice3Input] = useState('');
  const [price4Input, setPrice4Input] = useState('');
  const [price5Input, setPrice5Input] = useState('');
  const [multiplierInput, setMultiplierInput] = useState('');
  const [burnPercentInput, setBurnPercentInput] = useState('');
  
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isUpdatingMultiplier, setIsUpdatingMultiplier] = useState(false);
  const [isUpdatingBurn, setIsUpdatingBurn] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  useEffect(() => {
    if (price3Char) setPrice3Input(formatEther(price3Char));
    if (price4Char) setPrice4Input(formatEther(price4Char));
    if (price5PlusChar) setPrice5Input(formatEther(price5PlusChar));
    if (permanentMultiplier) setMultiplierInput(permanentMultiplier.toString());
    if (burnPercent) setBurnPercentInput(burnPercent.toString());
  }, [price3Char, price4Char, price5PlusChar, permanentMultiplier, burnPercent]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  const handleUpdatePrices = async () => {
    if (!address) return;
    
    try {
      const p3 = parseEther(price3Input);
      const p4 = parseEther(price4Input);
      const p5 = parseEther(price5Input);
      
      setIsUpdatingPrices(true);
      setError(null);
      
      await updatePrices({ char3: p3, char4: p4, char5Plus: p5 }, address);
      showSuccess('Prices updated successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to update prices');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const handleUpdateMultiplier = async () => {
    if (!address) return;
    
    const mult = BigInt(multiplierInput);
    if (mult < 1) {
      showError('Multiplier must be at least 1');
      return;
    }
    
    setIsUpdatingMultiplier(true);
    setError(null);
    
    try {
      await updatePermanentMultiplier(mult, address);
      showSuccess('Permanent multiplier updated');
    } catch (err: any) {
      showError(err.message || 'Failed to update multiplier');
    } finally {
      setIsUpdatingMultiplier(false);
    }
  };

  const handleUpdateBurnPercent = async () => {
    if (!address) return;
    
    const percent = BigInt(burnPercentInput);
    if (percent > 50n) {
      showError('Burn percent cannot exceed 50%');
      return;
    }
    
    setIsUpdatingBurn(true);
    setError(null);
    
    try {
      await updateBurnPercent(percent, address);
      showSuccess('Burn percentage updated');
    } catch (err: any) {
      showError(err.message || 'Failed to update burn percent');
    } finally {
      setIsUpdatingBurn(false);
    }
  };

  const formatUSD = (qf: string) => {
    const num = parseFloat(qf);
    const usd = num * 0.01;
    return `~$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-clash text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <DollarSign size={28} className="text-[#00D179]" />
          Pricing
        </h1>
        <p className="text-[#8A8A8A]">Update registration prices and fees</p>
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

      {/* Current Prices Display */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Tag size={18} className="text-[#00D179]" />
          Current Prices
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#0A0A0A] rounded-xl">
            <p className="text-[#8A8A8A] text-sm mb-1">3-Character Names</p>
            <p className="font-clash text-2xl font-semibold text-white">
              {price3Char !== null ? parseFloat(formatEther(price3Char)).toLocaleString() : '-'} <span className="text-[#00D179] text-lg">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs">
              {price3Char !== null ? formatUSD(formatEther(price3Char)) : ''}
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-xl">
            <p className="text-[#8A8A8A] text-sm mb-1">4-Character Names</p>
            <p className="font-clash text-2xl font-semibold text-white">
              {price4Char !== null ? parseFloat(formatEther(price4Char)).toLocaleString() : '-'} <span className="text-[#00D179] text-lg">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs">
              {price4Char !== null ? formatUSD(formatEther(price4Char)) : ''}
            </p>
          </div>
          <div className="p-4 bg-[#0A0A0A] rounded-xl">
            <p className="text-[#8A8A8A] text-sm mb-1">5+ Character Names</p>
            <p className="font-clash text-2xl font-semibold text-white">
              {price5PlusChar !== null ? parseFloat(formatEther(price5PlusChar)).toLocaleString() : '-'} <span className="text-[#00D179] text-lg">QF</span>
            </p>
            <p className="text-[#8A8A8A] text-xs">
              {price5PlusChar !== null ? formatUSD(formatEther(price5PlusChar)) : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Update Prices */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-4">Update Annual Prices</h2>
        <p className="text-[#8A8A8A] text-sm mb-4">Enter prices in QF (will be multiplied by 1e18)</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-2">3-Character Price (QF)</label>
            <input
              type="number"
              value={price3Input}
              onChange={(e) => setPrice3Input(e.target.value)}
              placeholder="1000"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-2">4-Character Price (QF)</label>
            <input
              type="number"
              value={price4Input}
              onChange={(e) => setPrice4Input(e.target.value)}
              placeholder="300"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[#8A8A8A] text-sm mb-2">5+ Character Price (QF)</label>
            <input
              type="number"
              value={price5Input}
              onChange={(e) => setPrice5Input(e.target.value)}
              placeholder="100"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
        </div>
        
        <button
          onClick={handleUpdatePrices}
          disabled={isUpdatingPrices || !price3Input || !price4Input || !price5Input}
          className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isUpdatingPrices ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Update Prices
        </button>
      </div>

      {/* Permanent Multiplier */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2">Permanent Registration Multiplier</h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          Current: {permanentMultiplier !== null ? `${permanentMultiplier}x` : '-'} (annual price × multiplier = permanent price)
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Multiplier</label>
            <input
              type="number"
              value={multiplierInput}
              onChange={(e) => setMultiplierInput(e.target.value)}
              placeholder="15"
              min="1"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
          <button
            onClick={handleUpdateMultiplier}
            disabled={isUpdatingMultiplier || !multiplierInput}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isUpdatingMultiplier ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Update
          </button>
        </div>
      </div>

      {/* Burn Percentage */}
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <h2 className="font-clash text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Flame size={18} className="text-[#E5484D]" />
          Burn Percentage
        </h2>
        <p className="text-[#8A8A8A] text-sm mb-4">
          Current: {burnPercent !== null ? `${burnPercent}%` : '-'} of each registration fee is sent to the burn address
        </p>
        
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#8A8A8A] text-sm mb-2">New Burn % (max 50%)</label>
            <input
              type="number"
              value={burnPercentInput}
              onChange={(e) => setBurnPercentInput(e.target.value)}
              placeholder="5"
              min="0"
              max="50"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl text-white placeholder-[#8A8A8A] focus:border-[#00D179] focus:outline-none"
            />
          </div>
          <button
            onClick={handleUpdateBurnPercent}
            disabled={isUpdatingBurn || !burnPercentInput}
            className="px-6 py-3 bg-[#00D179] hover:bg-[#00B868] text-[#0A0A0A] font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isUpdatingBurn ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
