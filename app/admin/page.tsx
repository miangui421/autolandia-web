import { requireAdmin } from '@/lib/admin-auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { DashboardStats } from '@/components/admin/DashboardStats';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { nombre } = await requireAdmin();
  return (
    <div className="min-h-screen">
      <AdminNav nombre={nombre} />
      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <DashboardStats />
      </div>
    </div>
  );
}
