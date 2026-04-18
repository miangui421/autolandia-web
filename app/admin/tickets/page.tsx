import { requireAdmin } from '@/lib/admin-auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { TicketManager } from '@/components/admin/TicketManager';

export const dynamic = 'force-dynamic';

export default async function AdminTicketsPage() {
  const { nombre } = await requireAdmin();
  return (
    <div className="min-h-screen">
      <AdminNav nombre={nombre} />
      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-extrabold mb-4">Gestion de tickets</h1>
        <p className="text-sm text-white/50 mb-5">
          Busca tickets por ID, telefono o CI. Al eliminar, los numeros vuelven al pool y la fila del Sheets se borra.
        </p>
        <TicketManager />
      </div>
    </div>
  );
}
