'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ProgressBar } from '@/components/checkout/ProgressBar';
import { StepNumbers } from '@/components/checkout/StepNumbers';
import { StepData } from '@/components/checkout/StepData';
import { StepPayment } from '@/components/checkout/StepPayment';
import { StepConfirmation } from '@/components/checkout/StepConfirmation';
import { registerSale } from '@/app/actions/register-sale';
import { formatGs } from '@/lib/calculator';
import { trackPurchase } from '@/lib/pixel';
import { MetaPixelTracker } from '@/components/MetaPixelTracker';
import type { CheckoutState } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-white/50">Cargando...</p></div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const qty = parseInt(searchParams.get('qty') || '1');
  const price = parseInt(searchParams.get('price') || '20000');
  const isPromo3x1 = searchParams.get('promo') === '3x1';

  const [state, setState] = useState<CheckoutState>({
    step: 1,
    qty,
    price,
    isPromo3x1,
    selectedNumbers: [],
    mode: 'random',
    ci: '',
    nombre: '',
    telefono: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prellenar datos si el usuario esta logueado
  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Extraer telefono del metadata o del email interno (user.XXX@autolandia.internal)
      let phone = user.user_metadata?.telefono || user.phone || '';
      if (!phone && user.email?.endsWith('@autolandia.internal')) {
        const match = user.email.match(/user\.(\d+)@/);
        if (match) phone = match[1];
      }
      // Formatear telefono a formato local (09XXXXXXXX) para mostrar en el form
      let displayPhone = phone;
      if (phone.startsWith('595')) displayPhone = '0' + phone.slice(3);

      setState((prev) => ({
        ...prev,
        nombre: user.user_metadata?.nombre || '',
        ci: user.user_metadata?.ci || '',
        telefono: displayPhone,
      }));
    }
    loadUserData();
  }, []);

  function handleNumbersComplete(selectedNumbers: number[], mode: 'manual' | 'random') {
    setState((prev) => ({ ...prev, step: 2, selectedNumbers, mode }));
  }

  function handleDataComplete(ci: string, nombre: string, telefono: string) {
    setState((prev) => ({ ...prev, step: 3, ci, nombre, telefono }));
  }

  async function handlePaymentComplete(receiptUrl: string, transactionId: string, metodoPago: string) {
    setLoading(true);
    setError('');

    try {
      const result = await registerSale({
        cantidad: state.qty,
        transactionId,
        nombreCompleto: state.nombre,
        ci: state.ci,
        telefono: state.telefono,
        monto: state.price,
        comprobanteUrl: receiptUrl,
        metodoPago,
        selectedNumbers: state.selectedNumbers,
        isPromo3x1: state.isPromo3x1,
      });

      if (result.event_id) {
        trackPurchase({
          eventId: result.event_id,
          value: state.price,
          currency: 'PYG',
        });
      }

      setState((prev) => ({
        ...prev,
        step: 4,
        ticketId: result.ticketId,
        numerosAsignados: result.numerosAsignados,
        receiptUrl,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando venta');
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen pb-12">
      <MetaPixelTracker pathname="/checkout" />
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <a href="/" className="text-white/50 text-xl">
          ←
        </a>
        <h2 className="text-sm font-semibold">
          Checkout · {qty} boleto{qty > 1 ? 's' : ''} · {formatGs(price)}
        </h2>
      </div>

      {/* Progress */}
      <ProgressBar currentStep={state.step as 1 | 2 | 3 | 4} />

      {/* Content */}
      <div className="max-w-[500px] mx-auto px-5 mt-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {state.step === 1 && <StepNumbers qty={qty} price={price} onComplete={handleNumbersComplete} />}

        {state.step === 2 && (
          <StepData
            initialCi={state.ci}
            initialNombre={state.nombre}
            initialTelefono={state.telefono}
            onComplete={handleDataComplete}
            onBack={() => setState((prev) => ({ ...prev, step: 1 }))}
          />
        )}

        {state.step === 3 && (
          <StepPayment
            monto={price}
            onComplete={handlePaymentComplete}
            onBack={() => setState((prev) => ({ ...prev, step: 2 }))}
          />
        )}

        {state.step === 4 && state.ticketId && state.numerosAsignados && (
          <StepConfirmation
            ticketId={state.ticketId}
            nombre={state.nombre}
            ci={state.ci}
            qty={state.qty}
            total={state.price}
            numerosAsignados={state.numerosAsignados}
          />
        )}
      </div>
    </main>
  );
}
