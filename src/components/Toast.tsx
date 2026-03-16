import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow exit animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <Check size={20} />,
    error: <X size={20} />
  };

  const colors = {
    success: 'bg-[#00D179] text-black',
    error: 'bg-[#E5484D] text-white'
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
