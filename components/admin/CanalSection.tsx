'use client';
import { useEffect, useState } from 'react';
import { getAdminStats, type PorCanal } from '@/app/actions/admin-stats';
import { formatGs } from '@/lib/calculator';

type Range = 7 | 30 | 0;

const CANAL_LABELS: Record<string, string> = {
  web: 'Web',
  bot: 'Bot (WhatsApp)',
  sin_canal: 'Histórico (s/canal)',
};

function canalLabel(key: string): string {
  return CANAL_LABELS[key] ?? key;
}

export function CanalSection() {
  const [porCanal, setPorCanal] = useState<PorCanal | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminStats(range)
      .then((s) => {
        if (!cancelled) setPorCanal(s.por_canal);
      })
      .catch((e) => console.error('canal stats error:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const rows = porCanal
    ? Object.entries(porCanal)
        .map(([canal, v]) => ({ canal, ventas: v.ventas, totalGs: v.total_gs }))
        .sort((a, b) => b.totalGs - a.totalGs)
    : [];

  const totalVentas = rows.reduce((acc, r) => acc + r.ventas, 0);
  const totalGs = rows.reduce((acc, r) => acc + r.totalGs, 0);

  return (
    <section>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Ventas por canal</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Web vs Bot (WhatsApp). Último {range === 0 ? 'histórico' : `${range} días`}.
          </p>
        </div>
        <div className="shrink-0 flex gap-1.5">
          {([7, 30, 0] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                range === r
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {r === 0 ? 'Todo' : `${r}d`}
            </button>
          ))}
        </div>
      </header>
      <div className="glass-card p-4">
        {loading && !porCanal ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-white/50">No hay ventas en el rango seleccionado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-white/50">
              <tr>
                <th className="text-left py-2">Canal</th>
                <th className="text-right py-2">Ventas</th>
                <th className="text-right py-2">Total Gs</th>
                <th className="text-right py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = totalGs > 0 ? (r.totalGs / totalGs) * 100 : 0;
                return (
                  <tr key={r.canal} className="border-t border-white/5">
                    <td className="py-2 font-semibold">{canalLabel(r.canal)}</td>
                    <td className="text-right py-2">{r.ventas}</td>
                    <td className="text-right py-2">{formatGs(r.totalGs)}</td>
                    <td className="text-right py-2 text-white/60">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/20 font-bold">
                <td className="py-2">Total</td>
                <td className="text-right py-2">{totalVentas}</td>
                <td className="text-right py-2">{formatGs(totalGs)}</td>
                <td className="text-right py-2">100%</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
