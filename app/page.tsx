import { Hero } from '@/components/landing/Hero';
import { PromoBanner } from '@/components/landing/PromoBanner';
import { PackGrid } from '@/components/landing/PackGrid';
import { SORTEO_DATE } from '@/lib/constants';

export default function Home() {
  const isClosed = new Date() > SORTEO_DATE;

  return (
    <main>
      <Hero />
      {isClosed ? (
        <div className="text-center py-12">
          <p className="text-red-500 text-xl font-bold">Sorteo Cerrado</p>
        </div>
      ) : (
        <>
          <PromoBanner />
          <div className="text-center px-4 pb-4">
            <h2 className="text-2xl font-bold">Elegi tus boletos</h2>
            <p className="text-white/50 mt-2">Mientras mas boletos, mayor descuento</p>
          </div>
          <div className="px-4 pb-12">
            <PackGrid />
          </div>
        </>
      )}
      <footer className="text-center py-6 border-t border-white/5 text-white/30 text-xs">
        Autolandia &copy; 2026 &middot; Sorteo: Sabado 6 de Junio, 16:00 hs
      </footer>
    </main>
  );
}
