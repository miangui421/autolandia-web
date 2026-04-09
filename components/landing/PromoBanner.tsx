import { PROMO_3X1_END } from '@/lib/constants';

export function PromoBanner() {
  const now = new Date();
  if (now > PROMO_3X1_END) return null;

  return (
    <div className="max-w-[600px] mx-auto mb-8 px-4">
      <div className="bg-gradient-to-r from-[#d4af37]/15 to-[#d4af37]/5 border border-[#d4af37]/30 rounded-2xl p-5 flex items-center gap-4">
        <div className="bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-extrabold text-2xl px-4 py-2.5 rounded-xl shrink-0">
          3x1
        </div>
        <div>
          <h3 className="font-bold">Compras 1, llevas 3 numeros</h3>
          <p className="text-sm text-white/50 mt-1">Promo por unica vez por usuario</p>
        </div>
      </div>
    </div>
  );
}
