'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { previewSorteoPool, createAndExecuteSorteo } from '@/app/actions/sorteo';
import { formatGs } from '@/lib/calculator';

type Canal = 'web' | 'bot' | 'cualquiera';

export function SorteoForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState('');
  const [premioMonto, setPremioMonto] = useState(500_000);
  const [premioDesc, setPremioDesc] = useState('');
  const [fechaDesde, setFechaDesde] = useState(thirtyDaysAgo);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [minBoletos, setMinBoletos] = useState<number | ''>('');
  const [canal, setCanal] = useState<Canal>('cualquiera');
  const [excluirPrev, setExcluirPrev] = useState(true);
  const [ponderar, setPonderar] = useState(false);
  const [cantidadGanadores, setCantidadGanadores] = useState(1);

  const [preview, setPreview] = useState<{
    count: number;
    sampleNombres: string[];
    breakdown: { total_unique: number; after_min_boletos: number; excluded_prev_winners: number };
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Debounced preview
  useEffect(() => {
    if (!fechaDesde || !fechaHasta) return;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await previewSorteoPool({
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          min_boletos: typeof minBoletos === 'number' && minBoletos > 0 ? minBoletos : undefined,
          canal,
          excluir_prev_ganadores: excluirPrev,
        });
        setPreview(res);
      } catch (e) {
        console.error('preview error:', e);
        setPreview({
          count: 0,
          sampleNombres: [],
          breakdown: { total_unique: 0, after_min_boletos: 0, excluded_prev_winners: 0 },
        });
      }
      setPreviewing(false);
    }, 500);
    return () => clearTimeout(t);
  }, [fechaDesde, fechaHasta, minBoletos, canal, excluirPrev]);

  async function handleSubmit() {
    setError('');
    if (!titulo.trim()) {
      setError('Titulo requerido');
      return;
    }
    if (premioMonto <= 0) {
      setError('Premio debe ser mayor a 0');
      return;
    }
    if (!preview || preview.count < cantidadGanadores) {
      setError(`Pool insuficiente: ${preview?.count || 0} participantes para ${cantidadGanadores} ganador(es)`);
      return;
    }
    if (!confirm(`Confirmas crear el sorteo "${titulo}"? Esta accion NO se puede deshacer.`)) return;

    setSubmitting(true);
    const res = await createAndExecuteSorteo({
      titulo: titulo.trim(),
      premio_monto: premioMonto,
      premio_descripcion: premioDesc.trim() || undefined,
      filtros: {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        min_boletos: typeof minBoletos === 'number' && minBoletos > 0 ? minBoletos : undefined,
        canal,
        excluir_prev_ganadores: excluirPrev,
      },
      ponderar_por_boletos: ponderar,
      cantidad_ganadores: cantidadGanadores,
    });
    setSubmitting(false);

    if (!res.success || !res.sorteo_id) {
      setError(res.error || 'Error creando sorteo');
      return;
    }
    router.push(`/admin/sorteos/${res.sorteo_id}`);
  }

  return (
    <div className="space-y-5">
      {/* Titulo + premio */}
      <section className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Premio</h3>
        <Field label="Titulo del sorteo">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Sorteo de fidelidad Abril"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
          />
        </Field>
        <Field label="Monto (Gs)">
          <input
            type="number"
            value={premioMonto}
            onChange={(e) => setPremioMonto(parseInt(e.target.value) || 0)}
            min={1}
            step={1000}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
          />
          <p className="text-[11px] text-white/30 mt-1">= {formatGs(premioMonto)}</p>
        </Field>
        <Field label="Descripcion (opcional)">
          <input
            type="text"
            value={premioDesc}
            onChange={(e) => setPremioDesc(e.target.value)}
            placeholder="Ej: Sorteo 2da semana de abril para compradores de 3 tickets o mas"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
          />
        </Field>
      </section>

      {/* Filtros */}
      <section className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Filtros del pool</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha desde">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
            />
            <p className="text-[11px] text-[#d4af37]/70 mt-1 font-mono">= {formatDMY(fechaDesde)}</p>
          </Field>
          <Field label="Fecha hasta">
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
            />
            <p className="text-[11px] text-[#d4af37]/70 mt-1 font-mono">= {formatDMY(fechaHasta)}</p>
          </Field>
        </div>
        <Field label="Minimo de boletos (opcional)">
          <input
            type="number"
            value={minBoletos}
            onChange={(e) => setMinBoletos(e.target.value ? parseInt(e.target.value) : '')}
            min={1}
            placeholder="Sin minimo"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
          />
        </Field>
        <Field label="Canal de compra">
          <div className="flex gap-2">
            {(['cualquiera', 'web', 'bot'] as Canal[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-colors ${
                  canal === c
                    ? 'bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#d4af37]'
                    : 'bg-white/5 border border-white/10 text-white/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={excluirPrev}
            onChange={(e) => setExcluirPrev(e.target.checked)}
            className="w-4 h-4 accent-[#d4af37]"
          />
          <span className="text-sm text-white/70">Excluir ganadores de sorteos previos</span>
        </label>
      </section>

      {/* Mecanica */}
      <section className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Mecanica</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ponderar}
            onChange={(e) => setPonderar(e.target.checked)}
            className="w-4 h-4 accent-[#d4af37]"
          />
          <div>
            <span className="text-sm text-white/70">Ponderar por cantidad de boletos</span>
            <p className="text-[11px] text-white/30">Si esta off: 1 entrada por persona (justo). Si esta on: quien compro mas boletos tiene mas chance.</p>
          </div>
        </label>
        <Field label="Cantidad de ganadores">
          <input
            type="number"
            value={cantidadGanadores}
            onChange={(e) => setCantidadGanadores(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={50}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
          />
        </Field>
      </section>

      {/* Preview */}
      <section className="glass-card p-5">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Preview del pool</h3>
        {previewing ? (
          <p className="text-sm text-white/40">Calculando...</p>
        ) : preview ? (
          <div>
            <p className="text-3xl font-extrabold text-[#d4af37]">{preview.count}</p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">
              participante{preview.count !== 1 ? 's' : ''} elegible{preview.count !== 1 ? 's' : ''}
            </p>

            {/* Breakdown: mostrar cuando hay filtros que redujeron el pool */}
            {(preview.breakdown.total_unique !== preview.count) && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1 text-[11px] text-white/50">
                <BreakdownLine label="Personas unicas en rango" value={preview.breakdown.total_unique} />
                {preview.breakdown.after_min_boletos !== preview.breakdown.total_unique && (
                  <BreakdownLine
                    label={`Con ≥${minBoletos} boletos`}
                    value={preview.breakdown.after_min_boletos}
                    delta={preview.breakdown.after_min_boletos - preview.breakdown.total_unique}
                  />
                )}
                {preview.breakdown.excluded_prev_winners > 0 && (
                  <BreakdownLine
                    label="Ganadores previos excluidos"
                    value={preview.breakdown.excluded_prev_winners}
                    delta={-preview.breakdown.excluded_prev_winners}
                    negative
                  />
                )}
                <div className="pt-1 font-bold text-white/80 flex justify-between">
                  <span>Pool final elegible</span>
                  <span>{preview.count}</span>
                </div>
              </div>
            )}

            {preview.count < cantidadGanadores && (
              <p className="text-xs text-red-400 mt-3 font-semibold">
                ⚠️ Pool insuficiente para {cantidadGanadores} ganador{cantidadGanadores > 1 ? 'es' : ''}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/40">Completa fechas para ver el preview.</p>
        )}
      </section>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <Button
        loading={submitting}
        onClick={handleSubmit}
        disabled={!preview || preview.count < cantidadGanadores || !titulo.trim()}
      >
        Crear sorteo (NO se puede deshacer)
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function BreakdownLine({ label, value, delta, negative }: { label: string; value: number; delta?: number; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {delta !== undefined && delta !== 0 && (
          <span className={`text-[10px] ${negative ? 'text-red-400' : 'text-yellow-400'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
        <span className="font-mono">{value}</span>
      </span>
    </div>
  );
}

/** Convierte ISO YYYY-MM-DD a DD/MM/YYYY para display. */
function formatDMY(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
