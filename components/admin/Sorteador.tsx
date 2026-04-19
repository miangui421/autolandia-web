'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Confetti } from './Confetti';
import { formatGs } from '@/lib/calculator';

export interface SorteadorWinner {
  phone: string;
  nombre: string;
  ci: string;
  ticket_count: number;
  pick_order: number;
}

interface Props {
  sorteoId: string;
  titulo: string;
  premioMonto: number;
  premioDesc: string | null;
  ganadores: SorteadorWinner[];
  poolSampleNames: string[];
}

type Phase = 'ready' | 'scanning' | 'flash' | 'reveal' | 'done';

const SCAN_DURATION = 2500; // ms — suspense antes del reveal
const FLASH_DURATION = 350; // ms

function maskPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.length !== 9) return '***';
  return `0${local.slice(0, 2)}***${local.slice(-4)}`;
}

export function Sorteador({
  sorteoId,
  titulo,
  premioMonto,
  premioDesc,
  ganadores,
}: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentWinnerIdx, setCurrentWinnerIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentWinner = ganadores[currentWinnerIdx];
  const totalGanadores = ganadores.length;
  const hasMore = currentWinnerIdx + 1 < totalGanadores;

  const runAnimation = useCallback(async () => {
    setPhase('scanning');
    await new Promise((r) => setTimeout(r, SCAN_DURATION));
    setPhase('flash');
    await new Promise((r) => setTimeout(r, FLASH_DURATION));
    setPhase('reveal');
    // No hay auto-advance: el ganador queda en pantalla. Si hay mas, el admin tiene boton.
    if (!hasMore) {
      // Post-reveal, en 6s pasa a 'done' que muestra resumen
      setTimeout(() => setPhase('done'), 6500);
    }
  }, [hasMore]);

  function handleNext() {
    if (!hasMore) return;
    setCurrentWinnerIdx((i) => i + 1);
    setPhase('ready');
    // Auto-start para el siguiente
    setTimeout(runAnimation, 300);
  }

  async function handleFullscreen() {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen error:', e);
    }
  }

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden flex flex-col">
      {/* Radial glow */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          phase === 'scanning' || phase === 'flash' || phase === 'reveal'
            ? 'opacity-100'
            : 'opacity-40'
        }`}
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(212,175,55,0.12), transparent 70%)',
        }}
      />

      {/* HUD top — ocultable en fullscreen */}
      <div className="hide-in-fullscreen relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link
          href="/admin"
          className="text-white/60 text-sm hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          ← Volver al panel
        </Link>
        <button
          onClick={handleFullscreen}
          className="text-xs font-bold text-[#d4af37] border border-[#d4af37]/30 px-3 py-1.5 rounded-full hover:bg-[#d4af37]/10"
        >
          Fullscreen
        </button>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center py-6">
        <p className="text-[10px] text-white/40 uppercase tracking-[0.3em]">Sorteo en vivo</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">{titulo}</h1>
        <div className="mt-3 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black font-extrabold">
          {formatGs(premioMonto)}
        </div>
        {premioDesc && <p className="text-xs text-white/50 mt-2">{premioDesc}</p>}
        {totalGanadores > 1 && (
          <p className="text-[11px] text-white/40 mt-3 uppercase tracking-widest">
            Ganador {currentWinnerIdx + 1} de {totalGanadores}
          </p>
        )}
      </div>

      {/* Stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        {phase === 'ready' && (
          <div className="text-center">
            <p className="text-white/40 text-sm mb-6 tracking-wider">Listo para sortear</p>
            <button
              onClick={runAnimation}
              className="px-12 py-6 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-2xl font-black uppercase tracking-wider shadow-[0_0_50px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform animate-pulse-gold"
            >
              Iniciar sorteo
            </button>
          </div>
        )}

        {phase === 'scanning' && <ScanningVisual />}

        {phase === 'reveal' && currentWinner && (
          <WinnerReveal
            winner={currentWinner}
            premioMonto={premioMonto}
            onNext={hasMore ? handleNext : undefined}
            sorteoId={sorteoId}
          />
        )}

        {phase === 'done' && (
          <WinnersSummary ganadores={ganadores} sorteoId={sorteoId} />
        )}
      </div>

      {/* Flash overlay */}
      {phase === 'flash' && (
        <div
          className="pointer-events-none fixed inset-0 z-30 bg-[#f5d76e]"
          style={{ animation: `sorteo-flash ${FLASH_DURATION}ms ease-out forwards` }}
        />
      )}

      {/* Confetti durante reveal */}
      <Confetti active={phase === 'reveal'} duration={4500} />
    </div>
  );
}

// ─── Scanning phase ─────────────────────────────────────────
function ScanningVisual() {
  return (
    <div className="relative flex flex-col items-center">
      {/* Anillos pulsantes concentricos */}
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-[#d4af37]"
            style={{
              animation: `sorteo-ring-pulse 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite`,
              animationDelay: `${i * 0.55}s`,
            }}
          />
        ))}
        {/* Core dorado */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d76e] shadow-[0_0_60px_rgba(212,175,55,0.6)] animate-pulse-gold" />
      </div>

      {/* Texto con dots animados */}
      <div className="flex items-center gap-2">
        <p
          className="text-sm sm:text-base font-bold text-[#d4af37] uppercase"
          style={{ animation: 'sorteo-scan-text 1.4s ease-in-out infinite' }}
        >
          Seleccionando ganador
        </p>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"
              style={{ animation: `sorteo-dot-bounce 1s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

