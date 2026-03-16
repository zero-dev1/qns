import { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { hapticTap } from '../utils/haptics';

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const copy = async (text: string, showToastMessage = true) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      hapticTap();
      
      if (showToastMessage) {
        showToast('Copied!', 'success');
      }
      
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      if (showToastMessage) {
        showToast('Failed to copy', 'error');
      }
      return false;
    }
  };

  return { copy, copied };
}
