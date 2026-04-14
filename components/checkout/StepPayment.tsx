'use client';
import { useState, useRef } from 'react';
import { validatePayment } from '@/app/actions/validate-payment';
import { Button } from '@/components/ui/Button';
import { BANK_INFO } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';
import type { FraudCheckResult } from '@/types';

interface StepPaymentProps {
  monto: number;
  onComplete: (receiptUrl: string, transactionId: string, metodoPago: string) => void;
  onBack: () => void;
}

export function StepPayment({ monto, onComplete, onBack }: StepPaymentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const { result, receiptUrl } = await validatePayment(formData, monto);

      if (result.status === 'approved') {
        onComplete(receiptUrl, result.idTransaccion, result.metodoPago);
      } else {
        setError(result.motivoRechazo || 'Comprobante rechazado');
        setFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error verificando comprobante. Intenta de nuevo.');
    }

    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError('El archivo excede 5MB');
      return;
    }
    setFile(f);
    setError('');
  }

  const [copied, setCopied] = useState(false);

  function copyAlias() {
    navigator.clipboard.writeText(BANK_INFO.alias);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bankDetails = [
    { key: 'Banco', val: BANK_INFO.banco },
    { key: 'Cuenta', val: BANK_INFO.cuenta },
    { key: 'Titular', val: BANK_INFO.titular },
    { key: 'Monto', val: formatGs(monto) },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="font-bold mb-4">Datos de transferencia</h3>

        {/* Alias destacado arriba */}
        <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Alias para transferir</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl font-extrabold text-[#d4af37] tracking-wider">{BANK_INFO.alias}</span>
            <button
              onClick={copyAlias}
              className="bg-[#d4af37]/20 hover:bg-[#d4af37]/30 text-[#d4af37] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="bg-[#d4af37]/5 border border-[#d4af37]/15 rounded-xl p-4">
          {bankDetails.map(({ key, val }) => (
            <div key={key} className="flex justify-between py-1.5 text-sm border-b border-white/[0.04] last:border-0">
              <span className="text-white/40">{key}</span>
              <span className={`font-semibold ${key === 'Monto' ? 'text-[#d4af37] text-base' : 'text-[#d4af37]'}`}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="font-bold mb-2">Subi tu comprobante</h3>
        <p className="text-sm text-white/40 mb-4">Realiza la transferencia desde tu app bancaria y subi la captura aqui</p>

        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

        {file ? (
          <div className="bg-[#d4af37]/5 border border-[#d4af37]/20 rounded-xl p-4 text-center">
            <p className="text-sm text-[#d4af37] font-semibold">{file.name}</p>
            <p className="text-xs text-white/30 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            <button onClick={() => setFile(null)} className="text-xs text-white/40 mt-2 underline">
              Cambiar archivo
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-white/10 rounded-xl py-8 text-center hover:border-[#d4af37]/30 hover:bg-[#d4af37]/[0.02] transition-all"
          >
            <div className="text-2xl mb-2">📄</div>
            <p className="text-white/40 text-sm">
              Toca aqui para subir tu comprobante
            </p>
            <p className="text-[11px] text-white/20 mt-1">JPG, PNG o PDF — Max 5MB</p>
          </button>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      <Button onClick={handleUpload} disabled={!file} loading={loading}>
        {loading ? 'Verificando comprobante...' : 'Verificar comprobante'}
      </Button>
      <Button variant="secondary" onClick={onBack}>
        ← Volver
      </Button>
    </div>
  );
}
