import Link from 'next/link';

export function AdminNav({ nombre }: { nombre: string }) {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]"
        >
          AUTOLANDIA · ADMIN
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-white/60 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span aria-hidden="true">🏠</span>
            <span className="hidden sm:inline">Sitio publico</span>
          </Link>
          <span className="text-xs text-white/40 hidden sm:inline">Hola, {nombre}</span>
        </div>
      </div>
    </nav>
  );
}
