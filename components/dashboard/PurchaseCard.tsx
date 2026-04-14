'use client';
import { useState } from 'react';
import { formatGs } from '@/lib/calculator';
import type { UserPurchase } from '@/app/actions/user-data';

export function PurchaseCard({ purchase }: { purchase: UserPurchase }) {
  const [expanded, setExpanded] = useState(false);
  const fecha = new Date(purchase.fecha).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const numeros = Array.isArray(purchase.numeros_asignados) ? purchase.numeros_asignados : [];

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full text-left rounded-2xl p-4 transition-all duration-200 border ${
        expanded
          ? 'bg-[#d4af37]/5 border-[#d4af37]/25 shadow-[0_0_20px_rgba(212,175,55,0.08)]'
          : 'glass-card hover:border-white/15'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] font-bold">{purchase.ticket_id}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20 font-semibold">
              Confirmada
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-white/30">{fecha}</span>
            <span className="text-xs text-white/30">·</span>
            <span className="text-xs text-white/40">{purchase.cantidad} boleto{purchase.cantidad > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold">{formatGs(purchase.monto)}</div>
          <div className="text-white/20 text-[10px] mt-1">{expanded ? 'Ocultar ▲' : 'Ver numeros ▼'}</div>
        </div>
      </div>

      {/* Preview: show first 5 numbers inline when collapsed */}
      {!expanded && numeros.length > 0 && (
        <div className="flex items-center gap-1 mt-3 overflow-hidden">
          {numeros.slice(0, 5).map((n: number) => (
            <span key={n} className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded font-mono">
              {String(n).padStart(5, '0')}
            </span>
          ))}
          {numeros.length > 5 && (
            <span className="text-[10px] text-white/20">+{numeros.length - 5} mas</span>
          )}
        </div>
      )}

      {/* Expanded: all numbers */}
      {expanded && numeros.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2.5">
            Numeros asignados ({numeros.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {numeros.map((n: number) => (
              <span
                key={n}
                className="bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] px-2.5 py-1 rounded-lg text-xs font-bold font-mono"
              >
                {String(n).padStart(5, '0')}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
