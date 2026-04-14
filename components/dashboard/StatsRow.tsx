import { formatGs } from '@/lib/calculator';

interface StatsRowProps {
  totalBoletos: number;
  totalGastado: number;
  totalCompras: number;
}

export function StatsRow({ totalBoletos, totalGastado, totalCompras }: StatsRowProps) {
  const stats = [
    { label: 'Boletos', value: String(totalBoletos), icon: '🎟️' },
    { label: 'Invertido', value: formatGs(totalGastado), icon: '💰' },
    { label: 'Compras', value: String(totalCompras), icon: '🛒' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card p-4 text-center">
          <div className="text-xl mb-1">{stat.icon}</div>
          <div className="text-lg font-extrabold text-[#d4af37]">{stat.value}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
