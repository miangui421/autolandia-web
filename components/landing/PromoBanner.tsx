'use client';
import Link from 'next/link';
import { PROMO_3X1_END } from '@/lib/constants';

export function PromoBanner() {
  const now = new Date();
  if (now > PROMO_3X1_END) return null;

  const daysLeft = Math.ceil((PROMO_3X1_END.getTime() - now.getTime()) / 86400000);
  const urgencyText =
    daysLeft <= 1 ? 'Ultimas horas!' : daysLeft <= 3 ? `Solo ${daysLeft} dias` : `Quedan ${daysLeft} dias`;

  return (
    <div className="max-w-[600px] mx-auto mb-8 px-4 animate-slide-up">
      <Link
        href="/promo-3x1"
        className="block relative overflow-hidden bg-gradient-to-r from-[#d4af37]/15 via-[#d4af37]/10 to-[#d4af37]/15 border border-[#d4af37]/40 rounded-2xl p-5 transition-all hover:border-[#d4af37]/70 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] group"
      >
        <div className="absolute inset-0 animate-shimmer pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-extrabold text-2xl px-4 py-3 rounded-xl shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform">
            3x1
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-[15px] leading-tight">
              Triplica tus boletos para el sorteo
            </h3>
            <p className="text-[13px] text-white/60 mt-1 leading-snug">
              Mismo precio, el triple de boletos
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-[#d4af37] font-bold bg-[#d4af37]/10 px-2 py-0.5 rounded-full border border-[#d4af37]/30">
                Exclusivo · 1 vez por persona
              </span>
              <span className="text-[10px] uppercase tracking-wider text-red-300 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                {urgencyText}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-[#d4af37] font-bold text-sm group-hover:translate-x-1 transition-transform">
            <span className="hidden sm:inline">Activar</span>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
