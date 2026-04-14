'use client';
import { useRouter } from 'next/navigation';
import { PACKS_NORMALES } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';

export function PackGrid() {
  const router = useRouter();

  function handleSelect(pack: (typeof PACKS_NORMALES)[0]) {
    router.push(`/checkout?qty=${pack.cantidad}&price=${pack.precio}`);
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-[600px] mx-auto">
      {PACKS_NORMALES.map((pack, i) => (
        <button
          key={pack.cantidad}
          onClick={() => handleSelect(pack)}
          className={`group relative rounded-2xl p-5 text-center transition-all duration-300 hover:-translate-y-1 animate-slide-up ${
            pack.popular
              ? 'bg-gradient-to-b from-[#d4af37]/15 to-[#d4af37]/5 border-[#d4af37]/50 border shadow-[0_0_30px_rgba(212,175,55,0.15)]'
              : 'glass-card hover:border-[#d4af37]/30 hover:shadow-[0_0_20px_rgba(212,175,55,0.08)]'
          }`}
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          {/* Shine effect on hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

          {pack.popular && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black text-[9px] font-bold px-3 py-0.5 rounded-full tracking-wider shadow-[0_0_12px_rgba(212,175,55,0.4)] animate-pulse-gold">
              POPULAR
            </span>
          )}
          <div className="text-3xl font-extrabold text-[#d4af37] group-hover:scale-110 transition-transform">{pack.cantidad}</div>
          <div className="text-[11px] text-white/40 uppercase mt-1">
            boleto{pack.cantidad > 1 ? 's' : ''}
          </div>
          <div className="text-base font-bold mt-3">{formatGs(pack.precio)}</div>
          {pack.descuento && (
            <div className="text-[11px] text-green-400 font-semibold mt-1">{pack.descuento}</div>
          )}
          <div className="text-[10px] text-white/20 mt-1">{formatGs(pack.precioPorBoleto)}/boleto</div>
        </button>
      ))}
    </div>
  );
}
