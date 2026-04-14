import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { PromoBanner } from '@/components/landing/PromoBanner';
import { PackGrid } from '@/components/landing/PackGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SORTEO_DATE, WHATSAPP_GROUP_LINK } from '@/lib/constants';

export default function Home() {
  const isClosed = new Date() > SORTEO_DATE;

  return (
    <>
      <Navbar />
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
            <div className="px-4 pb-4">
              <PackGrid />
            </div>
            <HowItWorks />
          </>
        )}
        <footer className="border-t border-white/5 py-8 px-4">
          <div className="max-w-[600px] mx-auto text-center space-y-3">
            <a
              href={WHATSAPP_GROUP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-400 text-sm hover:text-green-300 transition-colors"
            >
              <span>📱</span> Unite al grupo del sorteo
            </a>
            <p className="text-white/20 text-xs">
              Autolandia &copy; 2026 &middot; Sorteo: Sabado 6 de Junio, 16:00 hs
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
