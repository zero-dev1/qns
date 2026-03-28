import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Twitter, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../../stores/walletStore';
import { useNamesStore } from '../../stores/namesStore';
import { useToast } from '../../contexts/ToastContext';
import { hapticSuccess, hapticError } from '../../utils/haptics';
import { isRetryableError, RETRY_MESSAGE_SHORT } from '../../utils/errorHelpers';
import { getPrice, registerName, getQFBalance, getSubstrateQFBalance, formatQF, setMultipleTextRecords, setPrimaryName } from '../../utils/qns';
import type { TxState, TxErrorType } from '../../types/search';

const durations = [
  { label: '1 year', years: 1, permanent: false },
  { label: '2 years', years: 2, permanent: false },
  { label: '5 years', years: 5, permanent: false },
  { label: 'Permanent', years: 1, permanent: true },
];

interface RegistrationPanelProps {
  selectedName: string;
  onBack: () => void;
  onRegisterSuccess: (name: string) => void;
}

export default function RegistrationPanel({
  selectedName,
  onBack,
  onRegisterSuccess,
}: RegistrationPanelProps) {
  const navigate = useNavigate();
  const { address, ss58Address, connect, refreshName, providerType } = useWalletStore();
  const { setOwnedNames, ownedNames: existingStoreNames } = useNamesStore();
  const { showToast } = useToast();

  // Local state
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [txState, setTxState] = useState<TxState>('idle');
  const [txError, setTxError] = useState<{ type: TxErrorType; message: string } | null>(null);
  const [regPrice, setRegPrice] = useState<bigint | null>(null);
  const [regPriceLoading, setRegPriceLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<'celebrate' | 'avatar' | 'bio' | 'share'>('celebrate');
  const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bioText, setBioText] = useState('');
  const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingRecords, setSavingRecords] = useState(false);

  const batchSaveRecords = async () => {
    if (!selectedName || !address) return;

    const keys: string[] = [];
    const values: string[] = [];

    if (avatarUrl.trim()) {
      keys.push('avatar');
      values.push(avatarUrl.trim());
    }
    if (bioText.trim()) {
      keys.push('bio');
      values.push(bioText.trim());
    }

    // Nothing to save — skip silently
    if (keys.length === 0) return;

    setSavingRecords(true);
    try {
      const signerAddress = providerType === 'evm' ? address : (ss58Address || address);
      await setMultipleTextRecords(selectedName, keys, values, signerAddress);
    } catch {
      // Silent fail — don't block onboarding. User can edit later in My Names.
    } finally {
      setSavingRecords(false);
    }
  };

  const goToStep = (target: 'celebrate' | 'avatar' | 'bio' | 'share', direction: 'forward' | 'back') => {
    setStepDirection(direction);
    setOnboardingStep(target);
  };

  const duration = durations[selectedDuration];

  // Fetch registration price when selectedName or duration changes
  useEffect(() => {
    setRegPriceLoading(true);
    getPrice(selectedName, duration.years, duration.permanent)
      .then(price => setRegPrice(price))
      .catch(() => setRegPrice(null))
      .finally(() => setRegPriceLoading(false));
  }, [selectedName, duration.years, duration.permanent]);

  // Fetch user balance when wallet connects
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (providerType === 'evm' && address) {
          const { evmGetBalance } = await import('../../utils/evmContractCall');
          const bal = await evmGetBalance(address);
          setUserBalance(bal);
          return;
        }
        // Existing SS58-first path for Substrate users
        if (ss58Address) {
          const bal = await getSubstrateQFBalance(ss58Address);
          if (bal > 0n) {
            setUserBalance(bal);
            return;
          }
        }
        if (address) {
          const bal = await getQFBalance(address);
          setUserBalance(bal);
          return;
        }
        setUserBalance(null);
      } catch {
        setUserBalance(null);
      }
    };
    fetchBalance();
  }, [ss58Address, address, providerType]);

  // Auto-advance onboarding flow
  useEffect(() => {
    if (txState === 'success' && onboardingStep === 'celebrate') {
      const timer = setTimeout(() => goToStep('avatar', 'forward'), 2500);
      return () => clearTimeout(timer);
    }
  }, [txState, onboardingStep]);

  // Reset onboarding step when registration starts or when name changes
  useEffect(() => {
    if (txState === 'idle') {
      setOnboardingStep('celebrate');
      setAvatarUrl('');
      setBioText('');
    }
  }, [txState]);

  // Reset onboarding state when selectedName changes
  useEffect(() => {
    setOnboardingStep('celebrate');
    setAvatarUrl('');
    setBioText('');
  }, [selectedName]);

  const priceDisplay = () => {
    if (!selectedName || regPrice === null) return regPriceLoading ? 'Loading price...' : '';
    const qf = formatQF(regPrice);
    if (duration.permanent) {
      return `${qf} QF — own forever`;
    }
    if (duration.years === 1) {
      return `Total: ${qf} QF`;
    }
    // For multi-year, estimate annual based on 1 year price
    const annualPrice = regPrice / BigInt(duration.years);
    return `${formatQF(annualPrice)} QF × ${duration.years} years = ${qf} QF`;
  };

  const handleRegister = async () => {
    if (!selectedName) return;
    if (!address) { 
      await connect(); 
      return; 
    }
    setTxState('pending');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
    try {
      const signerAddress = providerType === 'evm' ? address : (ss58Address || address);
      const { confirmation } = await registerName(selectedName, duration.years, duration.permanent, signerAddress);

      // === INSTANT SUCCESS (on broadcast) ===
      setTxState('confirming');
      hapticSuccess(); // chime plays during the animation
      
      const now = BigInt(Math.floor(Date.now() / 1000));
      const oneYearSecs = 365n * 24n * 60n * 60n;
      const newName = {
        name: selectedName,
        owner: address || '',
        expires: duration.permanent ? 0n : now + (BigInt(duration.years) * oneYearSecs),
        registeredAt: now,
        isPermanent: duration.permanent,
      };
      // Snapshot before optimistic add
      const previousNames = [...existingStoreNames];
      const isFirstName = existingStoreNames.length === 0;
      setOwnedNames([...existingStoreNames, newName]);
      showToast(`Welcome to QF Network, ${selectedName}.qf!`, 'success');

      // QDL: First name ceremony — auto-set as primary so the identity
      // is immediately live across navbar, profile, and reverse resolution.
      // Fires in background; must not block the onboarding flow.
      if (isFirstName && address) {
        const signerAddr = providerType === 'evm' ? address : (ss58Address || address);
        setPrimaryName(selectedName, address, signerAddr)
          .then(({ confirmation }) => {
            // Optimistically update wallet store so navbar reflects immediately
            useWalletStore.setState({ qnsName: selectedName, displayName: selectedName });

            confirmation.then((result) => {
              if (result.confirmed) {
                // Chain confirmed — refresh to lock in the canonical state
                refreshName().catch(() => {});
              } else if (result.error) {
                // Reverse record failed on-chain — clear optimistic state.
                // User can set primary manually from My Names.
                refreshName().catch(() => {});
              }
            });
          })
          .catch(() => {
            // setPrimaryName call itself failed (e.g. gas estimation, wallet rejection).
            // Don't block anything — user can set primary manually.
            refreshName().catch(() => {});
          });
      } else {
        // Not first name — just refresh to pick up existing primary
        refreshName().catch(() => {});
      }

      onRegisterSuccess(selectedName);

      // After 600ms, transition to full success
      setTimeout(() => {
        setTxState('success');
      }, 600);

      // === BACKGROUND CONFIRMATION ===
      confirmation.then((result) => {
        if (result.confirmed) {
          // All good — nothing to do, UI already shows success
          return;
        }
        if (result.error === 'not_confirmed') {
          // Ambiguous — show soft warning, don't rollback
          showToast('Registration submitted but not yet confirmed. Check My Names in a moment.', 'warning');
          return;
        }
        // Hard failure — rollback
        if (result.error && isRetryableError(result.error)) {
          // Retryable error - show amber warning instead of red error
          setTxState('idle');
          showToast(RETRY_MESSAGE_SHORT, 'warning');
        } else {
          setTxState('failed');
          setTxError({ type: 'generic', message: `Registration failed on-chain: ${result.error}. Your wallet was not charged.` });
        }
        // Remove the optimistic name
        setOwnedNames(previousNames);
        // Reset wallet display name if it was set optimistically
        refreshName().catch(() => {});
        hapticError();
      });
    } catch (err: any) {
      const errorMessage = err?.message || '';
      
      // Check if this is a retryable error
      if (isRetryableError(errorMessage)) {
        setTxState('idle');
        showToast(RETRY_MESSAGE_SHORT, 'warning');
        hapticError();
        return;
      }
      
      const errorMessageLower = errorMessage.toLowerCase();
      const isInsufficientBalance =
        errorMessageLower.includes('insufficient') ||
        errorMessageLower.includes('balance') ||
        errorMessageLower.includes('funds');

      if (isInsufficientBalance && regPrice) {
        setTxError({
          type: 'insufficient_balance',
          message: `Insufficient QF balance. You need ${formatQF(regPrice)} QF to register this name.`,
        });
      } else if (errorMessageLower.includes('checkmetadatahash') || errorMessageLower.includes('cannotlookup') || errorMessageLower.includes('metadata hash')) {
        setTxError({
          type: 'generic',
          message: 'Disable CheckMetadataHash for QF Network in Talisman: Settings → Networks & Tokens → QF Network → uncheck metadata hash. Then reconnect.',
        });
      } else if (errorMessageLower.includes('wallet not connected') || errorMessageLower.includes('reconnect')) {
        setTxError({ type: 'generic', message: 'Wallet not connected. Please disconnect and reconnect your wallet.' });
      } else if (errorMessageLower.includes('rejected by user') || errorMessageLower.includes('cancelled')) {
        setTxError({ type: 'generic', message: 'Transaction rejected' });
      } else if (errorMessageLower.includes('not included within')) {
        setTxError({ type: 'generic', message: 'Transaction sent but confirmation timed out. Check the explorer — it may have succeeded. Try refreshing the page.' });
      } else {
        setTxError({ type: 'generic', message: errorMessage });
      }
      setTxState('failed');
      hapticError();

      if (errorDismissTimerRef.current) {
        clearTimeout(errorDismissTimerRef.current);
      }
      errorDismissTimerRef.current = setTimeout(() => {
        setTxError(null);
      }, 8000);
    }
  };

  const handleRetry = () => {
    setTxState('idle');
    setTxError(null);
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
      errorDismissTimerRef.current = null;
    }
  };

  const handleShareOnX = () => {
    const text = `I'm ${selectedName}.qf on @theqfnetwork via @dotqfns`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://dotqf.xyz/name/${selectedName}`)}`;
    window.open(url, '_blank');
  };

  const StepBackArrow = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="absolute top-0 left-0 p-1 text-[#555] hover:text-white transition-colors cursor-pointer z-10"
      aria-label="Go back"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );

  return (
    <div className="mt-0 bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
      {/* Empty Wallet State */}
      {address && userBalance === 0n && (
        <div className="mb-4 p-3 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-lg text-[#F5A623] text-sm animate-fade-in">
          <p>You'll need QF tokens to register a name.</p>
        </div>
      )}

      {/* Error Toast */}
      {txError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D] text-white text-sm font-medium animate-fade-in">
          {txError.message}
        </div>
      )}

      {/* Idle State */}
      {txState === 'idle' && (
        <div className="transition-all duration-150 ease-in-out">
          <div className="text-center mb-6">
            <h2 className="font-clash font-medium text-[36px] text-white">
              {selectedName}<span className="text-[#00D179]">.qf</span>
            </h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D179" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-sm text-[#00D179] font-medium">Available</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 bg-[#0A0A0A] rounded-xl p-1 mb-6">
            {durations.map((d, i) => (
              <motion.button
                key={d.label}
                onClick={() => setSelectedDuration(i)}
                className={`py-2.5 font-medium rounded-lg transition-all duration-150 ease-in-out cursor-pointer whitespace-nowrap ${
                  selectedDuration === i
                    ? 'bg-[#00D179] text-black'
                    : 'text-[#8A8A8A] hover:text-white'
                } ${d.permanent ? 'text-[13px]' : 'text-sm'}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {d.permanent ? 'Forever' : d.label}
              </motion.button>
            ))}
          </div>

          {/* Profile Preview */}
          <div className="mb-6 rounded-2xl border border-white/[0.06] bg-black/40 p-5 overflow-hidden">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#555] mb-4">Preview</p>
            <div className="flex items-center gap-4">
              {/* Avatar placeholder - initials */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00D179] to-[#00A060] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {selectedName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-clash font-semibold text-white text-lg truncate">
                  {selectedName}<span className="text-[#00D179]">.qf</span>
                </p>
                <p className="text-sm text-[#555] truncate">Your identity on QF Network</p>
              </div>
            </div>
            {/* Mini feature pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {['Profile', 'Gifting', 'Messaging', 'Trading'].map((feature) => (
                <span key={feature} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] text-[#666] border border-white/[0.06]">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          <p className="text-center text-white font-satoshi font-medium mb-6">
            {priceDisplay()}
          </p>

          <motion.button
            onClick={handleRegister}
            disabled={address ? (regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance)) : false}
            className={`w-full py-3.5 font-bold rounded-xl transition-all duration-200 text-base cursor-pointer ${
              !address
                ? 'bg-[#00D179] hover:bg-[#00B868] text-black'
                : (regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance))
                  ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
                  : 'bg-[#00D179] hover:bg-[#00B868] text-black'
            }`}
            whileHover={address && (regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance)) ? {} : { scale: 1.02 }}
            whileTap={address && (regPriceLoading || regPrice === null || (userBalance !== null && regPrice > userBalance)) ? {} : { scale: 0.98 }}
          >
            {!address ? 'Connect Wallet' :
             regPriceLoading ? 'Loading price...' :
             regPrice === null ? 'Price unavailable' :
             (userBalance !== null && regPrice > userBalance) ? 'Not enough QF' :
             `Register ${selectedName}.qf`}
          </motion.button>

          <motion.button
            onClick={onBack}
            className="w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back to search
          </motion.button>
        </div>
      )}

      {/* Pending State */}
      {txState === 'pending' && (
        <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
          <div className="relative inline-block mb-5">
            <div className="w-12 h-12 border-[3px] border-[#1E1E1E] border-t-[#00D179] rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-[#00D179] rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-white font-satoshi font-medium mb-1">Registering on QF Network</p>
          <p className="text-[#555555] text-sm font-satoshi">Powered by sub-second blocks</p>
        </div>
      )}

      {/* Confirming State */}
      {txState === 'confirming' && (
        <div className="text-center py-8 animate-fade-in">
          <div className="relative inline-block mb-5">
            {/* Expanding pulse ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#00D179]/20 animate-ping" />
            </div>
            {/* Checkmark circle */}
            <motion.div
              className="relative w-12 h-12 bg-[#00D179] rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <motion.svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="3" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <motion.path d="M20 6L9 17l-5-5" />
              </motion.svg>
            </motion.div>
          </div>
          <p className="text-[#00D179] font-medium">Confirmed</p>
        </div>
      )}

      {/* Success State - Onboarding Flow */}
      {txState === 'success' && (
        <div className="text-center py-8 animate-fade-in">
          {onboardingStep === 'celebrate' && (
            <div className="text-center py-8 animate-fade-in">
              {/* Refined success — single checkmark with subtle ring pulse */}
              <div className="relative flex items-center justify-center mb-6">
                {/* Single expanding ring — fades out */}
                <motion.div
                  className="absolute w-[72px] h-[72px] rounded-full border-2 border-[#00D179]/30"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                />
                {/* Checkmark circle */}
                <motion.div
                  className="relative w-[72px] h-[72px] rounded-full bg-[#00D179] flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <motion.svg
                    width="36" height="36" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="3" strokeLinecap="round"
                  >
                    <motion.path
                      d="M20 6L9 17l-5-5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    />
                  </motion.svg>
                </motion.div>
              </div>
              <motion.p
                className="font-clash font-semibold text-2xl text-white mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                {selectedName}<span className="text-[#00D179]">.qf</span> is yours
              </motion.p>
              <motion.p
                className="text-[#555] text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                Let's make it yours in every way
              </motion.p>
              {regPrice && (
                <motion.p
                  className="text-sm text-[#E5484D]/80 mt-2 flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <Flame size={14} className="text-[#E5484D]" />
                  {formatQF(regPrice * 5n / 100n)} QF burned from circulation
                </motion.p>
              )}
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mt-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === 0 ? 'bg-[#00D179]' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
          )}

          {onboardingStep === 'avatar' && (
            <motion.div className="relative py-6" initial={{ opacity: 0, x: stepDirection === 'forward' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <StepBackArrow onClick={() => goToStep('celebrate', 'back')} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#00D179] mb-3">Step 1 of 3</p>
              <h3 className="font-clash font-semibold text-xl text-white mb-1">Add your avatar</h3>
              <p className="text-sm text-[#555] mb-5">Paste a URL to your profile image</p>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl px-4 py-3 text-base md:text-sm text-white outline-none focus:border-[#00D179]/50 transition-colors duration-200 placeholder:text-[#333]"
              />
              {/* Avatar preview */}
              {avatarUrl && (
                <div className="mt-4 flex justify-center">
                  <img src={avatarUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-[#00D179]/30"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button onClick={() => {
                  goToStep('bio', 'forward');
                }} className="flex-1 py-3 bg-[#00D179] hover:bg-[#00B868] text-black font-semibold rounded-xl transition-colors cursor-pointer">
                  {avatarUrl.trim() ? 'Continue' : 'Skip'}
                </button>
              </div>
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mt-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i <= 1 ? 'bg-[#00D179]' : 'bg-white/10'}`} />
                ))}
              </div>
            </motion.div>
          )}

          {onboardingStep === 'bio' && (
            <motion.div className="relative py-6" initial={{ opacity: 0, x: stepDirection === 'forward' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <StepBackArrow onClick={() => goToStep('avatar', 'back')} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#00D179] mb-3">Step 2 of 3</p>
              <h3 className="font-clash font-semibold text-xl text-white mb-1">Write your bio</h3>
              <p className="text-sm text-[#555] mb-5">Tell the network who you are</p>
              <div className="relative">
                <textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value.slice(0, 160))}
                  placeholder="Builder, explorer, degen..."
                  rows={3}
                  className="w-full bg-[#0A0A0A] border border-[#1E1E1E] rounded-xl px-4 py-3 text-base md:text-sm text-white outline-none focus:border-[#00D179]/50 transition-colors duration-200 placeholder:text-[#333] resize-none"
                />
                <span className="absolute bottom-3 right-3 text-[11px] text-[#333]">{bioText.length}/160</span>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={async () => {
                  await batchSaveRecords();
                  goToStep('share', 'forward');
                }}
                  disabled={savingRecords}
                  className="flex-1 py-3 bg-[#00D179] hover:bg-[#00B868] text-black font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                  {savingRecords ? 'Saving...' : (avatarUrl.trim() || bioText.trim()) ? 'Save & Continue' : 'Skip'}
                </button>
              </div>
              <div className="flex justify-center gap-2 mt-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i <= 2 ? 'bg-[#00D179]' : 'bg-white/10'}`} />
                ))}
              </div>
            </motion.div>
          )}

          {onboardingStep === 'share' && (
            <motion.div className="relative py-6" initial={{ opacity: 0, x: stepDirection === 'forward' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <StepBackArrow onClick={() => goToStep('bio', 'back')} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#00D179] mb-3">You're all set</p>
              
              {/* Completed profile preview */}
              <div className="rounded-2xl border border-white/[0.08] bg-black/60 p-5 mb-6">
                <div className="flex items-center gap-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00D179] to-[#00A060] flex items-center justify-center text-white font-bold text-lg">
                      {selectedName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-clash font-semibold text-white text-lg truncate">
                      {selectedName}<span className="text-[#00D179]">.qf</span>
                    </p>
                    {bioText && <p className="text-sm text-[#888] truncate">{bioText}</p>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={handleShareOnX}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white font-medium hover:bg-white/[0.08] transition-colors cursor-pointer">
                  <Twitter size={18} />
                  Share on X
                </button>
                <button onClick={() => navigate(`/name/${selectedName}`)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00D179] hover:bg-[#00B868] text-black font-semibold transition-colors cursor-pointer">
                  View your profile
                </button>
                <button onClick={onBack}
                  className="text-sm text-[#555] hover:text-white transition-colors cursor-pointer py-2">
                  Register another name
                </button>
              </div>
              
              {/* Progress dots - all filled */}
              <div className="flex justify-center gap-2 mt-6">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#00D179]" />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Failed State */}
      {txState === 'failed' && (
        <div className="text-center py-8 transition-all duration-150 ease-in-out animate-fade-in">
          <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          <p className="text-[#E5484D] font-medium mb-2">Transaction rejected</p>
          <motion.button
            onClick={handleRetry}
            className="mt-2 px-6 py-2.5 bg-[#E5484D] hover:bg-[#c93d41] text-white rounded-lg font-medium transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Retry
          </motion.button>
          <motion.button
            onClick={onBack}
            className="block w-full mt-3 py-2 text-sm text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back to search
          </motion.button>
        </div>
      )}
    </div>
  );
}
