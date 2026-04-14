'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Email o contrasena incorrectos' : error.message);
    } else {
      router.push('/mis-boletos');
    }
    setLoading(false);
  }

  async function handleRegister() {
    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }
    if (!telefono.trim()) {
      setError('El telefono es obligatorio');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { telefono: telefono.trim() } },
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Cuenta creada. Revisa tu email para confirmar o inicia sesion directamente.');
      setTab('login');
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

          <Input label="Email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Contrasena" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />

          {tab === 'register' && (
            <>
              <Input
                label="Confirmar contrasena"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Input
                label="Telefono"
                type="tel"
                placeholder="0981 123 456"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </>
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

        <p className="text-center text-white/20 text-xs mt-6">
          Al registrarte aceptas nuestros Terminos y Condiciones
        </p>
      </div>
    </div>
  );
}
