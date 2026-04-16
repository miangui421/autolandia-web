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
import { SORTEO_PRIZE, SORTEO_DATE } from '@/lib/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function MisBoletosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalBoletos: 0, totalGastado: 0, totalCompras: 0 });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Extraer teléfono: prioridad metadata > user.phone > email interno (user.XXX@autolandia.internal)
      let phone = user.user_metadata?.telefono || user.phone || '';
      if (!phone && user.email?.endsWith('@autolandia.internal')) {
        const match = user.email.match(/user\.(\d+)@/);
        if (match) phone = match[1];
      }
      const formattedPhone = phone ? `+${phone}` : '';
      const name = user.user_metadata?.nombre || formattedPhone;
      setUserName(name);

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
        <p className="text-white/30 text-sm">Cargando tus boletos...</p>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((SORTEO_DATE.getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-[600px] mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </Link>
          <button onClick={handleLogout} className="text-xs text-white/40 hover:text-white/60 transition-colors border border-white/10 px-3 py-1.5 rounded-lg">
            Cerrar sesion
          </button>
        </div>
      </nav>

      <div className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
        {/* Greeting */}
        <div className="animate-slide-up">
          <p className="text-white/40 text-sm">Bienvenido de vuelta</p>
          <h1 className="text-2xl font-extrabold mt-0.5">
            {userName.split(' ')[0]} <span className="inline-block animate-float">👋</span>
          </h1>
        </div>

        {/* Active raffle card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#d4af37]/20 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-[#d4af37]/10 via-transparent to-[#d4af37]/5 pointer-events-none" />
          <div className="flex items-center gap-4 p-4 relative">
            <img
              src="https://xtwrmcbvjgywwdpdwoxw.supabase.co/storage/v1/object/public/assets/WhatsApp%20Image%202026-03-30%20at%2016.56.51.jpeg"
              alt={SORTEO_PRIZE}
              className="w-20 h-20 rounded-xl object-cover border border-[#d4af37]/20"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#d4af37] uppercase tracking-widest font-semibold">Sorteo activo</p>
              <p className="text-sm font-bold mt-0.5 truncate">{SORTEO_PRIZE}</p>
              <p className="text-xs text-white/30 mt-0.5">Faltan {daysLeft} dias</p>
            </div>
            <Link
              href="/"
              className="shrink-0 bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-xs font-bold px-4 py-2 rounded-xl"
            >
              Comprar
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <StatsRow {...stats} />
        </div>

        {/* Purchase history */}
        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
              Mis compras
            </h2>
            <span className="text-[11px] text-white/20">{purchases.length} compra{purchases.length !== 1 ? 's' : ''}</span>
          </div>

          {purchases.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <div className="text-5xl mb-4">🎟️</div>
              <p className="text-white/60 font-semibold">Aun no tenes boletos</p>
              <p className="text-white/30 text-sm mt-1 mb-5">Compra tu primer boleto y aparecera aqui</p>
              <Link
                href="/"
                className="inline-block bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold px-6 py-3 rounded-xl"
              >
                Participar ahora
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {purchases.map((p, i) => (
                <div key={p.ticket_id} className="animate-slide-up" style={{ animationDelay: `${0.25 + i * 0.05}s` }}>
                  <PurchaseCard purchase={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
