const STEPS = [
  { icon: '🎯', title: 'Elegi', desc: 'Selecciona la cantidad de boletos que queres' },
  { icon: '💸', title: 'Paga', desc: 'Transferi y subi tu comprobante' },
  { icon: '🎟️', title: 'Recibi', desc: 'Tus numeros se asignan al instante' },
  { icon: '🏆', title: 'Gana', desc: 'Participa del sorteo en vivo' },
];

export function HowItWorks() {
  return (
    <section className="max-w-[700px] mx-auto px-4 py-12">
      <h2 className="text-center text-xl font-bold mb-8">Como funciona</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="glass-card p-4 text-center animate-slide-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="text-3xl mb-2">{step.icon}</div>
            <h3 className="font-bold text-sm text-[#d4af37]">{step.title}</h3>
            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
