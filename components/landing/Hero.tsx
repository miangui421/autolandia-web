import { Countdown } from './Countdown';
import { SORTEO_TITLE, SORTEO_PRIZE, SORTEO_PRIZE_DETAIL } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';

export function Hero() {
  return (
    <section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 py-12 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(212,175,55,0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(212,175,55,0.05),transparent_40%)] pointer-events-none" />

      {/* Floating gold dots */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#d4af37]/20 animate-float pointer-events-none"
          style={{
            width: `${4 + i * 2}px`,
            height: `${4 + i * 2}px`,
            left: `${10 + i * 15}%`,
            top: `${15 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + i * 0.5}s`,
          }}
        />
      ))}

      {/* Badge */}
      <span className="relative bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black px-6 py-2 rounded-full text-[13px] font-bold tracking-widest uppercase mb-8 shadow-[0_0_30px_rgba(212,175,55,0.3)]">
        <span className="absolute inset-0 rounded-full animate-shimmer" />
        {SORTEO_TITLE}
      </span>

      {/* Title */}
      <h1 className="text-[clamp(2.2rem,6vw,4rem)] font-extrabold mb-3 relative leading-tight animate-slide-up">
        Gana un <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e]">{SORTEO_PRIZE}</span>
      </h1>
      <p className="text-[clamp(1rem,2.5vw,1.2rem)] text-white/60 mb-10 relative animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {SORTEO_PRIZE_DETAIL}
      </p>

      {/* Car image */}
      <div className="relative mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="absolute -inset-8 bg-[radial-gradient(circle,rgba(212,175,55,0.2),transparent_70%)] rounded-full blur-2xl" />
        <img
          src="https://xtwrmcbvjgywwdpdwoxw.supabase.co/storage/v1/object/public/assets/WhatsApp%20Image%202026-03-30%20at%2016.56.51.jpeg"
          alt="BMW Serie 5 2013 - Sorteo Autolandia 3.0"
          className="w-[min(450px,90vw)] rounded-2xl border border-[#d4af37]/20 shadow-[0_0_40px_rgba(212,175,55,0.15)] relative"
        />
      </div>

      {/* Countdown */}
      <div className="relative mb-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <Countdown />
      </div>

      {/* Price */}
      <p className="text-white/50 text-lg relative animate-slide-up" style={{ animationDelay: '0.4s' }}>
        Boleto desde <strong className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-2xl">{formatGs(20_000)}</strong>
      </p>
    </section>
  );
}
