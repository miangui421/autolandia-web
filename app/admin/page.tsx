import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { listSorteos } from '@/app/actions/sorteo';
import { formatGs } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { nombre } = await requireAdmin();
  const sorteos = await listSorteos();

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-[900px] mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA · ADMIN
          </Link>
          <span className="text-xs text-white/40">Hola, {nombre}</span>
        </div>
      </nav>

      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Sorteos</h1>
          <Link
            href="/admin/sorteos/nuevo"
            className="bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:-translate-y-0.5 transition-transform"
          >
            + Nuevo sorteo
          </Link>
        </div>

        {sorteos.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="text-5xl mb-4">🎲</div>
            <p className="text-white/60 font-semibold">Todavia no hay sorteos</p>
            <p className="text-white/30 text-sm mt-1">Crea el primero usando el boton de arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorteos.map((s) => (
              <Link
                key={s.sorteo_id}
                href={`/admin/sorteos/${s.sorteo_id}`}
                className="glass-card p-4 flex items-center gap-4 hover:border-[#d4af37]/40 transition-colors"
              >
                <div className="shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#d4af37]">{s.sorteo_id.replace('SORT-', '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold truncate">{s.titulo}</h3>
                    <EstadoPill estado={s.estado} />
                  </div>
                  <p className="text-xs text-white/50 mt-1 truncate">
                    {s.ganadores.length > 0
                      ? `🏆 ${s.ganadores.map((g) => g.nombre).join(', ')}`
                      : 'Sin ganadores'}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">
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
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[estado] || styles.completado}`}
    >
      {estado}
    </span>
  );
}
