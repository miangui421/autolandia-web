'use client';
import { useEffect, useState } from 'react';
import { SORTEO_DATE } from '@/lib/constants';

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = SORTEO_DATE.getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (expired) return <p className="text-red-500 text-xl font-bold">Sorteo Cerrado</p>;

  const items = [
    { value: timeLeft.days, label: 'Dias' },
    { value: timeLeft.hours, label: 'Horas' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Seg' },
  ];

  return (
    <div className="flex gap-3">
      {items.map(({ value, label }) => (
        <div
          key={label}
          className="bg-white/5 border border-[#d4af37]/20 rounded-xl px-4 py-3 min-w-[70px] text-center"
        >
          <div className="text-3xl font-extrabold text-[#d4af37] leading-none">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}
