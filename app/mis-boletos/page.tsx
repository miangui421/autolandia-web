'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { PurchaseCard } from '@/components/dashboard/PurchaseCard';
import { getUserPurchases, getUserStats } from '@/app/actions/user-data';
import type { UserPurchase } from '@/app/actions/user-data';
import type { UserStats } from '@/app/actions/user-data';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function MisBoletosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalBoletos: 0, totalGastado: 0, totalCompras: 0 });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || '');
      const phone = user.user_metadata?.telefono || '';
      setTelefono(phone);

      if (phone) {
        const [purchaseData, statsData] = await Promise.all([
          getUserPurchases(phone),
          getUserStats(phone),
        ]);
        setPurchases(purchaseData);
        setStats(statsData);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/50">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-[600px] mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </Link>
          <button onClick={handleLogout} className="text-xs text-white/40 hover:text-white/60 transition-colors">
            Cerrar sesion
          </button>
        </div>
      </nav>

      <div className="max-w-[600px] mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold">Hola! 👋</h1>
          <p className="text-sm text-white/40 mt-1">{userEmail}</p>
        </div>

        {/* Stats */}
        <StatsRow {...stats} />

        {/* CTA */}
        <Link
          href="/"
          className="block w-full py-3.5 rounded-xl font-bold text-center bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm shadow-[0_4px_16px_rgba(212,175,55,0.2)]"
        >
          Comprar mas boletos
        </Link>

        {/* Purchase history */}
        <div>
          <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
            Historial de compras
          </h2>

          {purchases.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-3">🎟️</div>
              <p className="text-white/50 text-sm">Aun no tenes compras</p>
              <p className="text-white/30 text-xs mt-1">Compra tu primer boleto y aparecera aqui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <PurchaseCard key={p.ticket_id} purchase={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
