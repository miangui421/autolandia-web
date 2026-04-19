'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Confetti } from './Confetti';
import { formatGs } from '@/lib/calculator';
import { announceSorteo } from '@/app/actions/sorteo';

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

type Phase = 'ready' | 'shuffling' | 'flash' | 'reveal' | 'done';

const SHUFFLE_DURATION = 3500; // ms
const FLASH_DURATION = 350; // ms

function maskPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.length !== 9) return '***';
  return `0${local.slice(0, 2)}***${local.slice(-4)}`;
}

function firstAndInitial(nombre: string): string {
  const parts = (nombre || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'Participante';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function Sorteador({
  sorteoId,
  titulo,
  premioMonto,
  premioDesc,
  ganadores,
  poolSampleNames,
}: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [currentWinnerIdx, setCurrentWinnerIdx] = useState(0);
  const [telegramNotified, setTelegramNotified] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentWinner = ganadores[currentWinnerIdx];
  const totalGanadores = ganadores.length;
  const hasMore = currentWinnerIdx + 1 < totalGanadores;

  const runAnimation = useCallback(async () => {
    // Primera vuelta: disparar Telegram (fire & forget, no bloquea UX)
    if (!telegramNotified) {
      setTelegramNotified(true);
      announceSorteo(sorteoId).catch((e) => console.error('announce:', e));
    }
    setPhase('shuffling');
    await new Promise((r) => setTimeout(r, SHUFFLE_DURATION));
    setPhase('flash');
    await new Promise((r) => setTimeout(r, FLASH_DURATION));
    setPhase('reveal');
    // NO auto-transition: el ganador queda hasta que el admin clickee "Finalizar" o "Siguiente".
  }, [sorteoId, telegramNotified]);

  function handleNext() {
    if (!hasMore) return;
    setCurrentWinnerIdx((i) => i + 1);
    setPhase('ready');
    setTimeout(runAnimation, 300);
  }

  function handleFinalizar() {
    setPhase('done');
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
      {/* Background glow gradient */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          phase === 'shuffling' || phase === 'flash' || phase === 'reveal'
            ? 'opacity-100'
            : 'opacity-40'
        }`}
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(212,175,55,0.15), transparent 70%)' }}
      />

      {/* HUD top */}
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

        {phase === 'shuffling' && (
          <ShufflingTicket
            names={poolSampleNames.length > 0 ? poolSampleNames : ['Participante']}
            winnerDisplay={firstAndInitial(currentWinner?.nombre ?? '')}
          />
        )}

        {phase === 'reveal' && currentWinner && (
          <WinnerReveal
            winner={currentWinner}
            premioMonto={premioMonto}
            onNext={hasMore ? handleNext : undefined}
            onFinalizar={!hasMore ? handleFinalizar : undefined}
            sorteoId={sorteoId}
          />
        )}

        {phase === 'done' && <WinnersSummary ganadores={ganadores} sorteoId={sorteoId} />}
      </div>

      {/* Flash */}
      {phase === 'flash' && (
        <div
          className="pointer-events-none fixed inset-0 z-30 bg-[#f5d76e]"
          style={{ animation: `sorteo-flash ${FLASH_DURATION}ms ease-out forwards` }}
        />
      )}

      {/* Confetti en reveal */}
      <Confetti active={phase === 'reveal'} />
    </div>
  );
}

// ─── Shuffling ticket con partículas doradas ───────────────
function ShufflingTicket({ names, winnerDisplay }: { names: string[]; winnerDisplay: string }) {
  const [currentName, setCurrentName] = useState(names[0]);

  useEffect(() => {
    const start = Date.now();
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const elapsed = Date.now() - start;
      if (elapsed >= SHUFFLE_DURATION) return;

      // Nombre random (excluir el actual para que siempre cambie algo)
      const pool = names.length > 1 ? names.filter((n) => n !== currentName) : names;
      const next = pool[Math.floor(Math.random() * pool.length)] ?? names[0];
      setCurrentName(next);

      // Intervalo: arranca rapido (60ms), termina lento (350ms). Ease-in.
      const progress = elapsed / SHUFFLE_DURATION;
      const eased = Math.pow(progress, 2.2);
      const interval = 60 + eased * 290;
      timeoutId = setTimeout(tick, interval);
    }
    timeoutId = setTimeout(tick, 60);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Muestra el ganador solo al final (ultimos 200ms)
  const [lockedIn, setLockedIn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLockedIn(true), SHUFFLE_DURATION - 200);
    return () => clearTimeout(t);
  }, []);

  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: 50 + (Math.random() - 0.5) * 60,
        top: 50 + (Math.random() - 0.5) * 40,
        dx: (Math.random() - 0.5) * 300,
        dy: (Math.random() - 0.5) * 300 - 60,
        delay: Math.random() * 2500,
        duration: 1200 + Math.random() * 1800,
        size: 4 + Math.random() * 6,
      })),
    [],
  );

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Halo giratorio detrás del ticket */}
      <div className="relative">
        <div
          className="absolute inset-0 -m-20 pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, rgba(212,175,55,0.15) 25%, transparent 50%, rgba(212,175,55,0.15) 75%, transparent 100%)',
            borderRadius: '50%',
            animation: 'sorteo-halo-spin 8s linear infinite',
            filter: 'blur(20px)',
          }}
        />

        {/* Ticket card */}
        <div
          className="relative z-10 w-80 sm:w-[28rem] px-8 py-12 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(20,16,8,0.9) 0%, rgba(10,10,15,0.95) 100%)',
            border: '2px solid rgba(212,175,55,0.6)',
            animation: 'sorteo-ticket-pulse 1.8s ease-in-out infinite',
          }}
        >
          {/* Notches decorativos de ticket */}
          <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-[#0a0a0f] border border-[#d4af37]/60" />
          <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-[#0a0a0f] border border-[#d4af37]/60" />

          <p className="text-[10px] text-[#d4af37] uppercase tracking-[0.4em] text-center mb-4 font-bold">
            Ticket ganador
          </p>

          <div className="relative h-16 flex items-center justify-center">
            <div
              key={lockedIn ? 'locked' : currentName}
              className="text-center"
              style={{ animation: lockedIn ? undefined : 'sorteo-name-swap 180ms ease-out' }}
            >
              <p
                className={`font-extrabold transition-all ${
                  lockedIn ? 'text-white' : 'text-white/90'
                }`}
                style={{
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  letterSpacing: lockedIn ? '0.02em' : '0',
                  textShadow: lockedIn ? '0 0 30px rgba(212,175,55,0.8)' : 'none',
                }}
              >
                {lockedIn ? winnerDisplay : currentName}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-[#d4af37]/40" />
            <span className="text-[9px] text-[#d4af37]/80 uppercase tracking-[0.3em] font-bold">
              Autolandia
            </span>
            <span className="h-px w-10 bg-[#d4af37]/40" />
          </div>
        </div>

        {/* Partículas doradas flotando */}
        {sparks.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: 'radial-gradient(circle, #f5d76e 0%, rgba(212,175,55,0.3) 60%, transparent 100%)',
              ['--spark-dx' as string]: `${s.dx}px`,
              ['--spark-dy' as string]: `${s.dy}px`,
              animation: `sorteo-spark-float ${s.duration}ms ease-out ${s.delay}ms infinite`,
            }}
          />
        ))}
      </div>

      <div className="mt-10 flex items-center gap-2">
        <p
          className="text-sm font-bold text-[#d4af37] uppercase"
          style={{ animation: 'sorteo-scan-text 1.4s ease-in-out infinite' }}
        >
          {lockedIn ? 'Ganador definido' : 'Seleccionando ganador'}
        </p>
        {!lockedIn && (
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"
                style={{ animation: `sorteo-dot-bounce 1s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Winner reveal ────────────────────────────────────────
function WinnerReveal({
  winner,
  premioMonto,
  onNext,
  onFinalizar,
  sorteoId,
}: {
  winner: SorteadorWinner;
  premioMonto: number;
  onNext?: () => void;
  onFinalizar?: () => void;
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

      <div className="hide-in-fullscreen mt-10 flex items-center justify-center gap-3 flex-wrap">
        {onNext && (
          <button
            onClick={onNext}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold hover:scale-105 transition-transform"
          >
            Siguiente ganador →
          </button>
        )}
        {onFinalizar && (
          <button
            onClick={onFinalizar}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold hover:scale-105 transition-transform"
          >
            Finalizar
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

// ─── Done summary ──────────────────────────────────────────
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
