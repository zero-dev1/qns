// src/components/SpotlightCard.tsx
import type { ReactNode, CSSProperties } from 'react';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string; // e.g. '#00D179', 'rgba(139,92,246,0.5)'
}

export default function SpotlightCard({ children, className = '', glowColor }: SpotlightCardProps) {
  const style = glowColor ? { '--glow-color': glowColor } as CSSProperties : undefined;

  return (
    <div
      className={`
        spotlight-card relative rounded-2xl p-px overflow-hidden
        before:absolute before:w-80 before:h-80 before:-left-40 before:-top-40
        before:bg-white/15 before:rounded-full before:opacity-0
        before:pointer-events-none before:transition-opacity before:duration-500
        before:translate-x-[var(--mouse-x)] before:translate-y-[var(--mouse-y)]
        before:group-hover:opacity-100 before:z-10 before:blur-[100px]
        after:absolute after:w-96 after:h-96 after:-left-48 after:-top-48
        after:rounded-full after:opacity-0
        after:pointer-events-none after:transition-opacity after:duration-500
        after:translate-x-[var(--mouse-x)] after:translate-y-[var(--mouse-y)]
        after:hover:opacity-20 after:z-30 after:blur-[100px]
        bg-white/[0.05]
        ${className}
      `}
      style={style}
    >
      <div className="relative h-full bg-[#0A0A0A] rounded-[inherit] z-20 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
