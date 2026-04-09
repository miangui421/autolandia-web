import { Countdown } from './Countdown';
import { SORTEO_TITLE, SORTEO_PRIZE, SORTEO_PRIZE_DETAIL } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';

export function Hero() {
  return (
    <section className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(212,175,55,0.08),transparent_60%)] pointer-events-none" />
      <span className="bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black px-5 py-1.5 rounded-full text-[13px] font-bold tracking-widest uppercase mb-6 relative">
        {SORTEO_TITLE}
      </span>
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold mb-2 relative">
        Gana un <span className="text-[#d4af37]">{SORTEO_PRIZE}</span>
      </h1>
      <p className="text-[clamp(1rem,2.5vw,1.3rem)] text-white/70 mb-8 relative">{SORTEO_PRIZE_DETAIL}</p>
      <div className="relative mb-8">
        <Countdown />
      </div>
      <p className="text-white/60 text-lg relative">
        Boleto desde <strong className="text-[#d4af37] text-xl">{formatGs(20_000)}</strong>
      </p>
    </section>
  );
}
