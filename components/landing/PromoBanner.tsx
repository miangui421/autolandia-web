'use client';
import { useRouter } from 'next/navigation';
import { PROMO_3X1_END, PACKS_3X1 } from '@/lib/constants';

export function PromoBanner() {
  const router = useRouter();
  const now = new Date();
  if (now > PROMO_3X1_END) return null;

  const daysLeft = Math.ceil((PROMO_3X1_END.getTime() - now.getTime()) / 86400000);

  return (
    <div className="max-w-[600px] mx-auto mb-8 px-4 animate-slide-up">
      <button
        onClick={() => router.push(`/checkout?qty=${PACKS_3X1[0].cantidad}&price=${PACKS_3X1[0].precio}&promo=3x1`)}
        className="w-full relative overflow-hidden bg-gradient-to-r from-[#d4af37]/15 via-[#d4af37]/10 to-[#d4af37]/15 border border-[#d4af37]/40 rounded-2xl p-5 flex items-center justify-center gap-4 transition-all hover:border-[#d4af37]/60 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] group"
      >
        {/* Animated shimmer */}
        <div className="absolute inset-0 animate-shimmer pointer-events-none" />

        <div className="bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-extrabold text-2xl px-4 py-3 rounded-xl shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform">
          3x1
        </div>
        <div className="relative text-center sm:text-left">
          <h3 className="font-bold text-white">Compras 1, llevas 3 numeros</h3>
          <p className="text-sm text-white/50 mt-0.5">Promo por unica vez por usuario</p>
          <span className="inline-block mt-2 text-[11px] text-[#d4af37] font-semibold bg-[#d4af37]/10 px-2.5 py-0.5 rounded-full">
            {daysLeft <= 3 ? `Ultimos ${daysLeft} dias!` : `Quedan ${daysLeft} dias`}
          </span>
        </div>
      </button>
    </div>
  );
}
