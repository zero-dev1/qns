import { useState, useEffect } from 'react';

interface AvatarProps {
  url?: string;
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ url, name, size = 40, className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const textSize = size >= 56 ? 'text-lg' : size >= 32 ? 'text-sm' : 'text-xs';

  useEffect(() => {
    setImageError(false);
  }, [url]);

  if (url && !imageError) {
    return (
      <img
        src={url}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#00D179] to-[#00A060] font-bold text-white ${textSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
