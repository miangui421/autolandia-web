import Link from 'next/link';

export function AdminNav({ nombre }: { nombre: string }) {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/admin"
          className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]"
        >
          AUTOLANDIA · ADMIN
        </Link>
        <span className="text-xs text-white/40">Hola, {nombre}</span>
      </div>
    </nav>
  );
}
