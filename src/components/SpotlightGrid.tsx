// src/components/SpotlightGrid.tsx
import { useRef, useEffect, useCallback, type ReactNode } from 'react';

interface SpotlightGridProps {
  children: ReactNode;
  className?: string;
}

export default function SpotlightGrid({ children, className = '' }: SpotlightGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCards = useCallback((x: number, y: number) => {
    if (!containerRef.current) return;
    const cards = Array.from(containerRef.current.children) as HTMLElement[];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${x - rect.left}px`);
      card.style.setProperty('--mouse-y', `${y - rect.top}px`);
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => updateCards(e.clientX, e.clientY),
    [updateCards]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateCards(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [updateCards]
  );

  // On touch start, also trigger so there's an instant response
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateCards(e.touches[0].clientX, e.touches[0].clientY);
        // Find spotlight-card descendants and activate glow
        const cards = Array.from(
          containerRef.current?.querySelectorAll('.spotlight-card') || []
        ) as HTMLElement[];
        cards.forEach((card) => card.classList.add('spotlight-touch-active'));
      }
    },
    [updateCards]
  );

  const handleTouchEnd = useCallback(() => {
    const cards = Array.from(
      containerRef.current?.querySelectorAll('.spotlight-card') || []
    ) as HTMLElement[];
    setTimeout(() => {
      cards.forEach((card) => card.classList.remove('spotlight-touch-active'));
    }, 300);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className={`group ${className}`}>
      {children}
    </div>
  );
}
