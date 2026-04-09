interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base =
    'w-full py-4 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-gradient-to-r from-[#d4af37] to-[#c4a030] text-black shadow-[0_4px_16px_rgba(212,175,55,0.2)] hover:shadow-[0_6px_24px_rgba(212,175,55,0.3)] hover:-translate-y-0.5',
    secondary: 'border border-white/10 bg-transparent text-white/60 hover:border-white/20',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? 'Procesando...' : children}
    </button>
  );
}
