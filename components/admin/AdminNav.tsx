'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sorteos', label: 'Sorteos' },
  { href: '/admin/tickets', label: 'Tickets' },
];

export function AdminNav({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
      <div className="max-w-[1100px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">
            AUTOLANDIA · ADMIN
          </Link>
          <span className="text-xs text-white/40">Hola, {nombre}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30'
                    : 'text-white/50 hover:text-white/80 border border-transparent'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
