import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { hapticTap } from '../../utils/haptics';

export default function BurnMechanic() {
  const { copy } = useCopy();
  const [burnAddressCopied, setBurnAddressCopied] = useState(false);
  const burnAddress = '0x000000000000000000000000000000000000dEaD';

  const handleCopyBurnAddress = () => {
    copy(burnAddress, false); // Don't show toast for this since we have visual feedback
    hapticTap();
    setBurnAddressCopied(true);
    setTimeout(() => setBurnAddressCopied(false), 2000);
  };

  return (
    <motion.div
      className="mt-12 max-w-[520px] mx-auto"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-[12px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#E5484D]/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M8 11h8"/>
              <path d="M8 15h6"/>
            </svg>
          </div>
          <h3 className="font-clash text-lg font-semibold text-white">Deflationary by Design</h3>
        </div>
        
        <p className="text-[#8A8A8A] text-sm mb-4 leading-relaxed">
          Every <span className="text-[#00D179]">.qf</span> registration burns <span className="text-[#E5484D] font-medium">5%</span> of the fee permanently. 
          Reducing QF supply with every name claimed.
        </p>
        
        <div className="bg-[#0A0A0A] rounded-xl p-3 border border-[#1E1E1A]">
          <p className="text-[#555555] text-xs mb-1 text-center">Burn Address</p>
          <motion.button
            onClick={handleCopyBurnAddress}
            className="flex items-center justify-center gap-2 group transition-all duration-200 hover:bg-[#1a1a1a] rounded-lg p-1 -m-1 w-full"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <code className="text-[#00D179] font-mono text-sm text-center">
              0x0000...dEaD
            </code>
            {burnAddressCopied ? (
              <Check size={14} className="text-[#00D179] flex-shrink-0" />
            ) : (
              <Copy size={14} className="text-[#8A8A8A] group-hover:text-[#00D179] flex-shrink-0 transition-colors" />
            )}
          </motion.button>
          {burnAddressCopied && (
            <p className="text-[#00D179] text-xs mt-1 animate-fade-in text-center">Copied!</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
