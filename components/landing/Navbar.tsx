'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function Navbar() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.nombre || '';
        setFirstName(name.split(' ')[0] || 'Mi cuenta');
      }
      setLoaded(true);
    }
    load();

    // Cerrar dropdown al hacer click fuera
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setFirstName(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-[900px] mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </span>
        </Link>

        {/* Placeholder mientras carga la sesion para evitar flash */}
        {!loaded && <div className="w-20 h-8" />}

        {loaded && !firstName && (
          <Link
            href="/login"
            className="text-sm font-semibold text-[#d4af37] border border-[#d4af37]/30 px-4 py-2 rounded-full hover:bg-[#d4af37]/10 transition-all"
          >
            Iniciar sesion
          </Link>
        )}

        {loaded && firstName && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 text-sm font-semibold text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/30 px-4 py-2 rounded-full hover:bg-[#d4af37]/15 transition-all"
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black flex items-center justify-center text-xs font-extrabold">
                {firstName.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[100px] truncate">{firstName}</span>
              <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0f0f15] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <Link
                  href="/mis-boletos"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/5 transition-colors border-b border-white/5"
                >
                  <span>🎟️</span>
                  <span>Mis boletos</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors"
                >
                  <span>↩</span>
                  <span>Cerrar sesion</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
