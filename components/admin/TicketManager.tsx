'use client';
import { useState } from 'react';
import { searchTickets, deleteTicket, type TicketRow } from '@/app/actions/admin-tickets';
import { formatGs } from '@/lib/calculator';

export function TicketManager() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TicketRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const [confirmTicket, setConfirmTicket] = useState<TicketRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ ticketId: string; liberados: number; sheetsDeleted: boolean } | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setResult(null);
    try {
      const rows = await searchTickets(query.trim());
      setResults(rows);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error buscando');
    }
    setSearching(false);
  }

  async function handleConfirmDelete() {
    if (!confirmTicket) return;
    setDeleting(true);
    setError('');
    const res = await deleteTicket(confirmTicket.ticket_id);
    setDeleting(false);
    if (!res.success) {
      setError(res.error || 'Error eliminando');
      return;
    }
    setResult({
      ticketId: confirmTicket.ticket_id,
      liberados: res.numerosLiberados ?? 0,
      sheetsDeleted: res.sheetsDeleted ?? false,
    });
    setResults((prev) => prev.filter((r) => r.ticket_id !== confirmTicket.ticket_id));
    setConfirmTicket(null);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="TK-1234 · 0981234567 · CI · nombre"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold px-6 py-3 rounded-xl disabled:opacity-50"
        >
          {searching ? '...' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-300 text-sm font-bold">✓ {result.ticketId} eliminado</p>
          <p className="text-xs text-white/60 mt-1">
            {result.liberados} numeros liberados ·{' '}
            {result.sheetsDeleted ? 'fila eliminada del Sheets' : '⚠️ no se encontro fila en Sheets (revisa logs)'}
          </p>
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="text-center py-6 text-white/40 text-sm">Sin resultados para "{query}"</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-bold">
            {results.length} resultado{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((t) => (
            <TicketCard key={t.id} ticket={t} onDelete={() => setConfirmTicket(t)} />
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card p-6 max-w-md w-full border-red-500/30">
            <h3 className="font-bold mb-3 text-red-300">⚠️ Eliminar ticket</h3>
            <div className="mb-4 p-3 bg-white/5 rounded-lg text-sm space-y-1">
              <p className="font-mono text-[#d4af37] font-bold">{confirmTicket.ticket_id}</p>
              <p className="text-white/80">{confirmTicket.nombre_completo}</p>
              <p className="text-white/50 text-xs">
                {confirmTicket.cantidad} boleto(s) · {formatGs(confirmTicket.monto)}
              </p>
              <p className="text-white/40 text-[10px] font-mono break-all">
                Numeros: {(confirmTicket.numeros_asignados ?? []).sort((a, b) => a - b).map((n) => String(n).padStart(5, '0')).join(', ')}
              </p>
            </div>
            <p className="text-xs text-white/60 mb-4">
              Se elimina de la DB, los numeros vuelven a LIBRE, y se remueve la fila del Sheets.{' '}
              <b className="text-red-300">Irreversible.</b>
            </p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmTicket(null);
                  setError('');
                }}
                className="flex-1 text-xs font-bold border border-white/10 text-white/60 py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 py-2.5 rounded-xl disabled:opacity-50 hover:bg-red-500/30"
              >
                {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, onDelete }: { ticket: TicketRow; onDelete: () => void }) {
  const numerosStr = (ticket.numeros_asignados ?? [])
    .sort((a, b) => a - b)
    .map((n) => String(n).padStart(5, '0'))
    .join(', ');
  const fecha = new Date(ticket.fecha).toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/30 flex items-center justify-center">
        <span className="text-[10px] font-bold text-[#d4af37]">{ticket.ticket_id.replace('TK-', '')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold truncate">{ticket.nombre_completo || 'Sin nombre'}</h3>
          <span className="text-[10px] text-white/30 font-mono">CI {ticket.ci || '—'}</span>
        </div>
        <p className="text-[11px] text-white/50">
          📱 {ticket.telefono} · {ticket.cantidad} boleto{ticket.cantidad > 1 ? 's' : ''} · {formatGs(ticket.monto)} · {ticket.metodo_pago}
        </p>
        <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">
          {numerosStr || '—'}
        </p>
        <p className="text-[10px] text-white/20 mt-0.5">{fecha}</p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 text-xs font-bold text-red-300 border border-red-500/30 px-3 py-2 rounded-lg hover:bg-red-500/10"
      >
        🗑️
      </button>
    </div>
  );
}
