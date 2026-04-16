'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { sendOtp, verifyOtpAndGetToken } from '@/app/actions/auth-otp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Normaliza a formato E.164 (+595XXXXXXXXX) */
function normalizePhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('595')) return '+' + clean;
  if (clean.startsWith('0')) return '+595' + clean.slice(1);
  if (clean.length === 9) return '+595' + clean;
  return '+' + clean;
}

type Step = 'phone' | 'otp' | 'profile';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [telefono, setTelefono] = useState('');
  const [otp, setOtp] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Consume el magic link retornado por el server action para establecer la sesión
   * en el cliente. El action_link contiene el token_hash que Supabase verifica.
   */
  async function consumeMagicLink(actionLink: string): Promise<boolean> {
    const url = new URL(actionLink);
    const tokenHash = url.searchParams.get('token') || url.searchParams.get('token_hash');
    const type = (url.searchParams.get('type') as 'magiclink' | 'email') || 'magiclink';

    if (!tokenHash) {
      setError('Token invalido. Intenta de nuevo.');
      return false;
    }

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error('verifyOtp session error:', error);
      setError('Error estableciendo sesion: ' + error.message);
      return false;
    }
    return true;
  }

  async function handleSendOtp() {
    if (!telefono.trim()) {
      setError('Ingresa tu telefono');
      return;
    }
    setLoading(true);
    setError('');

    const phone = normalizePhone(telefono);
    const result = await sendOtp(phone);

    if (!result.success) {
      setError(result.error || 'No pudimos enviar el codigo');
    } else {
      setStep('otp');
    }
    setLoading(false);
  }

  async function handleVerifyOtp() {
    if (!otp.trim() || otp.length !== 6) {
      setError('Ingresa el codigo de 6 digitos');
      return;
    }
    setLoading(true);
    setError('');

    const phone = normalizePhone(telefono);
    const result = await verifyOtpAndGetToken(phone, otp.trim());

    if (!result.success || !result.actionLink) {
      setError(result.error || 'Codigo incorrecto');
      setLoading(false);
      return;
    }

    // Establecer sesión en el cliente
    const sessionOk = await consumeMagicLink(result.actionLink);
    if (!sessionOk) {
      setLoading(false);
      return;
    }

    // Si el usuario no tiene nombre guardado, pedirlo. Si ya lo tiene, ir al dashboard.
    if (!result.hasProfile) {
      setStep('profile');
      setLoading(false);
    } else {
      router.push('/mis-boletos');
    }
  }

  async function handleSaveProfile() {
    if (!nombre.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    setLoading(true);
    setError('');

    // Usa la sesión activa del cliente (no server action)
    const { error } = await supabase.auth.updateUser({
      data: { nombre: nombre.trim() },
    });

    if (error) {
      setError('Error guardando tu nombre: ' + error.message);
      setLoading(false);
    } else {
      router.push('/mis-boletos');
    }
  }

  async function handleResend() {
    setOtp('');
    setError('');
    await handleSendOtp();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="block text-center mb-8">
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </span>
          <p className="text-white/30 text-xs mt-1">
            {step === 'phone' && 'Inicia sesion con tu telefono'}
            {step === 'otp' && 'Verifica tu telefono'}
            {step === 'profile' && 'Completa tu perfil'}
          </p>
        </Link>

        {step === 'phone' && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-2">Tu telefono</h2>
            <p className="text-sm text-white/40 mb-5">
              Te enviaremos un codigo por SMS para verificar tu cuenta. Si es tu primera vez, se creara automaticamente.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Telefono</label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-white/5 border border-white/10 rounded-xl text-white/60 text-sm">
                  +595
                </div>
                <input
                  type="tel"
                  placeholder="981 123 456"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  autoFocus
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button loading={loading} onClick={handleSendOtp}>
              Continuar
            </Button>
          </div>
        )}

        {step === 'otp' && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-2">Ingresa el codigo</h2>
            <p className="text-sm text-white/40 mb-1">Enviamos un SMS con un codigo de 6 digitos a</p>
            <p className="text-[#d4af37] font-bold mb-5">{normalizePhone(telefono)}</p>

            <div className="mb-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl text-center tracking-[0.5em] font-bold focus:border-[#d4af37]/50 transition-colors"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button loading={loading} onClick={handleVerifyOtp}>
              Verificar codigo
            </Button>

            <button
              onClick={handleResend}
              disabled={loading}
              className="w-full mt-3 text-xs text-white/40 hover:text-white/60 transition-colors py-2"
            >
              No llego el codigo? Reenviar
            </button>
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
              className="w-full text-xs text-white/30 hover:text-white/50 transition-colors py-1"
            >
              ← Cambiar telefono
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-2">Bienvenido! 👋</h2>
            <p className="text-sm text-white/40 mb-5">
              Necesitamos un dato mas para completar tu cuenta.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Nombre completo</label>
              <input
                type="text"
                placeholder="Ej: Juan Perez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
              />
              <p className="text-[11px] text-white/25 mt-1.5">Asi te reconoceremos en el sistema</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Button loading={loading} onClick={handleSaveProfile}>
              Completar registro
            </Button>
          </div>
        )}

        <Link href="/" className="block text-center text-white/30 text-xs mt-6 hover:text-white/50 transition-colors">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
