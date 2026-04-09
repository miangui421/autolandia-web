interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:border-[#d4af37]/50 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}
