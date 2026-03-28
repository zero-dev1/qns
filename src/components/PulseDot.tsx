// src/components/PulseDot.tsx
interface PulseDotProps {
  color?: string; // Tailwind bg class, e.g. 'bg-amber-400'
}

export default function PulseDot({ color = 'bg-[#00D179]' }: PulseDotProps) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-40 animate-ping`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}
