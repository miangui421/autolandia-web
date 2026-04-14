'use client';
import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-[900px] mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA
          </span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-semibold text-[#d4af37] border border-[#d4af37]/30 px-4 py-2 rounded-full hover:bg-[#d4af37]/10 transition-all"
        >
          Iniciar sesion
        </Link>
      </div>
    </nav>
  );
}
