import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { getSorteoAdmin } from '@/app/actions/sorteo';
import { Sorteador } from '@/components/admin/Sorteador';
import { MarkPaidDialog } from '@/components/admin/MarkPaidDialog';
import { formatGs } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export default async function SorteoExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sorteo = await getSorteoAdmin(id);
  if (!sorteo) notFound();

  const fecha = new Date(sorteo.created_at).toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="relative">
      <Sorteador
        sorteoId={sorteo.sorteo_id}
        titulo={sorteo.titulo}
        premioMonto={sorteo.premio_monto}
        premioDesc={sorteo.premio_descripcion}
        ganadores={sorteo.ganadores}
        poolSampleNames={sorteo.pool_sample_names}
      />

      {/* Sidebar admin (oculto en fullscreen) */}
      <aside className="hide-in-fullscreen fixed top-20 right-4 w-72 glass-card p-4 z-30 hidden lg:block">
        <h3 className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-3">Info admin</h3>
        <dl className="space-y-1.5 text-[11px]">
          <Row k="ID" v={sorteo.sorteo_id} />
          <Row k="Pool" v={`${sorteo.pool_count} personas`} />
          <Row k="Ganadores" v={String(sorteo.cantidad_ganadores)} />
          <Row k="Ponderado" v={sorteo.ponderar_por_boletos ? 'Si' : 'No'} />
          <Row k="Fecha" v={fecha} />
          <Row k="Estado" v={sorteo.estado} />
          {sorteo.pago_referencia && <Row k="Ref. pago" v={sorteo.pago_referencia} />}
        </dl>

        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Ganadores (privado)</p>
          {sorteo.ganadores.map((g) => (
            <div key={g.pick_order} className="text-[11px] bg-white/5 rounded-lg p-2">
              <p className="font-bold">{g.pick_order}. {g.nombre}</p>
              <p className="font-mono text-white/50">{g.phone}</p>
              <p className="text-white/40">CI: {g.ci || '—'} · {g.ticket_count} boletos</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <MarkPaidDialog sorteoId={sorteo.sorteo_id} currentEstado={sorteo.estado} />
          <Link
            href={`/sorteo/${sorteo.sorteo_id}`}
            target="_blank"
            className="block text-center text-[11px] text-[#d4af37] border border-[#d4af37]/30 py-2 rounded-xl hover:bg-[#d4af37]/10"
          >
            Ver recibo publico ↗
          </Link>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-[10px] text-white/30 leading-relaxed">
            💰 {formatGs(sorteo.premio_monto)}
            {sorteo.premio_descripcion && ` · ${sorteo.premio_descripcion}`}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-white/40 uppercase tracking-wider shrink-0">{k}</dt>
      <dd className="text-white/80 text-right truncate">{v}</dd>
    </div>
  );
}
