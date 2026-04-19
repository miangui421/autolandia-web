'use client';
import { useState } from 'react';
import { deleteSorteo } from '@/app/actions/sorteo';

export function DeleteSorteoDialog({ sorteoId, titulo }: { sorteoId: string; titulo: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    const res = await deleteSorteo(sorteoId);
    if (!res.success) {
      setLoading(false);
      setError(res.error || 'Error eliminando');
      return;
    }
    // Hard navigation: la pagina actual /admin/sorteos/[id] ya no existe en DB.
    // router.push puede trabarse intentando re-renderizar. window.location garantiza navegacion.
    window.location.href = '/admin';
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-[11px] font-bold text-red-300 border border-red-500/30 py-2 rounded-xl hover:bg-red-500/10"
      >
        🗑️ Eliminar sorteo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card p-6 max-w-md w-full border-red-500/30">
            <h3 className="font-bold mb-3 text-red-300">⚠️ Eliminar sorteo</h3>
            <div className="mb-4 p-3 bg-white/5 rounded-lg text-sm space-y-1">
              <p className="font-mono text-[#d4af37] font-bold">{sorteoId}</p>
              <p className="text-white/80">{titulo}</p>
            </div>
            <p className="text-xs text-white/60 mb-4">
              Se elimina la fila completa de la tabla <code className="text-[#d4af37]">sorteos</code>, incluyendo ganadores y snapshot del pool. <b className="text-red-300">Irreversible.</b>
            </p>
            <p className="text-[11px] text-white/40 mb-4">
              Usar solo para limpiar sorteos de prueba. No afecta las ventas ni los boletos del sorteo principal.
            </p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setError('');
                }}
                className="flex-1 text-xs font-bold border border-white/10 text-white/60 py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 py-2.5 rounded-xl disabled:opacity-50 hover:bg-red-500/30"
              >
                {loading ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
