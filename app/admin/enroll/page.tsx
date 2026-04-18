'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { enrollAdmin } from '@/app/actions/admin-totp';

export default function EnrollPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-white/50">Cargando...</p></div>}>
      <EnrollContent />
    </Suspense>
  );
}

function EnrollContent() {
  const searchParams = useSearchParams();
  const bootstrapToken = searchParams.get('token') || '';
  const [phone, setPhone] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ qrDataUrl: string; secret: string; phone: string } | null>(null);

  async function handleSubmit() {
    setError('');
    if (!bootstrapToken) {
      setError('Falta el query param ?token=...');
      return;
    }
    if (!/^595\d{9}$/.test(phone)) {
      setError('Telefono debe ser 595XXXXXXXXX (12 digitos, sin + ni espacios)');
      return;
    }
    setLoading(true);
    const res = await enrollAdmin({ phone, nombre, bootstrapToken });
    setLoading(false);
    if (!res.success || !res.qrDataUrl || !res.secret) {
      setError(res.error || 'Error');
      return;
    }
    setResult({ qrDataUrl: res.qrDataUrl, secret: res.secret, phone });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA ADMIN
          </span>
          <p className="text-white/30 text-xs mt-1">Enrollment 2FA (setup unico)</p>
        </div>

        {!result && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold mb-4">Registrar admin</h2>
            {!bootstrapToken && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-400 text-xs">Agrega ?token=xxx en la URL</p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase mb-1.5">Telefono (595XXXXXXXXX)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="595981234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={12}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-white/50 uppercase mb-1.5">Nombre</label>
              <input
                type="text"
                placeholder="Miguel"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <Button loading={loading} onClick={handleSubmit}>
              Generar QR TOTP
            </Button>
          </div>
        )}

        {result && (
          <div className="glass-card p-6 text-center">
            <h2 className="text-lg font-bold mb-2">Escanea con Google Authenticator</h2>
            <p className="text-xs text-white/40 mb-4">Admin: {result.phone}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.qrDataUrl} alt="QR TOTP" className="mx-auto w-56 h-56 bg-white p-2 rounded-xl" />
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-300 text-[11px] font-bold uppercase tracking-wider mb-1">Secret (solo esta vez)</p>
              <p className="font-mono text-xs text-white break-all">{result.secret}</p>
            </div>
            <p className="text-[11px] text-white/40 mt-4">
              Si perdes el acceso, tenes que re-enrollar. El secret NO se muestra de nuevo.
            </p>
            <Link
              href="/admin/login"
              className="block mt-5 bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold py-3 rounded-xl"
            >
              Ir al login admin
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
