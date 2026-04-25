'use client';
import { useEffect, useState } from 'react';
import { getAttributionStats, type AttributionRow } from '@/app/actions/attribution-stats';
import { formatGs } from '@/lib/calculator';

type Range = 7 | 30 | 0;

const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  whatsapp: 'WhatsApp',
  direct: 'Directo',
  influencer: 'Influencer',
  email: 'Email',
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s;
}

export function AttributionSection() {
  const [rows, setRows] = useState<AttributionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAttributionStats(range)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => console.error('attribution stats error:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Ventas por medio (atribución)</h2>
          <p className="text-xs text-white/40 mt-0.5">
            First-touch UTMs. Convención en <code className="text-white/60">docs/utm-conventions.md</code>.
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
      <div className="glass-card p-4 overflow-x-auto">
        {loading && !rows ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-white/50">No hay ventas en el rango seleccionado.</p>
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-xs text-white/50">
              <tr>
                <th className="text-left py-2">Source</th>
                <th className="text-left py-2">Campaña</th>
                <th className="text-right py-2">Ventas</th>
                <th className="text-right py-2">Total Gs</th>
                <th className="text-right py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.source}-${r.campaign}-${idx}`} className="border-t border-white/5">
                  <td className="py-2 font-semibold">{sourceLabel(r.source)}</td>
                  <td className="py-2 text-white/70">{r.campaign}</td>
                  <td className="text-right py-2">{r.ventas_count}</td>
                  <td className="text-right py-2">{formatGs(r.total_gs)}</td>
                  <td className="text-right py-2 text-white/60">{r.pct_total.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
