'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { PACKS_3X1, PROMO_3X1_END } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';
import { checkPromo3x1Eligibility } from '@/app/actions/check-3x1-eligibility';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Status = 'loading' | 'eligible' | 'already_used' | 'expired';

export default function Promo3x1Page() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    async function load() {
      if (new Date() > PROMO_3X1_END) {
        setStatus('expired');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const hasProfile = !!user.user_metadata?.nombre && !!user.user_metadata?.ci;
      if (!hasProfile) {
        router.push('/login');
        return;
      }

      let phone = user.user_metadata?.telefono || user.phone || '';
      if (!phone && user.email?.endsWith('@autolandia.internal')) {
        const match = user.email.match(/user\.(\d+)@/);
        if (match) phone = match[1];
      }

      const result = await checkPromo3x1Eligibility(phone);
      setStatus(result.eligible ? 'eligible' : 'already_used');
    }
    load();
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
        <p className="text-white/30 text-sm">Verificando elegibilidad...</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <InfoScreen
        emoji="⌛"
        title="La promo 3x1 termino"
        message="Ya no esta disponible esta promocion. Pero todavia podes participar del sorteo con los packs normales."
        ctaLabel="Ver packs"
        ctaHref="/"
      />
    );
  }

  if (status === 'already_used') {
    return (
      <InfoScreen
        emoji="✅"
        title="Ya usaste tu 3x1"
        message="La promo 3x1 es valida una sola vez por persona. Podes seguir comprando con los packs normales."
        ctaLabel="Ver mis boletos"
        ctaHref="/mis-boletos"
        secondaryLabel="Seguir comprando"
        secondaryHref="/"
      />
    );
  }

  return (
    <main className="min-h-screen pb-12">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <Link href="/" className="text-white/50 text-xl" aria-label="Volver">←</Link>
          <h2 className="text-sm font-semibold">Promo 3x1</h2>
        </div>
      </nav>

      <div className="max-w-[600px] mx-auto px-4 py-6">
        <div className="text-center mb-6 animate-slide-up">
          <div className="inline-block bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-extrabold text-3xl px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.3)] mb-4">
            3x1
          </div>
          <h1 className="text-2xl font-extrabold">Triplica tus chances</h1>
          <p className="text-white/60 mt-2 text-sm">Pagas 1 boleto, llevas 3. Elegi cuantos 3x1 queres comprar.</p>
          <p className="text-[11px] text-[#d4af37] mt-2 font-semibold uppercase tracking-wider">
            Exclusivo · Solo 1 compra por persona
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PACKS_3X1.map((pack, i) => (
            <Link
              key={pack.cantidad}
              href={`/checkout?qty=${pack.cantidad}&price=${pack.precio}&promo=3x1`}
              className="group relative rounded-2xl p-5 text-center transition-all duration-300 hover:-translate-y-1 animate-slide-up bg-gradient-to-b from-[#d4af37]/15 to-[#d4af37]/5 border border-[#d4af37]/40 hover:border-[#d4af37]/70 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)]"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="text-3xl font-extrabold text-[#d4af37] group-hover:scale-110 transition-transform">
                {pack.cantidad}
              </div>
              <div className="text-[11px] text-white/40 uppercase mt-1">boletos</div>
              <div className="text-base font-bold mt-3">{formatGs(pack.precio)}</div>
              <div className="text-[11px] text-green-400 font-semibold mt-1">3x1</div>
              <div className="text-[10px] text-white/30 mt-1">{formatGs(pack.precioPorBoleto)}/boleto</div>
            </Link>
          ))}
        </div>

        <p className="text-[11px] text-white/30 text-center mt-6">
          Al completar la compra, el 3x1 queda marcado como usado en tu cuenta.
        </p>
      </div>
    </main>
  );
}

function InfoScreen({
  emoji,
  title,
  message,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
}: {
  emoji: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] text-center glass-card p-8">
        <div className="text-5xl mb-4">{emoji}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-white/60 text-sm mt-2">{message}</p>
        <div className="mt-6 space-y-2">
          <Link
            href={ctaHref}
            className="block w-full bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold py-3 rounded-xl"
          >
            {ctaLabel}
          </Link>
          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="block w-full text-white/50 hover:text-white/70 text-xs py-2 transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
