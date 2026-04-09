'use client';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = type === 'success' ? 'border-[#d4af37] bg-[#d4af37]/10' : 'border-red-500 bg-red-500/10';

  return (
    <div className={`fixed top-4 right-4 z-50 border rounded-xl px-4 py-3 ${colors}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
