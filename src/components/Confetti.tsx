import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  velocity: { x: number; y: number };
  rotationSpeed: number;
}

export default function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) return;

    const colors = ['#00D179', '#E5484D', '#F5A623', '#8A8A8A', '#FFFFFF'];
    const newPieces: ConfettiPiece[] = [];
    
    for (let i = 0; i < 50; i++) {
      newPieces.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: -5 - Math.random() * 10
        },
        rotationSpeed: (Math.random() - 0.5) * 20
      });
    }
    
    setPieces(newPieces);

    const timer = setTimeout(() => {
      setPieces([]);
    }, 3000);

    return () => clearTimeout(timer);
  }, [active]);

  if (!active || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute w-2 h-2"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            backgroundColor: piece.color,
            animation: 'confetti-fall 3s ease-out forwards',
            '--velocity-x': `${piece.velocity.x}px`,
            '--velocity-y': `${piece.velocity.y}px`,
            '--rotation-speed': `${piece.rotationSpeed}deg`
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
