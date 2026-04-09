'use client';
import { WHATSAPP_GROUP_LINK } from '@/lib/constants';
import { formatGs } from '@/lib/calculator';

interface StepConfirmationProps {
  ticketId: string;
  nombre: string;
  ci: string;
  qty: number;
  total: number;
  numerosAsignados: string;
}

export function StepConfirmation({ ticketId, nombre, ci, qty, total, numerosAsignados }: StepConfirmationProps) {
  const numeros = numerosAsignados.split(', ').filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-green-400/10 border-2 border-green-400 flex items-center justify-center text-4xl mx-auto mb-4">
          ✓
        </div>
        <h2 className="text-2xl font-bold">Compra exitosa!</h2>
        <p className="text-white/50 mt-1">Tus boletos fueron asignados correctamente</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="font-bold mb-3">Resumen</h3>
        {[
          { label: 'Ticket', value: ticketId },
          { label: 'Nombre', value: nombre },
          { label: 'CI', value: ci },
          { label: 'Cantidad', value: `${qty} boletos` },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between py-2.5 border-b border-white/[0.04] text-sm">
            <span className="text-white/50">{label}</span>
            <span>{value}</span>
          </div>
        ))}
        <div className="flex justify-between py-2.5 text-lg font-bold">
          <span className="text-white/50">Total</span>
          <span className="text-[#d4af37]">{formatGs(total)}</span>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <h3 className="font-bold mb-3">Tus numeros</h3>
        <div className="flex flex-wrap gap-1.5">
          {numeros.map((n) => (
            <span key={n} className="bg-green-400/10 border border-green-400/30 text-green-400 px-3 py-1.5 rounded-lg text-sm font-bold">
              {n}
            </span>
          ))}
        </div>
      </div>

      <a
        href="/"
        className="block w-full py-4 rounded-xl font-bold text-center bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black"
      >
        Comprar mas boletos
      </a>
      <a
        href={WHATSAPP_GROUP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-green-400 text-sm py-2"
      >
        Unirse al grupo del sorteo →
      </a>
    </div>
  );
}
