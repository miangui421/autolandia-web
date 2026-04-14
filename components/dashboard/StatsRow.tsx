import { formatGs } from '@/lib/calculator';

interface StatsRowProps {
  totalBoletos: number;
  totalGastado: number;
  totalCompras: number;
}

export function StatsRow({ totalBoletos, totalGastado, totalCompras }: StatsRowProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#d4af37]/10 via-[#0a0a0f] to-[#d4af37]/5 border border-[#d4af37]/20 p-6">
      {/* Gold glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle,rgba(212,175,55,0.15),transparent_70%)] pointer-events-none" />

      <div className="grid grid-cols-3 gap-4 relative">
        {/* Boletos */}
        <div className="text-center">
          <div className="text-3xl font-extrabold text-[#d4af37]">{totalBoletos}</div>
          <div className="text-[11px] text-white/40 mt-1">Boletos</div>
          <div className="text-[10px] text-white/20">en juego</div>
        </div>

        {/* Divider */}
        <div className="text-center border-x border-white/5 px-2">
          <div className="text-lg font-extrabold text-white">{formatGs(totalGastado)}</div>
          <div className="text-[11px] text-white/40 mt-1">Invertido</div>
          <div className="text-[10px] text-white/20">total</div>
        </div>

        {/* Compras */}
        <div className="text-center">
          <div className="text-3xl font-extrabold text-[#d4af37]">{totalCompras}</div>
          <div className="text-[11px] text-white/40 mt-1">Compras</div>
          <div className="text-[10px] text-white/20">realizadas</div>
        </div>
      </div>
    </div>
  );
}
