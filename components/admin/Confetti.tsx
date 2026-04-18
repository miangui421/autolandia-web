'use client';
import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

const COLORS = ['#d4af37', '#f5d76e', '#ffffff', '#ffd700'];

export function Confetti({ active, duration = 3000 }: { active: boolean; duration?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    // 50 piezas con valores random (client-side, no hidration issue)
    const arr: ConfettiPiece[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 500,
      duration: 2500 + Math.random() * 1500,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
    }));
    setPieces(arr);
    const t = setTimeout(() => setPieces([]), duration);
    return () => clearTimeout(t);
  }, [active, duration]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size * 0.4}px`,
            background: p.color,
            borderRadius: '2px',
            animation: `confetti-piece ${p.duration}ms linear ${p.delay}ms forwards`,
            transformOrigin: 'center',
          }}
        />
      ))}
    </div>
  );
}
