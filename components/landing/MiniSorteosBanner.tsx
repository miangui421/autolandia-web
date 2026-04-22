'use client';
import {
  MINI_SORTEO_DATE,
  MINI_SORTEO_PREMIO,
  MINI_SORTEO_CANTIDAD,
  MINI_SORTEO_MIN_BOLETOS,
} from '@/lib/constants';
import { formatGs } from '@/lib/calculator';

export function MiniSorteosBanner() {
  const now = new Date();
  if (now > MINI_SORTEO_DATE) return null;

  const fechaFmt = MINI_SORTEO_DATE.toLocaleDateString('es-PY', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Asuncion',
  });

  return (
    <div className="max-w-[600px] mx-auto mb-6 px-4 animate-slide-up">
      <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/15 via-[#d4af37]/10 to-[#d4af37]/15 p-5">
        <div className="absolute inset-0 animate-shimmer pointer-events-none" />
        <div className="relative text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#d4af37]">
            Bonus del mes
          </p>
          <p className="text-base sm:text-lg font-bold mt-2 leading-snug">
            🎟️ Comprando <span className="text-[#d4af37]">{MINI_SORTEO_MIN_BOLETOS} o más boletos</span>
          </p>
          <p className="text-sm sm:text-base text-white/80 mt-1 leading-snug">
            participás por <b className="text-[#d4af37]">{MINI_SORTEO_CANTIDAD} mini sorteos</b> de <b className="text-[#d4af37]">{formatGs(MINI_SORTEO_PREMIO)}</b>
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#d4af37]">
              📅 {fechaFmt}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
