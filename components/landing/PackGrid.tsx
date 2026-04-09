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
      {PACKS_NORMALES.map((pack) => (
        <button
          key={pack.cantidad}
          onClick={() => handleSelect(pack)}
          className={`relative bg-white/[0.03] border rounded-2xl p-5 text-center transition-all hover:border-[#d4af37]/40 hover:bg-[#d4af37]/5 hover:-translate-y-0.5 ${
            pack.popular ? 'border-[#d4af37]/50 bg-[#d4af37]/[0.08]' : 'border-white/[0.08]'
          }`}
        >
          {pack.popular && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black text-[9px] font-bold px-2.5 py-0.5 rounded-full tracking-wider">
              POPULAR
            </span>
          )}
          <div className="text-3xl font-extrabold text-[#d4af37]">{pack.cantidad}</div>
          <div className="text-[11px] text-white/40 uppercase mt-1">
            boleto{pack.cantidad > 1 ? 's' : ''}
          </div>
          <div className="text-base font-bold mt-3">{formatGs(pack.precio)}</div>
          {pack.descuento && (
            <div className="text-[11px] text-green-400 font-semibold mt-1">{pack.descuento}</div>
          )}
        </button>
      ))}
    </div>
  );
}
