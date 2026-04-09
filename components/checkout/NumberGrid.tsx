'use client';
import type { RaffleNumber } from '@/types';

interface NumberGridProps {
  numbers: RaffleNumber[];
  selected: number[];
  onToggle: (n: number) => void;
  maxSelect: number;
}

export function NumberGrid({ numbers, selected, onToggle, maxSelect }: NumberGridProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {numbers.map((r) => {
        const isSelected = selected.includes(r.numero);
        const isTaken = !r.disponible;
        const canSelect = !isTaken && (isSelected || selected.length < maxSelect);

        return (
          <button
            key={r.numero}
            disabled={isTaken || (!isSelected && selected.length >= maxSelect)}
            onClick={() => canSelect && onToggle(r.numero)}
            className={`aspect-square flex items-center justify-center rounded-lg text-xs transition-all ${
              isSelected
                ? 'bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] font-bold border'
                : isTaken
                  ? 'bg-red-500/5 border-red-500/15 text-white/15 line-through cursor-not-allowed border'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-[#d4af37]/40 hover:text-white cursor-pointer border'
            }`}
          >
            {String(r.numero).padStart(5, '0')}
          </button>
        );
      })}
    </div>
  );
}
