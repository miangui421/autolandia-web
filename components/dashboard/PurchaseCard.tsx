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

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full glass-card p-4 text-left transition-all hover:border-[#d4af37]/20"
    >
      {/* Header - always visible */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[#d4af37] font-bold text-sm">{purchase.ticket_id}</span>
          <span className="text-white/30 text-xs ml-2">{fecha}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatGs(purchase.monto)}</span>
          <span className="text-white/30 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-white/40">{purchase.cantidad} boleto{purchase.cantidad > 1 ? 's' : ''}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
          Confirmada
        </span>
      </div>

      {/* Expanded content */}
      {expanded && purchase.numeros_asignados && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Numeros asignados</p>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(purchase.numeros_asignados) ? purchase.numeros_asignados : []).map((n: number) => (
              <span
                key={n}
                className="bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] px-2 py-1 rounded-lg text-xs font-bold"
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
