'use client';
import { useState, useCallback } from 'react';
import { lookupNumbers } from '@/app/actions/lookup-numbers';
import { reserveNumbers, releaseNumbers } from '@/app/actions/reserve-numbers';
import { NumberGrid } from './NumberGrid';
import { Button } from '@/components/ui/Button';
import { generateEventId } from '@/lib/meta-event-id';
import { trackInitiateCheckout } from '@/lib/pixel';
import type { RaffleNumber } from '@/types';

interface StepNumbersProps {
  qty: number;
  price: number;
  onComplete: (selectedNumbers: number[], mode: 'manual' | 'random') => void;
}

export function StepNumbers({ qty, price, onComplete }: StepNumbersProps) {
  const [mode, setMode] = useState<'manual' | 'random'>('random');
  const [search, setSearch] = useState('');
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    const num = parseInt(search);
    if (!num || num < 1) return;
    setLoading(true);
    try {
      const result = await lookupNumbers(num, 20);
      setNumbers(result);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [search]);

  const handleToggle = useCallback(
    async (n: number) => {
      if (selected.includes(n)) {
        setSelected((prev) => prev.filter((x) => x !== n));
        await releaseNumbers([n]).catch(() => {});
      } else if (selected.length < qty) {
        setSelected((prev) => [...prev, n]);
        await reserveNumbers([n]).catch(() => {});
      }
    },
    [selected, qty],
  );

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <h3 className="font-bold mb-4">Como queres elegir tus numeros?</h3>

      <div className="flex gap-2 mb-5">
        {(['random', 'manual'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all border ${
              mode === m
                ? 'border-[#d4af37]/50 bg-[#d4af37]/10 text-[#d4af37]'
                : 'border-white/10 bg-white/[0.02] text-white/50'
            }`}
          >
            {m === 'random' ? 'Numeros al azar' : 'Elegir manualmente'}
          </button>
        ))}
      </div>

      {mode === 'random' ? (
        <div className="text-center py-8 bg-[#d4af37]/5 rounded-xl border border-dashed border-[#d4af37]/20">
          <div className="text-3xl mb-2">🎲</div>
          <p className="text-white/50 text-sm">
            Se asignaran <strong className="text-white">{qty} numeros al azar</strong> automaticamente
          </p>
          <p className="text-[11px] text-white/30 mt-2">Los numeros se asignan al confirmar el pago</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              placeholder="Buscar numero (ej: 777)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#d4af37]/50"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black rounded-xl px-5 font-bold text-sm"
            >
              {loading ? '...' : 'Buscar'}
            </button>
          </div>

          {numbers.length > 0 && (
            <NumberGrid numbers={numbers} selected={selected} onToggle={handleToggle} maxSelect={qty} />
          )}

          <div className="text-xs text-white/30 mt-3">
            Seleccionados: {selected.length} de {qty}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selected.map((n) => (
                <span
                  key={n}
                  className="bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {String(n).padStart(5, '0')}
                  <button onClick={() => handleToggle(n)} className="opacity-60 hover:opacity-100">
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <Button
        className="mt-5"
        disabled={mode === 'manual' && selected.length !== qty}
        onClick={() => {
          // Fire InitiateCheckout una sola vez cuando el usuario termina la
          // selección de números. Pixel dispara inmediato (sincrónico en fbq
          // queue) y reserveNumbers([]) con meta dispara el CAPI con el mismo
          // eventId → Meta dedupe automáticamente. El array vacío hace skip
          // del loop de reserva (no-op en DB); solo usa la branch del CAPI.
          const eventId = generateEventId();
          trackInitiateCheckout({ eventId, value: price, currency: 'PYG' });
          reserveNumbers([], { eventId, value: price }).catch(() => {});
          onComplete(mode === 'manual' ? selected : [], mode);
        }}
      >
        Continuar
      </Button>
    </div>
  );
}
