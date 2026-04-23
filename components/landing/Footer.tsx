import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/40">
        <span>© 2026 Autolandia</span>
        <Link href="/privacidad" className="hover:text-white/70 transition-colors">
          Política de privacidad
        </Link>
      </div>
    </footer>
  );
}
