import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { listSorteos } from '@/app/actions/sorteo';
import { AdminNav } from '@/components/admin/AdminNav';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { CanalSection } from '@/components/admin/CanalSection';
import { AttributionSection } from '@/components/admin/AttributionSection';
import { TicketManager } from '@/components/admin/TicketManager';
import { formatGs } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { nombre } = await requireAdmin();
  const sorteos = await listSorteos();

  return (
    <div className="min-h-screen">
      <AdminNav nombre={nombre} />

      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-10">
        {/* ─── Sección 1: Stats del sorteo BMW ─── */}
        <section>
          <header className="mb-4">
            <h2 className="text-lg font-bold">Sorteo BMW · Resumen</h2>
            <p className="text-xs text-white/40 mt-0.5">Ventas totales, progreso y gráfico diario</p>
          </header>
          <DashboardStats />
        </section>

        {/* ─── Sección 1.5: Ventas por canal (Web vs Bot) ─── */}
        <CanalSection />

        {/* ─── Sección 1.6: Ventas por medio (atribución UTMs) ─── */}
        <AttributionSection />

        {/* ─── Sección 2: Sorteos laterales ─── */}
        <section>
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Sorteos laterales</h2>
              <p className="text-xs text-white/40 mt-0.5">Giveaways filtrados ejecutados sobre las ventas</p>
            </div>
            <Link
              href="/admin/sorteos/nuevo"
              className="shrink-0 bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-xs font-bold px-4 py-2 rounded-xl hover:-translate-y-0.5 transition-transform"
            >
              + Nuevo sorteo
            </Link>
          </header>

          {sorteos.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-3">🎲</div>
              <p className="text-white/60 text-sm font-semibold">Todavia no hay sorteos laterales</p>
              <p className="text-white/30 text-xs mt-1">Creá el primero con el botón de arriba.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sorteos.map((s) => (
                <Link
                  key={s.sorteo_id}
                  href={`/admin/sorteos/${s.sorteo_id}`}
                  className="glass-card p-3.5 flex items-center gap-3 hover:border-[#d4af37]/40 transition-colors"
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#d4af37]">{s.sorteo_id.replace('SORT-', '')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm truncate">{s.titulo}</h3>
                      <EstadoPill estado={s.estado} />
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5 truncate">
                      {s.ganadores.length > 0 ? `🏆 ${s.ganadores.map((g) => g.nombre).join(', ')}` : 'Sin ganadores'}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {s.pool_count} participantes · {new Date(s.created_at).toLocaleString('es-PY')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[#d4af37]">{formatGs(s.premio_monto)}</div>
                    <div className="text-[10px] text-white/30 uppercase">
                      {s.cantidad_ganadores} ganador{s.cantidad_ganadores > 1 ? 'es' : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── Sección 3: Gestión de tickets ─── */}
        <section>
          <header className="mb-4">
            <h2 className="text-lg font-bold">Tickets</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Buscar por TK, teléfono, CI o nombre. Al eliminar: los números vuelven a LIBRE y se remueve la fila del Sheets.
            </p>
          </header>
          <TicketManager />
        </section>
      </div>
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    completado: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    pagado: 'bg-green-500/10 text-green-300 border-green-500/30',
    cancelado: 'bg-red-500/10 text-red-300 border-red-500/30',
  };
  return (
    <span
      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[estado] || styles.completado}`}
    >
      {estado}
    </span>
  );
}
