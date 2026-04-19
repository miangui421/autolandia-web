'use client';
import { useEffect, useRef, useState } from 'react';

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

interface Wave {
  id: number;
  pieces: ConfettiPiece[];
}

const COLORS = ['#d4af37', '#f5d76e', '#ffffff', '#ffd700'];
const WAVE_INTERVAL_MS = 2200;
const PIECES_PER_WAVE = 35;
const PIECE_MIN_MS = 2500;
const PIECE_MAX_MS = 4500;

/**
 * Confetti en loop continuo mientras active=true. Cada "wave" spawna
 * PIECES_PER_WAVE particulas con duraciones random y se autolimpia
 * cuando todas terminaron, para no acumular DOM infinito.
 */
export function Confetti({ active }: { active: boolean }) {
  const [waves, setWaves] = useState<Wave[]>([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setWaves([]);
      return;
    }

    function spawnWave() {
      const id = nextIdRef.current++;
      const pieces: ConfettiPiece[] = Array.from({ length: PIECES_PER_WAVE }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 400,
        duration: PIECE_MIN_MS + Math.random() * (PIECE_MAX_MS - PIECE_MIN_MS),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
      }));
      setWaves((prev) => [...prev, { id, pieces }]);

      // Limpiar esta wave tras su tiempo maximo para evitar DOM creciendo indefinido
      setTimeout(() => {
        setWaves((prev) => prev.filter((w) => w.id !== id));
      }, PIECE_MAX_MS + 500);
    }

    spawnWave();
    const interval = setInterval(spawnWave, WAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  if (waves.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {waves.map((w) =>
        w.pieces.map((p) => (
          <div
            key={`${w.id}-${p.id}`}
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
        )),
      )}
    </div>
  );
}
