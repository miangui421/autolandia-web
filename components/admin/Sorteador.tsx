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
  alreadyPlayed?: boolean; // si ya se reprodujo antes, muestra el resultado sin animar
}

type Phase = 'ready' | 'slot' | 'countdown' | 'reveal' | 'between' | 'done';

const SLOT_ROW_HEIGHT = 64; // px
const SLOT_DURATION = 3500; // ms

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
  alreadyPlayed = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>(alreadyPlayed ? 'done' : 'ready');
  const [currentWinnerIdx, setCurrentWinnerIdx] = useState(0);
  const [countdownValue, setCountdownValue] = useState(3);
  const [flashing, setFlashing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentWinner = ganadores[currentWinnerIdx];
  const totalGanadores = ganadores.length;

  // Slot reel: lista larga de nombres random con el ganador al final
  const slotNames = useRef<string[]>([]);
  if (slotNames.current.length === 0 && poolSampleNames.length > 0) {
    const base = poolSampleNames.length > 0 ? poolSampleNames : ['Participante'];
    // Array de ~50 nombres para que el scroll tenga longitud
    slotNames.current = Array.from({ length: 48 }, () => base[Math.floor(Math.random() * base.length)]);
  }

  const playSequence = useCallback(async () => {
    if (phase !== 'ready' && phase !== 'between') return;
    setPhase('slot');
    // Slot scroll
    await new Promise((r) => setTimeout(r, SLOT_DURATION));
    setPhase('countdown');
    // Countdown
    for (let i = 3; i >= 1; i--) {
      setCountdownValue(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    // Reveal
    setFlashing(true);
    setTimeout(() => setFlashing(false), 400);
    setPhase('reveal');
    // Esperar para ver el ganador
    await new Promise((r) => setTimeout(r, 4500));

    if (currentWinnerIdx + 1 < totalGanadores) {
      setCurrentWinnerIdx((i) => i + 1);
      setPhase('between');
      await new Promise((r) => setTimeout(r, 800));
      // Loop recursivo
      setPhase('ready');
      setTimeout(playSequence, 100);
    } else {
      setPhase('done');
    }
  }, [phase, currentWinnerIdx, totalGanadores]);

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

  // Cleanup fullscreen on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden flex flex-col"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,175,55,0.08),transparent_70%)]" />

      {/* HUD top (ocultable en fullscreen) */}
      <div className="hide-in-fullscreen relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/admin" className="text-white/50 text-sm hover:text-white/80">
          ← Panel admin
        </Link>
        <button
          onClick={handleFullscreen}
          className="text-xs font-bold text-[#d4af37] border border-[#d4af37]/30 px-3 py-1.5 rounded-full hover:bg-[#d4af37]/10"
        >
          Fullscreen
        </button>
      </div>

      {/* Header con titulo y premio */}
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
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        {phase === 'ready' && (
          <div className="text-center">
            <p className="text-white/40 text-sm mb-6">Listo para sortear</p>
            <button
              onClick={playSequence}
              className="px-10 py-5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-xl font-black uppercase tracking-wider shadow-[0_0_40px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform animate-pulse-gold"
            >
              ▶ Reproducir sorteo
            </button>
          </div>
        )}

        {phase === 'slot' && currentWinner && (
          <SlotReel
            names={slotNames.current}
            winnerDisplay={firstAndInitial(currentWinner.nombre)}
          />
        )}

        {phase === 'countdown' && (
          <div
            key={countdownValue}
            style={{ animation: 'sorteo-countdown-pop 700ms ease-out' }}
            className="text-[14rem] font-black text-[#d4af37] leading-none"
          >
            {countdownValue}
          </div>
        )}

        {phase === 'reveal' && currentWinner && (
          <div className="text-center" style={{ animation: 'sorteo-reveal-name 900ms ease-out' }}>
            <p className="text-[11px] text-[#d4af37] uppercase tracking-[0.3em] font-bold mb-4">Ganador</p>
            <h2 className="font-black leading-none" style={{ fontSize: 'clamp(56px, 12vw, 140px)', textShadow: '0 0 60px rgba(212,175,55,0.5)' }}>
              {currentWinner.nombre || 'Sin nombre'}
            </h2>
            <p className="mt-4 text-xl font-mono text-white/70">{maskPhone(currentWinner.phone)}</p>
            <p className="mt-2 text-sm text-white/50">
              {currentWinner.ticket_count} boleto{currentWinner.ticket_count > 1 ? 's' : ''} comprado{currentWinner.ticket_count > 1 ? 's' : ''}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d76e] text-black text-lg font-extrabold">
              {formatGs(premioMonto)}
            </div>
          </div>
        )}

        {phase === 'between' && (
          <div className="text-center text-white/40">
            <div className="w-10 h-10 mx-auto border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
            <p className="mt-3 text-sm">Siguiente ganador...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center space-y-6">
            <div>
              <p className="text-[11px] text-[#d4af37] uppercase tracking-[0.3em] font-bold mb-2">Sorteo finalizado</p>
              <h2 className="text-3xl font-extrabold">
                {totalGanadores > 1 ? `${totalGanadores} ganadores` : 'Ganador'}
              </h2>
            </div>
            <div className="max-w-md mx-auto space-y-2">
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
            <Link
              href={`/sorteo/${sorteoId}`}
              target="_blank"
              className="inline-block bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black text-sm font-bold px-6 py-3 rounded-xl"
            >
              Ver recibo publico →
            </Link>
          </div>
        )}
      </div>

      {/* Flash overlay */}
      {flashing && (
        <div
          className="pointer-events-none fixed inset-0 z-30 bg-[#d4af37]"
          style={{ animation: 'sorteo-flash 400ms ease-out forwards' }}
        />
      )}

      {/* Confetti */}
      <Confetti active={phase === 'reveal'} duration={4000} />
    </div>
  );
}

function SlotReel({ names, winnerDisplay }: { names: string[]; winnerDisplay: string }) {
  // Construir lista: muchos nombres random + el ganador al final
  const list = [...names, winnerDisplay];
  const targetOffset = -(list.length - 1) * SLOT_ROW_HEIGHT + SLOT_ROW_HEIGHT * 2; // centra ganador

  return (
    <div className="relative w-full max-w-md">
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          height: `${SLOT_ROW_HEIGHT * 5}px`,
          borderTop: '3px solid #d4af37',
          borderBottom: '3px solid #d4af37',
          background: 'linear-gradient(180deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.08) 50%, rgba(212,175,55,0) 100%)',
        }}
      >
        {/* Gradient fades */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0a0a0f] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0a0f] to-transparent z-10" />
        {/* Center indicator line */}
        <div
          className="pointer-events-none absolute left-0 right-0 z-20 bg-[#d4af37]"
          style={{ top: `${SLOT_ROW_HEIGHT * 2.5 - 1}px`, height: '2px', boxShadow: '0 0 12px rgba(212,175,55,0.6)' }}
        />
        <div
          style={{
            '--slot-from': '0px',
            '--slot-to': `${targetOffset}px`,
            animation: `sorteo-slot-scroll ${SLOT_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
          } as React.CSSProperties}
        >
          {list.map((name, i) => (
            <div
              key={i}
              className="flex items-center justify-center text-center font-bold"
              style={{
                height: `${SLOT_ROW_HEIGHT}px`,
                fontSize: '24px',
                color: i === list.length - 1 ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-[10px] text-[#d4af37] uppercase tracking-widest font-bold mt-4">
        ▲ Sorteando... ▲
      </p>
    </div>
  );
}
