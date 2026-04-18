import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { SorteoForm } from '@/components/admin/SorteoForm';

export const dynamic = 'force-dynamic';

export default async function NuevoSorteoPage() {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <Link href="/admin" className="text-white/50 text-xl" aria-label="Volver">
            ←
          </Link>
          <h2 className="text-sm font-semibold">Nuevo sorteo</h2>
        </div>
      </nav>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        <SorteoForm />
      </div>
    </div>
  );
}