// ─── Reveal phase ───────────────────────────────────────────
function WinnerReveal({
  winner,
  premioMonto,
  onNext,
  sorteoId,
}: {
  winner: SorteadorWinner;
  premioMonto: number;
  onNext?: () => void;
  sorteoId: string;
}) {
  return (
    <div className="text-center w-full" style={{ animation: 'sorteo-reveal-name 900ms ease-out' }}>
      <p className="text-[11px] text-[#d4af37] uppercase tracking-[0.3em] font-bold mb-4">
        🏆 Ganador{winner.pick_order > 1 ? ` #${winner.pick_order}` : ''}
      </p>
      <h2
        className="font-black leading-[0.95] px-4"
        style={{
          fontSize: 'clamp(48px, 11vw, 132px)',
          textShadow: '0 0 60px rgba(212,175,55,0.5), 0 0 120px rgba(212,175,55,0.3)',
        }}
      >
        {winner.nombre || 'Sin nombre'}
      </h2>
      <p className="mt-5 text-xl font-mono text-white/70">{maskPhone(winner.phone)}</p>
      <p className="mt-2 text-sm text-white/50">
        {winner.ticket_count} boleto{winner.ticket_count > 1 ? 's' : ''} comprado{winner.ticket_count > 1 ? 's' : ''}
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black text-xl font-extrabold shadow-[0_0_40px_rgba(212,175,55,0.4)]">
        {formatGs(premioMonto)}
      </div>

      {/* Controles ocultos en fullscreen para no ensuciar stream */}
      <div className="hide-in-fullscreen mt-10 flex items-center justify-center gap-3 flex-wrap">
        {onNext && (
          <button
            onClick={onNext}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold hover:scale-105 transition-transform"
          >
            Siguiente ganador →
          </button>
        )}
        <Link
          href={`/sorteo/${sorteoId}`}
          target="_blank"
          className="px-6 py-3 rounded-xl border border-white/20 text-white/70 text-sm font-bold hover:bg-white/5"
        >
          Recibo público ↗
        </Link>
        <Link
          href="/admin"
          className="px-6 py-3 rounded-xl border border-white/20 text-white/70 text-sm font-bold hover:bg-white/5"
        >
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}

// ─── Done summary (post último ganador, tras unos segundos) ──
function WinnersSummary({ ganadores, sorteoId }: { ganadores: SorteadorWinner[]; sorteoId: string }) {
  return (
    <div className="text-center space-y-6 max-w-md w-full">
      <div>
        <p className="text-[11px] text-[#d4af37] uppercase tracking-[0.3em] font-bold mb-2">Sorteo finalizado</p>
        <h2 className="text-3xl font-extrabold">
          {ganadores.length > 1 ? `${ganadores.length} ganadores` : 'Ganador'}
        </h2>
      </div>
      <div className="space-y-2">
        {ganadores.map((g) => (
          <div key={g.pick_order} className="glass-card p-4 flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d76e] text-black font-black flex items-center justify-center">
              {g.pick_order}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold">{g.nombre}</p>
              <p className="text-[11px] text-white/40 font-mono">{maskPhone(g.phone)}</p>
            </div>
            <div className="text-right text-xs text-white/50">{g.ticket_count} boletos</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link
          href={`/sorteo/${sorteoId}`}
          target="_blank"
          className="px-5 py-2.5 rounded-xl border border-white/20 text-white/70 text-sm font-bold hover:bg-white/5"
        >
          Recibo público ↗
        </Link>
        <Link
          href="/admin"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold"
        >
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}
