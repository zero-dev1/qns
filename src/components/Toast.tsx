import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  const effectiveDuration = type === 'warning' ? 5000 : duration;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow exit animation to complete
    }, effectiveDuration);

    return () => clearTimeout(timer);
  }, [effectiveDuration, onClose]);

  const icons = {
    success: <Check size={20} />,
    error: <X size={20} />,
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  };

  const colors = {
    success: 'bg-[#00D179] text-black',
    error: 'bg-[#E5484D] text-white',
    warning: 'bg-[#F5A623] text-black'
  };

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${colors[type]}`}
      >
        {icons[type]}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
}
