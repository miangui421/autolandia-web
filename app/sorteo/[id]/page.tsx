import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSorteoPublic } from '@/app/actions/sorteo';
import { formatGs } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export default async function SorteoPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sorteo = await getSorteoPublic(id);
  if (!sorteo) notFound();

  const fecha = new Date(sorteo.created_at).toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <div className="min-h-screen">
      <nav className="border-b border-white/5 py-3 px-4">
        <div className="max-w-[720px] mx-auto">
          <Link
            href="/"
            className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]"
          >
            AUTOLANDIA
          </Link>
        </div>
      </nav>

      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center">
          <p className="text-[11px] text-[#d4af37] uppercase tracking-[0.2em] font-bold">Recibo publico de sorteo</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">{sorteo.titulo}</h1>
          <div className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black font-extrabold">
            {formatGs(sorteo.premio_monto)}
          </div>
          {sorteo.premio_descripcion && (
            <p className="text-sm text-white/50 mt-2">{sorteo.premio_descripcion}</p>
          )}
        </div>

        {/* Ganadores */}
        <div className="glass-card p-6">
          <h2 className="text-xs text-white/50 uppercase tracking-widest font-bold mb-4">
            🏆 Ganador{sorteo.ganadores.length > 1 ? 'es' : ''}
          </h2>
          <div className="space-y-3">
            {sorteo.ganadores.map((g) => (
              <div key={g.pick_order} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-black flex items-center justify-center">
                  {g.pick_order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{g.nombre || 'Sin nombre'}</p>
                  <p className="text-[11px] text-white/40 font-mono">{g.phone_masked}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40">Boletos</p>
                  <p className="text-sm font-bold text-[#d4af37]">{g.ticket_count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Criterios */}
        <div className="glass-card p-6">
          <h2 className="text-xs text-white/50 uppercase tracking-widest font-bold mb-4">Criterios aplicados</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Rango de compra" v={`${sorteo.filtros.fecha_desde} → ${sorteo.filtros.fecha_hasta}`} />
            {sorteo.filtros.min_boletos && <Row k="Min. boletos" v={String(sorteo.filtros.min_boletos)} />}
            <Row
              k="Canal"
              v={
                sorteo.filtros.canal === 'web' ? 'Solo web' : sorteo.filtros.canal === 'bot' ? 'Solo bot' : 'Cualquiera'
              }
            />
            <Row
              k="Excluye ganadores previos"
              v={sorteo.filtros.excluir_prev_ganadores ? 'Si' : 'No'}
            />
            <Row k="Ponderado por boletos" v={sorteo.ponderar_por_boletos ? 'Si' : 'No (1 por persona)'} />
            <Row k="Cantidad de ganadores" v={String(sorteo.cantidad_ganadores)} />
          </dl>
        </div>

        {/* Verificacion */}
        <div className="glass-card p-6">
          <h2 className="text-xs text-white/50 uppercase tracking-widest font-bold mb-4">Verificacion</h2>
          <dl className="space-y-2 text-sm">
            <Row k="ID del sorteo" v={sorteo.sorteo_id} mono />
            <Row k="Participantes elegibles" v={`${sorteo.pool_count} personas`} />
            <Row k="Fecha del sorteo" v={fecha} />
            <Row k="Estado" v={sorteo.estado} />
          </dl>
          <p className="text-[11px] text-white/30 mt-5 leading-relaxed">
            Sorteo ejecutado server-side con <code className="text-[#d4af37]">crypto.randomInt()</code> (RNG criptograficamente seguro). El snapshot
            del pool de participantes se registra de forma inmutable antes de la seleccion. Los teléfonos se muestran enmascarados por privacidad.
          </p>
        </div>

        <p className="text-center text-[11px] text-white/30">
          Autolandia &copy; 2026 · Sorteo transparente y auditable
        </p>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-1">
      <dt className="text-xs text-white/40 uppercase tracking-wider shrink-0 w-40">{k}</dt>
      <dd className={`text-sm text-white/80 ${mono ? 'font-mono' : ''}`}>{v}</dd>
    </div>
  );
}
