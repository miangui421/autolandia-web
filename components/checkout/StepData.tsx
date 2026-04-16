'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface StepDataProps {
  initialCi?: string;
  initialNombre?: string;
  initialTelefono?: string;
  onComplete: (ci: string, nombre: string, telefono: string) => void;
  onBack: () => void;
}

export function StepData({
  initialCi = '',
  initialNombre = '',
  initialTelefono = '',
  onComplete,
  onBack,
}: StepDataProps) {
  const [ci, setCi] = useState(initialCi);
  const [nombre, setNombre] = useState(initialNombre);
  const [telefono, setTelefono] = useState(initialTelefono);
  const [error, setError] = useState('');

  const isPrefilled = !!(initialCi && initialNombre && initialTelefono);

  function handleSubmit() {
    if (!ci.trim() || !nombre.trim() || !telefono.trim()) {
      setError('Completa todos los campos');
      return;
    }
    setError('');
    onComplete(ci.trim(), nombre.trim(), telefono.trim());
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
      <h3 className="font-bold mb-1">Tus datos</h3>
      {isPrefilled && (
        <p className="text-xs text-[#d4af37]/70 mb-4">
          ✓ Datos cargados de tu cuenta. Podes editarlos si queres.
        </p>
      )}
      {!isPrefilled && <div className="mb-4" />}

      <Input label="Cedula de identidad" placeholder="Ej: 4.521.332" value={ci} onChange={(e) => setCi(e.target.value)} />
      <Input label="Nombre completo" placeholder="Ej: Juan Perez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input
        label="Telefono"
        type="tel"
        placeholder="Ej: 0981 123 456"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <Button onClick={handleSubmit}>Continuar al pago</Button>
      <Button variant="secondary" className="mt-2" onClick={onBack}>
        ← Volver
      </Button>
    </div>
  );
}
