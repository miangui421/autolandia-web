'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Convierte telefono a email interno para Supabase Auth (temporal hasta Twilio) */
function phoneToEmail(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `user.${clean}@autolandia.app`;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin() {
    if (!telefono.trim() || !password) {
      setError('Completa todos los campos');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(telefono),
      password,
    });
    if (error) {
      setError('Telefono o contrasena incorrectos');
    } else {
      router.push('/mis-boletos');
    }
    setLoading(false);
  }

  async function handleRegister() {
    if (!telefono.trim() || !password || !nombre.trim()) {
      setError('Completa todos los campos');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    const cleanPhone = telefono.replace(/\D/g, '');
    const { error } = await supabase.auth.signUp({
      email: phoneToEmail(telefono),
      password,
      options: {
        data: {
          telefono: cleanPhone,
          nombre: nombre.trim(),
        },
      },
    });
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este telefono ya tiene una cuenta. Inicia sesion.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Cuenta creada! Inicia sesion.');
      setTab('login');
      setPassword('');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <Link href="/" className="block text-center mb-8">
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </span>
          <p className="text-white/30 text-xs mt-1">Accede a tu cuenta</p>
        </Link>

        {/* Tab switch */}
        <div className="flex mb-6 glass-card p-1">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {t === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="glass-card p-6">
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Telefono */}
          <div className="mb-4">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Telefono</label>
            <input
              type="tel"
              placeholder="0981 123 456"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
            />
          </div>

          {/* Nombre (solo registro) */}
          {tab === 'register' && (
            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Nombre completo</label>
              <input
                type="text"
                placeholder="Ej: Juan Perez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
              />
            </div>
          )}

          {/* Contrasena con toggle */}
          <div className="mb-4">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-sm"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirmar contrasena (solo registro) */}
          {tab === 'register' && (
            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">Confirmar contrasena</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white text-sm focus:border-[#d4af37]/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors text-sm"
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button loading={loading} onClick={tab === 'login' ? handleLogin : handleRegister}>
            {tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </div>

        <Link href="/" className="block text-center text-white/30 text-xs mt-6 hover:text-white/50 transition-colors">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
