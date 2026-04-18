'use client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { DailySale } from '@/app/actions/admin-stats';

interface Props {
  data: DailySale[];
  metric: 'monto' | 'boletos' | 'ventas_count';
}

const LABELS = {
  monto: 'Gs recaudados',
  boletos: 'Boletos',
  ventas_count: 'Compras',
};

function formatDateShort(dateStr: string): string {
  // YYYY-MM-DD → DD/MM
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function VentasChart({ data, metric }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-white/30 text-sm">Sin datos en este rango</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatCompact}
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: 11 }}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: '#0f0f15',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '12px',
              fontSize: 12,
            }}
            labelStyle={{ color: '#d4af37', fontWeight: 700 }}
            formatter={(v) => {
              const n = Number(v);
              return [metric === 'monto' ? `${n.toLocaleString('es-PY')} Gs` : n, LABELS[metric]];
            }}
            labelFormatter={(label) => formatDateShort(String(label))}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#d4af37"
            strokeWidth={2}
            dot={{ r: 3, fill: '#d4af37' }}
            activeDot={{ r: 5, fill: '#f5d76e' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
