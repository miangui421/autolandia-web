import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { MetaPixel } from '@/components/MetaPixel';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Autolandia 3.0 — Gana un BMW Serie 5 2013',
  description:
    'Participa por un BMW Serie 5 2013 Diesel. Boletos desde Gs. 20.000. Sorteo: Sabado 6 de Junio, 16:00 hs.',
  openGraph: {
    title: 'Autolandia 3.0 — Gana un BMW Serie 5',
    description: 'Boletos desde Gs. 20.000. Sorteo: 6 de Junio.',
    type: 'website',
  },
  other: {
    'facebook-domain-verification': 'fenwtxcnh3fpnvbukjd962wljtngyn',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white min-h-screen antialiased`}>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
