'use client';
import { useEffect, useState } from 'react';
import { getAdminStats, type AdminStats } from '@/app/actions/admin-stats';
import { VentasChart } from './VentasChart';
import { formatGs } from '@/lib/calculator';

type Range = 7 | 30 | 0;
type Metric = 'monto' | 'boletos' | 'ventas_count';

export function DashboardStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>(30);
  const [metric, setMetric] = useState<Metric>('monto');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminStats(range)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e) => console.error('stats error:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }
  if (!stats) return null;

  const progress = stats.boletos_totales > 0 ? (stats.boletos_vendidos / stats.boletos_totales) * 100 : 0;
  const ultimaFecha = stats.ultima_venta_fecha
    ? new Date(stats.ultima_venta_fecha).toLocaleString('es-PY', {
        timeZone: 'America/Asuncion',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Recaudado" value={formatGs(stats.total_recaudado)} highlight />
        <StatCard label="Compras" value={stats.total_ventas.toLocaleString('es-PY')} />
        <StatCard
          label="Boletos vendidos"
          value={`${stats.boletos_vendidos.toLocaleString('es-PY')} / ${stats.boletos_totales.toLocaleString('es-PY')}`}
        />
        <StatCard label="Ultima venta" value={ultimaFecha} small />
      </div>

      {/* Progress bar boletos */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold">Progreso del sorteo BMW</h3>
          <span className="text-sm font-bold text-[#d4af37]">{progress.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d4af37] to-[#f5d76e] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-white/40 mt-2">
          Faltan {(stats.boletos_totales - stats.boletos_vendidos).toLocaleString('es-PY')} boletos
        </p>
      </div>

      {/* Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold">Grafico diario</h3>
          <div className="flex gap-1">
            <MetricBtn active={metric === 'monto'} onClick={() => setMetric('monto')}>Gs</MetricBtn>
            <MetricBtn active={metric === 'boletos'} onClick={() => setMetric('boletos')}>Boletos</MetricBtn>
            <MetricBtn active={metric === 'ventas_count'} onClick={() => setMetric('ventas_count')}>Compras</MetricBtn>
          </div>
          <div className="flex gap-1">
            <RangeBtn active={range === 7} onClick={() => setRange(7)}>7d</RangeBtn>
            <RangeBtn active={range === 30} onClick={() => setRange(30)}>30d</RangeBtn>
            <RangeBtn active={range === 0} onClick={() => setRange(0)}>Todo</RangeBtn>
          </div>
        </div>
        <VentasChart data={stats.daily_sales} metric={metric} />
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight
          ? 'bg-gradient-to-br from-[#d4af37]/15 to-[#d4af37]/5 border-[#d4af37]/30'
          : 'glass-card'
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{label}</p>
      <p className={`mt-1 font-extrabold ${highlight ? 'text-[#d4af37]' : ''} ${small ? 'text-sm' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  );
}

function RangeBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
        active ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40' : 'bg-white/5 text-white/50 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function MetricBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
        active ? 'bg-white/10 text-white border border-white/20' : 'bg-white/5 text-white/40 border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
