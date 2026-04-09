const STEPS = ['Numeros', 'Datos', 'Pago', 'Listo'];

export function ProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="max-w-[500px] mx-auto px-5 pt-5">
      <div className="flex gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full ${
              i < currentStep - 1 ? 'bg-green-400' : i === currentStep - 1 ? 'bg-[#d4af37]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 text-center text-[10px] uppercase tracking-wider ${
              i < currentStep - 1 ? 'text-green-400' : i === currentStep - 1 ? 'text-[#d4af37] font-semibold' : 'text-white/25'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
