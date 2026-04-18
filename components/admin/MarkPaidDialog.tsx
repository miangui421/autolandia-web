'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markSorteoPaid } from '@/app/actions/sorteo';

export function MarkPaidDialog({ sorteoId, currentEstado }: { sorteoId: string; currentEstado: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (currentEstado === 'pagado') {
    return (
      <div className="text-center py-3 px-4 bg-green-500/10 border border-green-500/20 rounded-xl">
        <p className="text-green-300 text-xs font-bold uppercase tracking-wider">✓ Pagado</p>
      </div>
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    const res = await markSorteoPaid(sorteoId, ref);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Error');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs font-bold border border-white/10 text-white/60 py-2.5 rounded-xl hover:border-white/20 hover:text-white/80"
      >
        Marcar como pagado
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card p-6 max-w-md w-full">
            <h3 className="font-bold mb-3">Marcar sorteo como pagado</h3>
            <p className="text-xs text-white/50 mb-4">
              Sorteo <code className="text-[#d4af37]">{sorteoId}</code>. Opcional: referencia de pago.
            </p>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Ref. transferencia (opcional)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm mb-3"
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-xs font-bold border border-white/10 text-white/60 py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 text-xs font-bold bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black py-2.5 rounded-xl disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
