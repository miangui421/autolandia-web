'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { verifyTotp } from '@/app/actions/admin-totp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Status = 'loading' | 'no_session' | 'ready' | 'not_admin';

function normalizeToE164Digits(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local ? '595' + local : '';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('no_session');
        return;
      }
      let rawPhone = user.user_metadata?.telefono || user.phone || '';
      if (!rawPhone && user.email?.endsWith('@autolandia.internal')) {
        const m = user.email.match(/user\.(\d+)@/);
        if (m) rawPhone = m[1];
      }
      const normalized = normalizeToE164Digits(rawPhone);
      if (!normalized) {
        setStatus('not_admin');
        return;
      }
      setPhone(normalized);
      setStatus('ready');
    }
    load();
  }, []);

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Ingresa los 6 digitos');
      return;
    }
    setLoading(true);
    setError('');
    const res = await verifyTotp(phone, code);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Error');
      setCode('');
      return;
    }
    router.push('/admin');
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'no_session') {
    return (
      <InfoCard
        title="Necesitas iniciar sesion primero"
        body="Para acceder al panel admin, primero inicia sesion con tu telefono."
        ctaHref="/login"
        ctaLabel="Iniciar sesion"
      />
    );
  }

  if (status === 'not_admin') {
    return (
      <InfoCard
        title="No tenes acceso al panel admin"
        body="Este panel es solo para administradores. Si crees que es un error, contactanos."
        ctaHref="/mis-boletos"
        ctaLabel="Ir a mis boletos"
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA ADMIN
          </span>
          <p className="text-white/30 text-xs mt-1">Segundo factor (TOTP)</p>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-2">Codigo de 6 digitos</h2>
          <p className="text-sm text-white/40 mb-5">Abri Google Authenticator (o Authy, 1Password) y pega el codigo.</p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl text-center tracking-[0.5em] font-bold focus:border-[#d4af37]/50 transition-colors mb-4"
          />

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button loading={loading} onClick={handleVerify}>
            Verificar codigo
          </Button>
        </div>

        <Link href="/" className="block text-center text-white/30 text-xs mt-6 hover:text-white/50">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ title, body, ctaHref, ctaLabel }: { title: string; body: string; ctaHref: string; ctaLabel: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] text-center glass-card p-8">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-white/60 text-sm mt-2">{body}</p>
        <Link
          href={ctaHref}
          className="block mt-6 bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold py-3 rounded-xl"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
