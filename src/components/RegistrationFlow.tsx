import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../stores/walletStore';
import { getPrice, formatQF, formatUSD, registerName } from '../utils/qns';
import { Twitter } from 'lucide-react';
import SearchBar from './SearchBar';

type TxState = 'idle' | 'pending' | 'success' | 'failed';

const durations = [
  { label: '1 year', years: 1, permanent: false },
  { label: '2 years', years: 2, permanent: false },
  { label: '5 years', years: 5, permanent: false },
  { label: 'Permanent', years: 1, permanent: true },
];

export default function RegistrationFlow() {
  const { address, connect, refreshName } = useWalletStore();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [txState, setTxState] = useState<TxState>('idle');
  const [price, setPrice] = useState<bigint | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const activeName = name;
  const duration = durations[selectedDuration];

  // Fetch live price when name or duration changes
  useEffect(() => {
    if (!activeName) {
      setPrice(null);
      return;
    }
    
    setPriceLoading(true);
    getPrice(activeName, duration.years, duration.permanent)
      .then(setPrice)
      .catch(() => setPrice(null))
      .finally(() => setPriceLoading(false));
  }, [activeName, duration.years, duration.permanent, selectedDuration]);

  const handleRegister = async () => {
    if (!activeName) return;
    if (!address) {
      await connect();
      return;
    }
    setTxState('pending');
    try {
      await registerName(activeName, duration.years, duration.permanent, address);
      setTxState('success');
      await refreshName();
    } catch {
      setTxState('failed');
    }
  };

  const handleRetry = () => {
    setTxState('idle');
  };

  const handleNewSearch = () => {
    setName(null);
    setTxState('idle');
  };

  const handleSetupProfile = () => {
    if (activeName) {
      navigate(`/my-names?expand=${activeName}`);
    }
  };

  const handleShareOnX = () => {
    if (!activeName) return;
    const text = `I just claimed my .qf name on @theqfnetwork 🟢 #QNS`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://dotqf.xyz/name/${activeName}`)}`;
    window.open(url, '_blank');
  };

  const priceDisplay = () => {
    if (!activeName || price === null) return priceLoading ? 'Loading price...' : '';
    const qf = formatQF(price);
    const usd = formatUSD(price);
    if (duration.permanent) {
      return `${qf} QF (${usd}) — own forever`;
    }
    if (duration.years === 1) {
      return `Total: ${qf} QF (${usd})`;
    }
    return `${formatQF(price / BigInt(duration.years))} QF × ${duration.years} years = ${qf} QF (${usd})`;
  };

  return (
    <section id="register" className="py-[100px] px-6">
      <div className="max-w-[480px] mx-auto bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6 md:p-8 transition-all duration-150 ease-in-out">
        {!activeName && txState === 'idle' && (
          <div className="transition-all duration-150 ease-in-out animate-fade-in">
            <h2 className="font-clash font-medium text-2xl text-white mb-5">
              Register your <span className="text-[#00D179]">.qf</span> name
            </h2>
            <SearchBar onSelect={(n) => setName(n)} compact />
          </div>
        )}

        {activeName && txState === 'idle' && (
          <div className="transition-all duration-150 ease-in-out animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="font-clash font-medium text-[36px] text-white">
                {activeName}<span className="text-[#00D179]">.qf</span>
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="text-sm text-[#00D179] font-medium">Available</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 bg-[#0A0A0A] rounded-xl p-1 mb-6">
              {durations.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setSelectedDuration(i)}
                  className={`py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ease-in-out cursor-pointer ${
                    selectedDuration === i
                      ? 'bg-[#00D179] text-black'
                      : 'text-[#8A8A8A] hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <p className="text-center text-white font-satoshi font-medium mb-6">
              {priceDisplay()}
            </p>

            <button
              onClick={handleRegister}
              disabled={price === null || priceLoading}
              className="w-full py-3.5 bg-[#00D179] hover:bg-[#00B868] text-black font-bold rounded-xl transition-all duration-200 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {address ? `Register ${activeName}.qf` : 'Connect Wallet'}
            </button>
          </div>
        )}

        {txState === 'pending' && (
          <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
            <div className="inline-block w-8 h-8 border-3 border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin mb-4" />
            <p className="text-[#8A8A8A] font-satoshi">Confirming transaction...</p>
          </div>
        )}

        {txState === 'success' && (
          <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
            <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <p className="font-clash font-medium text-2xl text-[#00D179] mb-2">
              {activeName}<span className="text-[#00D179]">.qf</span> is yours!
            </p>

            {/* New action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 mb-4">
              <button
                onClick={handleSetupProfile}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-[#00D179] text-[#00D179] font-medium hover:bg-[#00D17915] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                Set up your profile
              </button>
              <button
                onClick={handleShareOnX}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E1E1E] text-white font-medium hover:bg-[#2a2a2a] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <Twitter size={16} />
                Share on X
              </button>
            </div>

            <button
              onClick={handleNewSearch}
              className="text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
            >
              Register another name
            </button>
          </div>
        )}

        {txState === 'failed' && (
          <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
            <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <p className="text-[#E5484D] font-medium mb-2">Transaction failed. Try again.</p>
            <button
              onClick={handleRetry}
              className="mt-2 px-6 py-2.5 bg-[#E5484D] hover:bg-[#c93d41] text-white rounded-lg font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
